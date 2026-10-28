import { keys } from './keys';
import type { PollEvent } from './polls';
import { getSubscriber } from './redis';

type Listener = (event: PollEvent) => void;

const listeners = new Map<string, Set<Listener>>();
let wired = false;

function wire(): void {
	if (wired) return;
	wired = true;
	getSubscriber().on('message', (channel: string, message: string) => {
		const set = listeners.get(channel);
		if (!set) return;
		let event: PollEvent;
		try {
			event = JSON.parse(message) as PollEvent;
		} catch {
			return;
		}
		for (const listener of set) listener(event);
	});
}

/**
 * Subscribes to live updates for one poll over Redis pub/sub, so updates
 * published by any process reach every connected browser.
 * Returns a function that removes the listener (and the Redis subscription
 * once nobody in this process listens to the poll any more).
 */
export async function subscribeToPoll(pollId: string, listener: Listener): Promise<() => void> {
	wire();
	const channel = keys.channel(pollId);
	let set = listeners.get(channel);
	if (!set) {
		set = new Set();
		listeners.set(channel, set);
		await getSubscriber().subscribe(channel);
	}
	set.add(listener);
	return () => {
		const current = listeners.get(channel);
		if (!current) return;
		current.delete(listener);
		if (current.size === 0) {
			listeners.delete(channel);
			getSubscriber()
				.unsubscribe(channel)
				.catch(() => undefined);
		}
	};
}
