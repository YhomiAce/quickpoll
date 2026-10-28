import { getEnv } from './env';

const FORM_CONTENT_TYPES = ['application/x-www-form-urlencoded', 'multipart/form-data', 'text/plain'];
const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * The app's public origin: the `ORIGIN` env var when set (read at runtime), otherwise
 * the origin adapter-node derived from the request (`Host` / `HOST_HEADER`, `PROTOCOL_HEADER`).
 */
export function publicOrigin(url: URL, origin: string | undefined = getEnv().ORIGIN): string {
	return origin ? new URL(origin).origin : url.origin;
}

/**
 * Returns `true` for a cross-site form submission that must be rejected: a mutating
 * request with a form content type (or none) whose `Origin` header is missing or
 * differs from the app's public origin. Mirrors SvelteKit's built-in CSRF check, but
 * compares against {@link publicOrigin} so `ORIGIN` can be configured at runtime.
 */
export function isCrossSiteFormSubmission(request: Request, expectedOrigin: string): boolean {
	if (!MUTATING_METHODS.has(request.method)) return false;
	const contentType = request.headers.get('content-type')?.split(';', 1)[0].trim().toLowerCase();
	if (contentType && !FORM_CONTENT_TYPES.includes(contentType)) return false;
	return request.headers.get('origin') !== expectedOrigin;
}
