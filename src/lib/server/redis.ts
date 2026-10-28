import { Redis } from 'ioredis';
import { getEnv } from './env';

let client: Redis | undefined;
let subscriber: Redis | undefined;

function connect(name: string): Redis {
	const redis = new Redis(getEnv().REDIS_URL, {
		connectionName: `quickpoll-${name}`,
		connectTimeout: 5000,
		maxRetriesPerRequest: 3
	});
	redis.on('error', (err: Error) => console.error(`[redis:${name}] ${err.message}`));
	return redis;
}

/** Shared Redis connection for regular commands. */
export function getRedis(): Redis {
	client ??= connect('main');
	return client;
}

/** Dedicated Redis connection in subscriber mode, used for live updates. */
export function getSubscriber(): Redis {
	subscriber ??= connect('sub');
	return subscriber;
}

/** Closes both connections (used on shutdown and in tests). */
export async function closeRedis(): Promise<void> {
	await Promise.all([client?.quit(), subscriber?.quit()]);
	client = undefined;
	subscriber = undefined;
}
