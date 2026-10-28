import { describe, expect, it } from 'vitest';
import { createPollSchema, voteSchema } from './validation';

const base = { question: 'Lunch?', options: ['Pizza', 'Sushi'] };

describe('createPollSchema', () => {
	it('accepts a minimal poll with defaults', () => {
		expect(createPollSchema.parse(base)).toEqual({
			question: 'Lunch?',
			options: ['Pizza', 'Sushi'],
			multiple: false,
			hideResults: false,
			listed: false,
			closeAfterMinutes: null
		});
	});

	it('drops blank options before counting them', () => {
		const result = createPollSchema.safeParse({ ...base, options: ['Pizza', '  ', ''] });
		expect(result.success).toBe(false);
	});

	it('allows 2 to 10 options', () => {
		const ten = Array.from({ length: 10 }, (_, i) => `Option ${i}`);
		expect(createPollSchema.safeParse({ ...base, options: ten }).success).toBe(true);
		expect(createPollSchema.safeParse({ ...base, options: [...ten, 'Eleven'] }).success).toBe(false);
	});

	it('rejects duplicate options regardless of case', () => {
		expect(createPollSchema.safeParse({ ...base, options: ['Yes', 'yes'] }).success).toBe(false);
	});

	it('reads checkboxes and the close time from form strings', () => {
		const parsed = createPollSchema.parse({
			...base,
			multiple: 'on',
			hideResults: 'on',
			closeAfterMinutes: '15'
		});
		expect(parsed).toMatchObject({ multiple: true, hideResults: true, closeAfterMinutes: 15 });
	});

	it('rejects close times beyond the 30-day lifetime', () => {
		expect(createPollSchema.safeParse({ ...base, closeAfterMinutes: '50000' }).success).toBe(false);
	});
});

describe('voteSchema', () => {
	it('turns form values into option indices', () => {
		expect(voteSchema.parse(['0', '2'])).toEqual([0, 2]);
	});

	it('rejects non-numeric values', () => {
		expect(voteSchema.safeParse(['1; DROP']).success).toBe(false);
	});
});
