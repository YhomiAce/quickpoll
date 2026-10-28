import { error, fail } from '@sveltejs/kit';
import QRCode from 'qrcode';
import { checkChoices, isClosed } from '$lib/poll-rules';
import { readBallot, writeBallot } from '$lib/server/ballot';
import { getEnv } from '$lib/server/env';
import { getPollStore, toPublic } from '$lib/server/polls';
import { allowRequest } from '$lib/server/rate-limit';
import { pollIdSchema, voteSchema } from '$lib/server/validation';
import type { Actions, PageServerLoad } from './$types';

async function loadPoll(id: string) {
	if (!pollIdSchema.safeParse(id).success) error(404, 'Poll not found');
	const poll = await getPollStore().get(id);
	if (!poll) error(404, 'Poll not found');
	return poll;
}

/** Poll page: question, ballot state, results (unless hidden) and a QR code. */
export const load: PageServerLoad = async ({ params, cookies, url }) => {
	const poll = await loadPoll(params.id);
	const ballot = readBallot(cookies, poll);
	const closed = isClosed(poll);
	const results = await getPollStore().results(poll);
	const visible = !poll.hideResults || closed || ballot !== null;
	const shareUrl = `${url.origin}/p/${poll.id}`;
	const qrSvg = await QRCode.toString(shareUrl, { type: 'svg', margin: 1, width: 240 });
	return {
		poll: toPublic(poll),
		closed,
		myChoices: ballot?.choices ?? null,
		results: visible ? results : null,
		voters: results.voters,
		shareUrl,
		qrSvg
	};
};

export const actions: Actions = {
	/** Records one ballot per browser, rate limited per IP. */
	vote: async ({ params, request, cookies, url, getClientAddress }) => {
		const poll = await loadPoll(params.id);
		if (!(await allowRequest('vote', getClientAddress(), getEnv().VOTE_RATE_LIMIT))) {
			return fail(429, { message: 'Too many votes from your network. Try again in a minute.' });
		}
		if (isClosed(poll)) return fail(409, { message: 'This poll is closed.' });
		if (readBallot(cookies, poll)) return fail(409, { message: 'You have already voted.' });

		const form = await request.formData();
		const parsed = voteSchema.safeParse(form.getAll('choice'));
		if (!parsed.success) return fail(400, { message: 'Pick a valid option.' });
		const check = checkChoices(poll, parsed.data);
		if (!check.ok) return fail(400, { message: check.reason });

		const roundField = form.get('round');
		const round = typeof roundField === 'string' && /^\d+$/.test(roundField) ? Number(roundField) : poll.round;
		const store = getPollStore();
		const outcome = await store.vote(poll.id, round, check.choices);
		if (outcome === 'not_found') error(404, 'Poll not found');
		if (outcome === 'closed') return fail(409, { message: 'This poll is closed.' });
		if (outcome === 'stale') {
			return fail(409, { message: 'The poll was just reset. Please vote again.' });
		}

		writeBallot(cookies, url, poll.id, { round, choices: check.choices });
		await store.publish(poll.id);
		return { voted: true };
	}
};
