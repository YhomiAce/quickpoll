/** Every key and record lives for 30 days, counted from creation. */
export const POLL_TTL_SECONDS = 30 * 24 * 60 * 60;

/** Redis key names, all under the `qp:` prefix. */
export const keys = {
	poll: (id: string) => `qp:poll:${id}`,
	votes: (id: string) => `qp:poll:${id}:votes`,
	channel: (id: string) => `qp:events:${id}`,
	recent: 'qp:recent',
	seedLock: 'qp:seed-lock',
	rateLimit: (bucket: string, ip: string, window: number) => `qp:rl:${bucket}:${ip}:${window}`
} as const;
