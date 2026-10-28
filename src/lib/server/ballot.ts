import type { Cookies } from '@sveltejs/kit';
import type { PublicPoll } from '$lib/types';
import { getEnv } from './env';
import { POLL_TTL_SECONDS } from './keys';
import { ballotCookieName, signBallot, verifyBallot, type Ballot } from './tokens';

/**
 * Returns this browser's ballot for the poll's current round, or `null` if it
 * has not voted since the last reset (or the cookie was tampered with).
 */
export function readBallot(cookies: Cookies, poll: Pick<PublicPoll, 'id' | 'round'>): Ballot | null {
	const ballot = verifyBallot(
		poll.id,
		cookies.get(ballotCookieName(poll.id)),
		getEnv().COOKIE_SECRET
	);
	return ballot && ballot.round === poll.round ? ballot : null;
}

/** Stores a signed ballot cookie so this browser cannot vote again this round. */
export function writeBallot(cookies: Cookies, url: URL, pollId: string, ballot: Ballot): void {
	cookies.set(ballotCookieName(pollId), signBallot(pollId, ballot, getEnv().COOKIE_SECRET), {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		secure: url.protocol === 'https:',
		maxAge: POLL_TTL_SECONDS
	});
}
