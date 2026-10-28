import { describe, expect, it } from 'vitest';
import { isCrossSiteFormSubmission, publicOrigin } from './origin';

const SELF = 'https://polls.example.com';

function post(headers: Record<string, string>, method = 'POST'): Request {
	return new Request('http://internal:3000/p/abc?/vote', { method, headers });
}

describe('publicOrigin', () => {
	it('prefers the ORIGIN setting over the request URL', () => {
		expect(publicOrigin(new URL('http://10.0.0.5:3000/x'), 'https://polls.example.com/')).toBe(SELF);
	});

	it('falls back to the request origin when ORIGIN is empty', () => {
		expect(publicOrigin(new URL('https://a.example/x?y'), '')).toBe('https://a.example');
	});
});

describe('isCrossSiteFormSubmission', () => {
	const form = { 'content-type': 'application/x-www-form-urlencoded' };

	it('allows form posts from the public origin', () => {
		expect(isCrossSiteFormSubmission(post({ ...form, origin: SELF }), SELF)).toBe(false);
	});

	it('rejects form posts from another origin or without an Origin header', () => {
		expect(isCrossSiteFormSubmission(post({ ...form, origin: 'https://evil.example' }), SELF)).toBe(true);
		expect(isCrossSiteFormSubmission(post({ ...form, origin: 'http://polls.example.com' }), SELF)).toBe(true);
		expect(isCrossSiteFormSubmission(post(form), SELF)).toBe(true);
	});

	it('checks multipart and missing content types too', () => {
		const multipart = { 'content-type': 'multipart/form-data; boundary=x', origin: 'https://evil.example' };
		expect(isCrossSiteFormSubmission(post(multipart), SELF)).toBe(true);
		expect(isCrossSiteFormSubmission(post({ origin: 'https://evil.example' }), SELF)).toBe(true);
	});

	it('ignores safe methods and non-form content types', () => {
		expect(isCrossSiteFormSubmission(new Request('http://x/'), SELF)).toBe(false);
		const json = { 'content-type': 'application/json', origin: 'https://evil.example' };
		expect(isCrossSiteFormSubmission(post(json), SELF)).toBe(false);
	});
});
