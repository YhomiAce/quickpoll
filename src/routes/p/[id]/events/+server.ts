import { error } from '@sveltejs/kit';
import { isClosed } from '$lib/poll-rules';
import { readBallot } from '$lib/server/ballot';
import { subscribeToPoll } from '$lib/server/events';
import { getPollStore, type PollEvent } from '$lib/server/polls';
import { verifyAdminToken } from '$lib/server/tokens';
import { pollIdSchema } from '$lib/server/validation';
import type { LiveUpdate } from '$lib/types';
import type { RequestHandler } from './$types';

const HEARTBEAT_MS = 15_000;

/**
 * Server-sent events stream of a poll's results. Updates arrive through Redis
 * pub/sub, so votes handled by any process are pushed to every viewer.
 * Results are withheld from visitors who have not voted on a "hide results" poll,
 * unless the request carries the poll's admin token (`?admin=<token>`).
 */
export const GET: RequestHandler = async ({ params, cookies, request, url }) => {
	if (!pollIdSchema.safeParse(params.id).success) error(404, 'Not found');
	const store = getPollStore();
	const poll = await store.get(params.id);
	if (!poll) error(404, 'Not found');

	const isAdmin = verifyAdminToken(url.searchParams.get('admin') ?? '', poll.adminHash);
	const votedRound = readBallot(cookies, poll)?.round ?? null;
	const toUpdate = (event: PollEvent): LiveUpdate => {
		const visible =
			isAdmin || !poll.hideResults || event.closed || votedRound === event.round;
		return {
			results: visible ? event.results : null,
			voters: event.results.voters,
			closed: event.closed,
			round: event.round
		};
	};

	const encoder = new TextEncoder();
	let cleanup = () => {};

	const stream = new ReadableStream<Uint8Array>({
		async start(controller) {
			let open = true;
			const send = (chunk: string) => {
				if (!open) return;
				try {
					controller.enqueue(encoder.encode(chunk));
				} catch {
					cleanup();
				}
			};
			const sendUpdate = (event: PollEvent) => send(`data: ${JSON.stringify(toUpdate(event))}\n\n`);

			const unsubscribe = await subscribeToPoll(poll.id, sendUpdate);
			const heartbeat = setInterval(() => send(': ping\n\n'), HEARTBEAT_MS);
			cleanup = () => {
				if (!open) return;
				open = false;
				clearInterval(heartbeat);
				unsubscribe();
				try {
					controller.close();
				} catch {
					// already closed by the client
				}
			};
			request.signal.addEventListener('abort', () => cleanup(), { once: true });

			send('retry: 3000\n\n');
			sendUpdate({ results: await store.results(poll), closed: isClosed(poll), round: poll.round });
		},
		cancel() {
			cleanup();
		}
	});

	return new Response(stream, {
		headers: {
			'content-type': 'text/event-stream; charset=utf-8',
			'cache-control': 'no-cache, no-transform',
			connection: 'keep-alive',
			'x-accel-buffering': 'no'
		}
	});
};
