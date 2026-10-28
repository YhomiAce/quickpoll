import { z } from 'zod';
import { MAX_OPTIONS, MIN_OPTIONS } from '#lib/poll-rules.ts';

const checkbox = z
	.union([z.literal('on'), z.literal('true'), z.literal('1'), z.literal('')])
	.optional()
	.transform((v) => v === 'on' || v === 'true' || v === '1');

/** Schema for the "create a poll" form. */
export const createPollSchema = z.object({
	question: z
		.string()
		.trim()
		.min(3, 'Ask a question of at least 3 characters.')
		.max(200, 'Keep the question under 200 characters.'),
	options: z
		.array(z.string().trim().max(100, 'Keep each option under 100 characters.'))
		.transform((list) => list.filter((o) => o.length > 0))
		.pipe(
			z
				.array(z.string())
				.min(MIN_OPTIONS, `Add at least ${MIN_OPTIONS} options.`)
				.max(MAX_OPTIONS, `Use at most ${MAX_OPTIONS} options.`)
				.refine(
					(list) => new Set(list.map((o) => o.toLowerCase())).size === list.length,
					'Options must be different from each other.'
				)
		),
	multiple: checkbox,
	hideResults: checkbox,
	listed: checkbox,
	closeAfterMinutes: z
		.string()
		.trim()
		.optional()
		.transform((v) => (v ? Number(v) : null))
		.pipe(
			z
				.number({ error: 'Close time must be a number of minutes.' })
				.int('Close time must be a whole number of minutes.')
				.min(1, 'Close time must be at least 1 minute.')
				.max(30 * 24 * 60, 'Polls expire after 30 days, so close within 30 days.')
				.nullable()
		)
});

/** Validated poll creation input. */
export type CreatePollInput = z.infer<typeof createPollSchema>;

/** Field-level error messages for the create form. */
export interface CreatePollErrors {
	question?: string;
	options?: string;
	multiple?: string;
	hideResults?: string;
	listed?: string;
	closeAfterMinutes?: string;
	/** Errors not tied to one field. */
	form?: string;
}

/** Raw text fields of the create form, before validation. */
export interface CreatePollForm {
	question: string;
	options: string[];
	multiple?: string;
	hideResults?: string;
	listed?: string;
	closeAfterMinutes?: string;
}

/** Reads the create form into a plain object suitable for {@link createPollSchema}. */
export function readCreateForm(form: FormData): CreatePollForm {
	const text = (name: string) => {
		const v = form.get(name);
		return typeof v === 'string' ? v : undefined;
	};
	return {
		question: text('question') ?? '',
		options: form.getAll('option').filter((v): v is string => typeof v === 'string'),
		multiple: text('multiple'),
		hideResults: text('hideResults'),
		listed: text('listed'),
		closeAfterMinutes: text('closeAfterMinutes')
	};
}

/** Turns a zod error into one message per form field. */
export function fieldErrors(error: z.ZodError): CreatePollErrors {
	const errors: CreatePollErrors = {};
	for (const issue of error.issues) {
		const field = (issue.path[0] ?? 'form') as keyof CreatePollErrors;
		errors[field] ??= issue.message;
	}
	return errors;
}

/** Schema for the choices submitted with a vote (option indices as strings). */
export const voteSchema = z
	.array(z.string().regex(/^\d{1,2}$/, 'Invalid option.').transform(Number))
	.max(MAX_OPTIONS, 'Too many options.');

/** Route params: poll ids are 8 characters from the id alphabet. */
export const pollIdSchema = z.string().regex(/^[a-zA-Z0-9]{6,16}$/);
