import { error, redirect } from '@sveltejs/kit';
import QRCode from 'qrcode';
import { isClosed } from '$lib/poll-rules';
import { getPollStore, toPublic, type StoredPoll } from '$lib/server/polls';
import { verifyAdminToken } from '$lib/server/tokens';
import { pollIdSchema } from '$lib/server/validation';
import type { Actions, PageServerLoad } from './$types';

/** Loads the poll and checks the admin token; unknown polls and bad tokens both 404. */
async function authorize(id: string, token: string): Promise<StoredPoll> {
	if (!pollIdSchema.safeParse(id).success) error(404, 'Poll not found');
	const poll = await getPollStore().get(id);
	if (!poll || !verifyAdminToken(token, poll.adminHash)) error(404, 'Poll not found');
	return poll;
}

/** Admin page: always shows live results, plus the links and controls. */
export const load: PageServerLoad = async ({ params, url, setHeaders }) => {
	setHeaders({ 'cache-control': 'no-store', 'referrer-policy': 'no-referrer' });
	const poll = await authorize(params.id, params.token);
	const shareUrl = `${url.origin}/p/${poll.id}`;
	return {
		poll: toPublic(poll),
		closed: isClosed(poll),
		results: await getPollStore().results(poll),
		shareUrl,
		adminUrl: `${url.origin}/p/${poll.id}/admin/${params.token}`,
		created: url.searchParams.has('created'),
		qrSvg: await QRCode.toString(shareUrl, { type: 'svg', margin: 1, width: 200 })
	};
};

/** Runs an admin operation, broadcasts the new state and reloads the admin page. */
function adminAction(run: (id: string) => Promise<void>) {
	return async ({ params }: { params: { id: string; token: string } }) => {
		const poll = await authorize(params.id, params.token);
		await run(poll.id);
		await getPollStore().publish(poll.id);
		redirect(303, `/p/${poll.id}/admin/${params.token}`);
	};
}

export const actions: Actions = {
	close: adminAction((id) => getPollStore().close(id)),
	reopen: adminAction((id) => getPollStore().reopen(id)),
	reset: adminAction((id) => getPollStore().reset(id))
};
