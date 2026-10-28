import { json } from '@sveltejs/kit';
import { getRedis } from '#lib/server/redis.ts';
import type { RequestHandler } from './$types';

/** Liveness and readiness: returns 200 when Redis answers PING within 2 seconds. */
export const GET: RequestHandler = async () => {
	const started = Date.now();
	try {
		const reply = await Promise.race([
			getRedis().ping(),
			new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 2000))
		]);
		if (reply !== 'PONG') throw new Error('unexpected reply');
		return json(
			{ status: 'ok', redis: 'ok', latencyMs: Date.now() - started },
			{ headers: { 'cache-control': 'no-store' } }
		);
	} catch {
		return json(
			{ status: 'error', redis: 'unreachable' },
			{ status: 503, headers: { 'cache-control': 'no-store' } }
		);
	}
};
