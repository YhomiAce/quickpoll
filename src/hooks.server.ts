import type { Handle, HandleServerError, ServerInit } from '@sveltejs/kit';
import { getEnv } from '$lib/server/env';
import { getPollStore } from '$lib/server/polls';
import { closeRedis, getRedis } from '$lib/server/redis';
import { seedIfEmpty } from '$lib/server/seed';

/** Validates configuration, checks Redis and seeds sample polls on startup. */
export const init: ServerInit = async () => {
	const env = getEnv();
	if (process.env.NODE_ENV === 'production' && !env.ORIGIN) {
		console.warn(
			'[quickpoll] ORIGIN is not set. Behind a proxy, form actions will fail CSRF checks unless ' +
				'ORIGIN (or PROTOCOL_HEADER and HOST_HEADER) is configured.'
		);
	}
	try {
		await getRedis().ping();
		const created = await seedIfEmpty(getPollStore());
		if (created > 0) console.log(`[quickpoll] seeded ${created} sample polls`);
	} catch (err) {
		console.error(`[quickpoll] Redis is not reachable yet: ${(err as Error).message}`);
	}
	process.once('sveltekit:shutdown', () => {
		closeRedis().catch(() => undefined);
	});
};

/** Adds conservative security headers to every response. */
export const handle: Handle = async ({ event, resolve }) => {
	const response = await resolve(event);
	response.headers.set('X-Content-Type-Options', 'nosniff');
	response.headers.set('X-Frame-Options', 'DENY');
	if (!response.headers.has('Referrer-Policy')) {
		response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
	}
	return response;
};

/**
 * Shows the framework's short message for client errors (404, 415, ...) and a
 * generic message for server errors, which are logged. Never exposes a stack trace.
 */
export const handleError: HandleServerError = ({ error, event, status, message }) => {
	if (status < 500) return { message };
	console.error(`[quickpoll] ${event.request.method} ${event.url.pathname}`, error);
	return { message: 'Something went wrong. Please try again.' };
};
