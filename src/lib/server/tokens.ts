import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

const ID_ALPHABET = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** Generates a short, URL-safe poll id (no look-alike characters). */
export function newPollId(length = 8): string {
	const bytes = randomBytes(length);
	let id = '';
	for (const byte of bytes) id += ID_ALPHABET[byte % ID_ALPHABET.length];
	return id;
}

/** Generates a secret admin token (192 bits, base64url). */
export function newAdminToken(): string {
	return randomBytes(24).toString('base64url');
}

/** Hashes an admin token for storage; only the hash is kept in Redis. */
export function hashToken(token: string): string {
	return createHash('sha256').update(token).digest('hex');
}

/** Constant-time comparison of two equal-length strings. */
function safeEqual(a: string, b: string): boolean {
	const left = Buffer.from(a);
	const right = Buffer.from(b);
	return left.length === right.length && timingSafeEqual(left, right);
}

/** Returns `true` when `token` matches the stored hash. */
export function verifyAdminToken(token: string, storedHash: string): boolean {
	if (!token || !storedHash) return false;
	return safeEqual(hashToken(token), storedHash);
}

/** What the vote cookie remembers about a visitor's ballot. */
export interface Ballot {
	round: number;
	choices: number[];
}

function sign(payload: string, secret: string): string {
	return createHmac('sha256', secret).update(payload).digest('base64url');
}

/**
 * Serialises a ballot into a signed cookie value: `<pollId>.<round>.<choices>.<sig>`.
 * The poll id is part of the signed payload so a cookie cannot be replayed on another poll.
 */
export function signBallot(pollId: string, ballot: Ballot, secret: string): string {
	const body = `${ballot.round}.${ballot.choices.join('-')}`;
	return `${body}.${sign(`${pollId}.${body}`, secret)}`;
}

/** Parses and verifies a ballot cookie. Returns `null` if it is missing, malformed or forged. */
export function verifyBallot(
	pollId: string,
	value: string | undefined,
	secret: string
): Ballot | null {
	if (!value) return null;
	const match = /^(\d{1,6})\.(\d{1,2}(?:-\d{1,2}){0,9})\.([\w-]{43})$/.exec(value);
	if (!match) return null;
	const [, round, choices, signature] = match;
	if (!safeEqual(sign(`${pollId}.${round}.${choices}`, secret), signature)) return null;
	return { round: Number(round), choices: choices.split('-').map(Number) };
}

/** Name of the cookie that records a vote on a poll. */
export function ballotCookieName(pollId: string): string {
	return `qp_${pollId}`;
}
