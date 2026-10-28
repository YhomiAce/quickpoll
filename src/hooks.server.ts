import type { Handle, HandleServerError, ServerInit } from '@sveltejs/kit/hooks';
import { getEnv } from '#lib/server/env.ts';
import { isCrossSiteFormSubmission, publicOrigin } from '#lib/server/origin.ts';
import { getPollStore } from '#lib/server/polls.ts';
import { closeRedis, getRedis } from '#lib/server/redis.ts';
import { seedIfEmpty } from '#lib/server/seed.ts';

/** Validates configuration, checks Redis and seeds sample polls on startup. */
export const init: ServerInit = async () => {
	const env = getEnv();
	if (process.env.NODE_ENV === 'production' && !env.ORIGIN) {
		console.warn(
			'[quickpoll] ORIGIN is not set; the origin is derived from the Host header (and ' +
				'PROTOCOL_HEADER, default https). Set ORIGIN to the public URL to be explicit.'
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

/** Rejects cross-site form submissions and adds conservative security headers. */
export const handle: Handle = async ({ event, resolve }) => {
	if (isCrossSiteFormSubmission(event.request, publicOrigin(event.url))) {
		const message = `Cross-site ${event.request.method} form submissions are forbidden`;
		return event.request.headers.get('accept') === 'application/json'
			? Response.json({ message }, { status: 403 })
			: new Response(message, { status: 403 });
	}
	const response = await resolve(event);
	response.headers.set('X-Content-Type-Options', 'nosniff');
	response.headers.set('X-Frame-Options', 'DENY');
	if (!response.headers.has('Referrer-Policy')) {
		response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
	}
	return response;
};

/**
 * Keeps SvelteKit's safe messages for app and framework errors (404, 415, ...) and
 * replaces unexpected errors with a generic message after logging them.
 */
export const handleError: HandleServerError = (caught) => {
	if (caught.kind !== 'unknown') return;
	console.error(`[quickpoll] ${caught.event.request.method} ${caught.event.url.pathname}`, caught.error);
	return { message: 'Something went wrong. Please try again.' };
};
