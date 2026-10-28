import type { Redis } from 'ioredis';
import { isClosed, tallyResults } from '#lib/poll-rules.ts';
import type { PublicPoll, Results } from '#lib/types.ts';
import { keys, POLL_TTL_SECONDS } from './keys';
import { getRedis } from './redis';
import { hashToken, newAdminToken, newPollId } from './tokens';
import type { CreatePollInput } from './validation';

/** A poll as stored in Redis, including the admin token hash. */
export interface StoredPoll extends PublicPoll {
	adminHash: string;
}

/** Result of trying to record a vote. */
export type VoteOutcome = 'ok' | 'not_found' | 'closed' | 'stale';

/** Message published on a poll's channel whenever its state changes. */
export interface PollEvent {
	results: Results;
	closed: boolean;
	round: number;
}

/**
 * Records a ballot atomically. Fails if the poll is gone, closed (manually or
 * by its deadline) or was reset since the voter loaded it.
 * KEYS: poll hash, votes hash. ARGV: now, expected round, ...option indices.
 */
const VOTE_SCRIPT = `
if redis.call('EXISTS', KEYS[1]) == 0 then return 'not_found' end
local state = redis.call('HMGET', KEYS[1], 'closedAt', 'closesAt', 'round')
if state[1] and state[1] ~= '' then return 'closed' end
if state[2] and state[2] ~= '' and tonumber(state[2]) <= tonumber(ARGV[1]) then return 'closed' end
if state[3] ~= ARGV[2] then return 'stale' end
for i = 3, #ARGV do redis.call('HINCRBY', KEYS[2], ARGV[i], 1) end
redis.call('HINCRBY', KEYS[2], 'voters', 1)
local ttl = redis.call('PTTL', KEYS[1])
if ttl > 0 then redis.call('PEXPIRE', KEYS[2], ttl) end
return 'ok'
`;

const optionalNumber = (value: string | undefined): number | null =>
	value ? Number(value) : null;

/** Converts a Redis hash into a poll, or `null` if the hash is empty or corrupt. */
export function parsePoll(id: string, hash: Record<string, string>): StoredPoll | null {
	if (!hash.question || !hash.options) return null;
	let options: unknown;
	try {
		options = JSON.parse(hash.options);
	} catch {
		return null;
	}
	if (!Array.isArray(options) || !options.every((o) => typeof o === 'string')) return null;
	return {
		id,
		question: hash.question,
		options,
		multiple: hash.multiple === '1',
		hideResults: hash.hideResults === '1',
		listed: hash.listed === '1',
		closesAt: optionalNumber(hash.closesAt),
		closedAt: optionalNumber(hash.closedAt),
		createdAt: Number(hash.createdAt),
		round: Number(hash.round ?? '0'),
		adminHash: hash.adminHash ?? ''
	};
}

/** Strips private fields before a poll is sent to the browser. */
export function toPublic(poll: StoredPoll): PublicPoll {
	const { adminHash: _adminHash, ...rest } = poll;
	return rest;
}

/** Poll persistence on top of Redis. */
export class PollStore {
	constructor(private readonly redis: Redis) {}

	/** Creates a poll and returns it with its one-time admin token. */
	async create(
		input: CreatePollInput,
		now = Date.now()
	): Promise<{ poll: StoredPoll; adminToken: string }> {
		const id = newPollId();
		const adminToken = newAdminToken();
		const poll: StoredPoll = {
			id,
			question: input.question,
			options: input.options,
			multiple: input.multiple,
			hideResults: input.hideResults,
			listed: input.listed,
			closesAt: input.closeAfterMinutes ? now + input.closeAfterMinutes * 60_000 : null,
			closedAt: null,
			createdAt: now,
			round: 0,
			adminHash: hashToken(adminToken)
		};
		const tx = this.redis
			.multi()
			.hset(keys.poll(id), {
				question: poll.question,
				options: JSON.stringify(poll.options),
				multiple: poll.multiple ? '1' : '0',
				hideResults: poll.hideResults ? '1' : '0',
				listed: poll.listed ? '1' : '0',
				closesAt: poll.closesAt === null ? '' : String(poll.closesAt),
				closedAt: '',
				createdAt: String(now),
				round: '0',
				adminHash: poll.adminHash
			})
			.expire(keys.poll(id), POLL_TTL_SECONDS);
		if (poll.listed) tx.zadd(keys.recent, now, id);
		await tx.exec();
		return { poll, adminToken };
	}

