import { COOKIE_SECRET, ORIGIN, REDIS_URL, VOTE_RATE_LIMIT } from '$app/env/private';

/** Validated runtime configuration (formats are checked in `src/env.ts`). */
export interface Env {
	REDIS_URL: string;
	COOKIE_SECRET: string;
	VOTE_RATE_LIMIT: number;
	ORIGIN: string | undefined;
}

let cached: Env | undefined;

/**
 * Returns the runtime configuration. Throws a readable error listing every
 * missing required variable; the server's `init` hook calls this on startup.
 */
export function getEnv(): Env {
	if (cached) return cached;
	const missing: string[] = [];
	if (!REDIS_URL) missing.push('  - REDIS_URL is required, e.g. redis://localhost:6379/0');
	if (!COOKIE_SECRET) missing.push('  - COOKIE_SECRET is required (32+ random characters)');
	if (!REDIS_URL || !COOKIE_SECRET) {
		throw new Error(`Invalid environment configuration:\n${missing.join('\n')}`);
	}
	cached = { REDIS_URL, COOKIE_SECRET, VOTE_RATE_LIMIT, ORIGIN: ORIGIN || undefined };
	return cached;
}
