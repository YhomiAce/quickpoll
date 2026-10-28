import { Redis } from 'ioredis';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { keys } from './keys';
import { PollStore } from './polls';
import { verifyAdminToken } from './tokens';

/**
 * Integration tests for vote counting in Redis. They use TEST_REDIS_URL
 * (default: the local development Redis, index 3) and are skipped when no
 * Redis server is reachable.
 */
const url = process.env.TEST_REDIS_URL ?? 'redis://127.0.0.1:56379/3';

async function connect(): Promise<Redis | null> {
	const redis = new Redis(url, {
		lazyConnect: true,
		connectTimeout: 2000,
		commandTimeout: 2000,
		maxRetriesPerRequest: 0,
		retryStrategy: () => null
	});
	redis.on('error', () => undefined);
	try {
		await redis.connect();
		await redis.ping();
		return redis;
	} catch {
		redis.disconnect();
		return null;
	}
}

const redis = await connect();
const created: string[] = [];

describe.skipIf(!redis)('PollStore vote counting (Redis)', () => {
	let store: PollStore;

	beforeAll(() => {
		store = new PollStore(redis as Redis);
	});

	afterAll(async () => {
		if (!redis) return;
		for (const id of created) await redis.del(keys.poll(id), keys.votes(id));
		await redis.quit();
	});

	async function newPoll(multiple: boolean, closeAfterMinutes: number | null = null) {
		const result = await store.create({
			question: 'Test poll',
			options: ['A', 'B', 'C'],
			multiple,
			hideResults: false,
			listed: false,
			closeAfterMinutes
		});
		created.push(result.poll.id);
		return result;
	}

	it('stores the poll with a 30-day TTL and only a hash of the admin token', async () => {
		const { poll, adminToken } = await newPoll(false);
		const stored = await store.get(poll.id);
		expect(stored?.question).toBe('Test poll');
		expect(stored?.adminHash).not.toContain(adminToken);
		expect(verifyAdminToken(adminToken, stored?.adminHash ?? '')).toBe(true);
		const ttl = await redis!.ttl(keys.poll(poll.id));
		expect(ttl).toBeGreaterThan(29 * 24 * 3600);
	});

	it('counts single-choice votes per option', async () => {
		const { poll } = await newPoll(false);
		await store.vote(poll.id, 0, [0]);
		await store.vote(poll.id, 0, [0]);
		await store.vote(poll.id, 0, [2]);
		expect(await store.results(poll)).toEqual({ counts: [2, 0, 1], voters: 3 });
		expect(await redis!.ttl(keys.votes(poll.id))).toBeGreaterThan(0);
	});

	it('counts each option of a multiple-choice ballot once and the voter once', async () => {
		const { poll } = await newPoll(true);
		await store.vote(poll.id, 0, [0, 1]);
		await store.vote(poll.id, 0, [1, 2]);
		expect(await store.results(poll)).toEqual({ counts: [1, 2, 1], voters: 2 });
	});

	it('counts concurrent votes without losing any', async () => {
		const { poll } = await newPoll(false);
		await Promise.all(Array.from({ length: 50 }, (_, i) => store.vote(poll.id, 0, [i % 3])));
		const results = await store.results(poll);
		expect(results.voters).toBe(50);
		expect(results.counts.reduce((a, b) => a + b, 0)).toBe(50);
	});

	it('refuses votes once the poll is closed', async () => {
		const { poll } = await newPoll(false);
		await store.close(poll.id);
		expect(await store.vote(poll.id, 0, [0])).toBe('closed');
		expect((await store.results(poll)).voters).toBe(0);
	});

	it('refuses votes after the deadline', async () => {
		const { poll } = await newPoll(false, 1);
		expect(await store.vote(poll.id, 0, [0], Date.now() + 2 * 60_000)).toBe('closed');
	});

	it('clears votes on reset and rejects ballots from the previous round', async () => {
		const { poll } = await newPoll(false);
		await store.vote(poll.id, 0, [1]);
		await store.reset(poll.id);
		expect((await store.results(poll)).voters).toBe(0);
		expect(await store.vote(poll.id, 0, [1])).toBe('stale');
		expect(await store.vote(poll.id, 1, [1])).toBe('ok');
		expect((await store.get(poll.id))?.round).toBe(1);
	});

	it('reports unknown polls', async () => {
		expect(await store.vote('doesnotexist', 0, [0])).toBe('not_found');
	});
});