	/** Loads a poll, or `null` if it does not exist or has expired. */
	async get(id: string): Promise<StoredPoll | null> {
		return parsePoll(id, await this.redis.hgetall(keys.poll(id)));
	}

	/** Current vote totals for a poll. */
	async results(poll: Pick<PublicPoll, 'id' | 'options'>): Promise<Results> {
		return tallyResults(poll.options.length, await this.redis.hgetall(keys.votes(poll.id)));
	}

	/**
	 * Records a ballot whose choices were already checked with `checkChoices`.
	 * `round` must be the round the voter saw, so votes racing a reset are rejected.
	 */
	async vote(
		id: string,
		round: number,
		choices: readonly number[],
		now = Date.now()
	): Promise<VoteOutcome> {
		const outcome = await this.redis.eval(
			VOTE_SCRIPT,
			2,
			keys.poll(id),
			keys.votes(id),
			String(now),
			String(round),
			...choices.map(String)
		);
		return outcome as VoteOutcome;
	}

	/** Stops voting immediately. */
	async close(id: string, now = Date.now()): Promise<void> {
		await this.redis.hset(keys.poll(id), 'closedAt', String(now));
	}

	/** Re-opens a manually closed poll. A passed deadline is cleared too. */
	async reopen(id: string): Promise<void> {
		await this.redis.hset(keys.poll(id), { closedAt: '', closesAt: '' });
	}

	/** Deletes every vote and starts a new round so previous voters can vote again. */
	async reset(id: string): Promise<void> {
		await this.redis.multi().del(keys.votes(id)).hincrby(keys.poll(id), 'round', 1).exec();
	}

	/** Most recent listed polls that still exist, newest first. */
	async recent(limit = 12): Promise<Array<PublicPoll & { voters: number }>> {
		const cutoff = Date.now() - POLL_TTL_SECONDS * 1000;
		await this.redis.zremrangebyscore(keys.recent, '-inf', cutoff);
		const ids = await this.redis.zrevrange(keys.recent, 0, limit * 2 - 1);
		if (ids.length === 0) return [];
		const pipeline = this.redis.pipeline();
		for (const id of ids) pipeline.hgetall(keys.poll(id)).hget(keys.votes(id), 'voters');
		const replies = (await pipeline.exec()) ?? [];
		const polls: Array<PublicPoll & { voters: number }> = [];
		const missing: string[] = [];
		ids.forEach((id, i) => {
			const hash = replies[i * 2]?.[1] as Record<string, string> | undefined;
			const voters = replies[i * 2 + 1]?.[1] as string | null | undefined;
			const poll = hash ? parsePoll(id, hash) : null;
			if (poll) polls.push({ ...toPublic(poll), voters: Number(voters ?? 0) });
			else missing.push(id);
		});
		if (missing.length > 0) await this.redis.zrem(keys.recent, ...missing);
		return polls.slice(0, limit);
	}

	/** Returns `true` if at least one poll exists. */
	async any(): Promise<boolean> {
		let cursor = '0';
		do {
			const [next, found] = await this.redis.scan(cursor, 'MATCH', 'qp:poll:*', 'COUNT', 500);
			if (found.some((key) => !key.endsWith(':votes'))) return true;
			cursor = next;
		} while (cursor !== '0');
		return false;
	}

	/** Publishes the poll's current state to every process subscribed to it. */
	async publish(id: string): Promise<void> {
		const poll = await this.get(id);
		if (!poll) return;
		const event: PollEvent = {
			results: await this.results(poll),
			closed: isClosed(poll),
			round: poll.round
		};
		await this.redis.publish(keys.channel(id), JSON.stringify(event));
	}
}

let store: PollStore | undefined;

/** Process-wide poll store using the shared Redis connection. */
export function getPollStore(): PollStore {
	store ??= new PollStore(getRedis());
	return store;
}
