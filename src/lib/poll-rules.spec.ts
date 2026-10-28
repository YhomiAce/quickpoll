import { describe, expect, it } from 'vitest';
import { checkChoices, isClosed, percentages, tallyResults } from './poll-rules';

const options = ['Red', 'Green', 'Blue'];

describe('checkChoices: single choice', () => {
	const poll = { options, multiple: false };

	it('accepts exactly one valid option', () => {
		expect(checkChoices(poll, [1])).toEqual({ ok: true, choices: [1] });
	});

	it('rejects an empty ballot', () => {
		expect(checkChoices(poll, [])).toMatchObject({ ok: false });
	});

	it('rejects more than one option', () => {
		expect(checkChoices(poll, [0, 2])).toEqual({
			ok: false,
			reason: 'This poll allows only one choice.'
		});
	});

	it('rejects indices outside the option list', () => {
		expect(checkChoices(poll, [3]).ok).toBe(false);
		expect(checkChoices(poll, [-1]).ok).toBe(false);
		expect(checkChoices(poll, [0.5]).ok).toBe(false);
	});
});

describe('checkChoices: multiple choice', () => {
	const poll = { options, multiple: true };

	it('accepts several options and returns them sorted', () => {
		expect(checkChoices(poll, [2, 0])).toEqual({ ok: true, choices: [0, 2] });
	});

	it('accepts every option at once', () => {
		expect(checkChoices(poll, [0, 1, 2])).toEqual({ ok: true, choices: [0, 1, 2] });
	});

	it('rejects duplicates, so one ballot cannot count twice for an option', () => {
		expect(checkChoices(poll, [1, 1])).toEqual({
			ok: false,
			reason: 'Each option can be picked once.'
		});
	});

	it('still requires at least one option', () => {
		expect(checkChoices(poll, []).ok).toBe(false);
	});
});

describe('isClosed', () => {
	const now = 1_000_000;

	it('is open with no deadline and not closed', () => {
		expect(isClosed({ closesAt: null, closedAt: null }, now)).toBe(false);
	});

	it('closes when the admin closes it', () => {
		expect(isClosed({ closesAt: null, closedAt: now - 1 }, now)).toBe(true);
	});

	it('closes once the deadline is reached', () => {
		expect(isClosed({ closesAt: now + 1, closedAt: null }, now)).toBe(false);
		expect(isClosed({ closesAt: now, closedAt: null }, now)).toBe(true);
	});
});

describe('vote counting', () => {
	it('reads counters from the Redis hash, defaulting missing ones to zero', () => {
		expect(tallyResults(3, { '0': '4', '2': '1', voters: '5' })).toEqual({
			counts: [4, 0, 1],
			voters: 5
		});
	});

	it('ignores malformed or negative counters', () => {
		expect(tallyResults(2, { '0': 'abc', '1': '-3', voters: 'x' })).toEqual({
			counts: [0, 0],
			voters: 0
		});
	});

	it('ignores counters for options that do not exist', () => {
		expect(tallyResults(2, { '0': '1', '5': '9', voters: '1' }).counts).toEqual([1, 0]);
	});

	it('computes shares of voters, which can exceed 100% in total for multiple choice', () => {
		expect(percentages({ counts: [3, 1], voters: 4 })).toEqual([75, 25]);
		expect(percentages({ counts: [2, 2], voters: 2 })).toEqual([100, 100]);
	});

	it('returns zero shares when nobody has voted', () => {
		expect(percentages({ counts: [0, 0, 0], voters: 0 })).toEqual([0, 0, 0]);
	});
});
