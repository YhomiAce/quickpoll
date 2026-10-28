import { keys } from './keys';
import { getRedis } from './redis';

/**
 * Fixed-window rate limiter shared across processes through Redis.
 * Returns `true` while `ip` has made at most `limit` requests in the current window.
 * If Redis is unreachable the request is allowed (the vote itself will fail anyway).
 */
export async function allowRequest(
	bucket: string,
	ip: string,
	limit: number,
	windowSeconds = 60
): Promise<boolean> {
	const window = Math.floor(Date.now() / 1000 / windowSeconds);
	const key = keys.rateLimit(bucket, ip, window);
	try {
		const [[, count]] = (await getRedis()
			.multi()
			.incr(key)
			.expire(key, windowSeconds)
			.exec()) as [[Error | null, number], [Error | null, number]];
		return count <= limit;
	} catch {
		return true;
	}
}
