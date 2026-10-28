import { keys } from './keys';
import type { PollStore } from './polls';
import { getRedis } from './redis';

interface SamplePoll {
	question: string;
	options: string[];
	multiple: boolean;
	/** Ballots to cast, each a list of option indices. */
	ballots: Array<{ choices: number[]; times: number }>;
}

const SAMPLES: SamplePoll[] = [
	{
		question: 'When should we hold the weekly team sync?',
		options: ['Monday 10:00', 'Tuesday 14:00', 'Wednesday 09:30', 'Thursday 16:00'],
		multiple: false,
		ballots: [
			{ choices: [0], times: 4 },
			{ choices: [1], times: 9 },
			{ choices: [2], times: 6 },
			{ choices: [3], times: 2 }
		]
	},
	{
		question: 'Which topics should we cover in the next class?',
		options: ['Recursion', 'Hash maps', 'Graph traversal', 'Dynamic programming', 'Big-O review'],
		multiple: true,
		ballots: [
			{ choices: [0, 3], times: 5 },
			{ choices: [2], times: 4 },
			{ choices: [1, 2, 4], times: 3 },
			{ choices: [3], times: 6 },
			{ choices: [0, 2, 3], times: 2 }
		]
	}
];

/**
 * Creates two public sample polls with votes when no polls exist yet.
 * Idempotent and safe to run from several processes at once (guarded by a Redis lock).
 * Returns the number of polls created.
 */
export async function seedIfEmpty(store: PollStore): Promise<number> {
	if (await store.any()) return 0;
	const locked = await getRedis().set(keys.seedLock, String(process.pid), 'EX', 60, 'NX');
	if (locked !== 'OK') return 0;
	try {
		if (await store.any()) return 0;
		const now = Date.now();
		for (const [index, sample] of SAMPLES.entries()) {
			const { poll } = await store.create(
				{
					question: sample.question,
					options: sample.options,
					multiple: sample.multiple,
					hideResults: false,
					listed: true,
					closeAfterMinutes: null
				},
				now - (SAMPLES.length - index) * 60_000
			);
			for (const ballot of sample.ballots) {
				for (let i = 0; i < ballot.times; i++) await store.vote(poll.id, 0, ballot.choices);
			}
		}
		return SAMPLES.length;
	} finally {
		await getRedis().del(keys.seedLock);
	}
}
