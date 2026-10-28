import { fail, redirect } from '@sveltejs/kit';
import { getEnv } from '$lib/server/env';
import { getPollStore } from '$lib/server/polls';
import { allowRequest } from '$lib/server/rate-limit';
import {
	createPollSchema,
	fieldErrors,
	readCreateForm,
	type CreatePollErrors
} from '$lib/server/validation';
import type { Actions, PageServerLoad } from './$types';

/** Landing page: recent public polls. */
export const load: PageServerLoad = async () => {
	const recent = await getPollStore().recent(12);
	return {
		recent: recent.map((p) => ({
			id: p.id,
			question: p.question,
			voters: p.voters,
			options: p.options.length,
			multiple: p.multiple,
			closesAt: p.closesAt,
			closedAt: p.closedAt,
			createdAt: p.createdAt
		}))
	};
};

export const actions: Actions = {
	/** Creates a poll and sends the creator to its admin page. */
	create: async ({ request, getClientAddress }) => {
		const raw = readCreateForm(await request.formData());
		// Echoed back on validation errors so the form keeps what the user typed.
		const values = {
			question: raw.question,
			options: raw.options,
			multiple: raw.multiple === 'on',
			hideResults: raw.hideResults === 'on',
			listed: raw.listed === 'on',
			closeAfterMinutes: raw.closeAfterMinutes ?? ''
		};
		const allowed = await allowRequest(
			'create',
			getClientAddress(),
			Math.max(10, Math.ceil(getEnv().VOTE_RATE_LIMIT / 6))
		);
		if (!allowed) {
			const errors: CreatePollErrors = { form: 'Too many polls created. Wait a minute.' };
			return fail(429, { values, errors });
		}
		const parsed = createPollSchema.safeParse(raw);
		if (!parsed.success) return fail(400, { values, errors: fieldErrors(parsed.error) });

		const { poll, adminToken } = await getPollStore().create(parsed.data);
		redirect(303, `/p/${poll.id}/admin/${adminToken}?created=1`);
	}
};
