import type { LiveUpdate } from './types';

/**
 * Opens the poll's server-sent events stream and calls `onUpdate` for every
 * message. Returns a function that closes the stream. Browsers reconnect
 * automatically after network errors. Pass the admin token to always receive results.
 */
export function connectLive(
	pollId: string,
	onUpdate: (update: LiveUpdate) => void,
	adminToken?: string
): () => void {
	const query = adminToken ? `?admin=${encodeURIComponent(adminToken)}` : '';
	const source = new EventSource(`/p/${pollId}/events${query}`);
	source.onmessage = (message: MessageEvent<string>) => {
		try {
			onUpdate(JSON.parse(message.data) as LiveUpdate);
		} catch {
			// ignore malformed messages
		}
	};
	return () => source.close();
}
