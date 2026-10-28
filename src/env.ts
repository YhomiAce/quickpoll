import { defineEnvVars } from '@sveltejs/kit/env';
import { z } from 'zod';

/**
 * Environment variables, read at runtime (none are inlined at build time) and
 * imported from `$app/env/private`.
 *
 * SvelteKit also validates these during `vite build`, where runtime secrets are
 * usually absent, so required variables are declared optional here and their
 * presence is enforced when the server starts (see `src/lib/server/env.ts`).
 */
export const variables = defineEnvVars({
	REDIS_URL: {
		description: 'Required. Redis connection string, e.g. redis://localhost:6379/0',
		schema: z
			.string()
			.regex(/^rediss?:\/\//, 'REDIS_URL must start with redis:// or rediss://')
			.optional()
	},
	COOKIE_SECRET: {
		description: 'Required. Secret (32+ characters) used to sign the "already voted" cookies',
		schema: z.string().min(32, 'COOKIE_SECRET must be at least 32 characters long').optional()
	},
	ORIGIN: {
		description: 'Public URL of the app, e.g. https://polls.example.com (required in production)',
		schema: z.union([z.url('ORIGIN must be a URL like https://polls.example.com'), z.literal('')]).optional()
	},
	VOTE_RATE_LIMIT: {
		description: 'Maximum votes per IP per minute (default 60)',
		schema: z
			.string()
			.regex(/^\d+$/, 'VOTE_RATE_LIMIT must be a positive whole number')
			.optional()
			.transform((v) => (v ? Number(v) : 60))
			.pipe(z.number().int().positive('VOTE_RATE_LIMIT must be a positive whole number'))
	}
});
