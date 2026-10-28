import { describe, expect, it } from 'vitest';
import {
	hashToken,
	newAdminToken,
	newPollId,
	signBallot,
	verifyAdminToken,
	verifyBallot
} from './tokens';

const SECRET = 'test-secret-that-is-at-least-32-characters';

describe('admin tokens', () => {
	it('verifies the token whose hash was stored', () => {
		const token = newAdminToken();
		expect(verifyAdminToken(token, hashToken(token))).toBe(true);
	});

	it('rejects a different token', () => {
		const stored = hashToken(newAdminToken());
		expect(verifyAdminToken(newAdminToken(), stored)).toBe(false);
	});

	it('rejects empty tokens and empty hashes', () => {
		expect(verifyAdminToken('', hashToken(''))).toBe(false);
		expect(verifyAdminToken(newAdminToken(), '')).toBe(false);
	});

	it('generates long, unique, URL-safe tokens', () => {
		const tokens = new Set(Array.from({ length: 50 }, newAdminToken));
		expect(tokens.size).toBe(50);
		for (const token of tokens) expect(token).toMatch(/^[\w-]{32}$/);
	});

	it('generates short, URL-safe poll ids', () => {
		expect(newPollId()).toMatch(/^[a-zA-Z0-9]{8}$/);
	});
});

describe('ballot cookies', () => {
	it('round-trips a signed ballot', () => {
		const value = signBallot('poll1234', { round: 2, choices: [0, 3] }, SECRET);
		expect(verifyBallot('poll1234', value, SECRET)).toEqual({ round: 2, choices: [0, 3] });
	});

	it('rejects a ballot whose choices were edited', () => {
		const value = signBallot('poll1234', { round: 0, choices: [1] }, SECRET);
		expect(verifyBallot('poll1234', value.replace(/^0\.1\./, '0.2.'), SECRET)).toBeNull();
	});

	it('rejects a ballot replayed on another poll', () => {
		const value = signBallot('poll1234', { round: 0, choices: [1] }, SECRET);
		expect(verifyBallot('otherpoll', value, SECRET)).toBeNull();
	});

	it('rejects a ballot signed with another secret', () => {
		const value = signBallot('poll1234', { round: 0, choices: [1] }, `${SECRET}-old`);
		expect(verifyBallot('poll1234', value, SECRET)).toBeNull();
	});

	it('rejects missing and malformed values', () => {
		expect(verifyBallot('poll1234', undefined, SECRET)).toBeNull();
		expect(verifyBallot('poll1234', 'garbage', SECRET)).toBeNull();
		expect(verifyBallot('poll1234', '1.2.short', SECRET)).toBeNull();
	});
});
