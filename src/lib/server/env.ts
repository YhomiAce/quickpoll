import { env as rawEnv } from '$env/dynamic/private';
import { z } from 'zod';

const schema = z.object({
	REDIS_URL: z
		.string({ error: 'REDIS_URL is required, e.g. redis://localhost:6379/0' })
		.regex(/^rediss?:\/\//, 'REDIS_URL must start with redis:// or rediss://'),
	COOKIE_SECRET: z
		.string({ error: 'COOKIE_SECRET is required (32+ random characters)' })
		.min(32, 'COOKIE_SECRET must be at least 32 characters long'),
	VOTE_RATE_LIMIT: z.coerce.number().int().positive().default(60),
	ORIGIN: z.url().optional()
});

/** Validated runtime configuration. */
export type Env = z.infer<typeof schema>;

let cached: Env | undefined;

/**
 * Returns the validated environment, parsing it on first use.
 * Throws a readable error listing every invalid variable.
 */
export function getEnv(): Env {
	if (cached) return cached;
	const parsed = schema.safeParse(rawEnv);
	if (!parsed.success) {
		const lines = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`);
		throw new Error(`Invalid environment configuration:\n${lines.join('\n')}`);
	}
	cached = parsed.data;
	return cached;
}
