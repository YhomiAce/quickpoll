<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import ResultsBars from '#lib/components/ResultsBars.svelte';
	import ShareBox from '#lib/components/ShareBox.svelte';
	import { connectLive } from '#lib/live.ts';
	import type { LiveUpdate } from '#lib/types.ts';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let live = $state<LiveUpdate | null>(null);
	let submitting = $state(false);
	let picked = $state<number[]>([]);

	const results = $derived(live ? live.results : data.results);
	const voters = $derived(live?.voters ?? data.voters);
	const closed = $derived(live?.closed ?? data.closed);
	const hasVoted = $derived(data.myChoices !== null);

	// (Re)connect the live stream whenever the poll, its round or our ballot changes.
	$effect(() => {
		const id = data.poll.id;
		const round = data.poll.round;
		const wasClosed = data.closed;
		void data.myChoices;
		live = null;
		return connectLive(id, (update) => {
			live = update;
			if (update.round !== round || update.closed !== wasClosed) void invalidateAll();
		});
	});

	// Refresh when the poll's deadline passes so the page switches to final results.
	$effect(() => {
		const closesAt = data.poll.closesAt;
		if (closesAt === null || data.closed) return;
		const delay = closesAt - Date.now();
		if (delay > 2 ** 31 - 1) return;
		const timer = setTimeout(() => void invalidateAll(), Math.max(0, delay) + 500);
		return () => clearTimeout(timer);
	});

	function toggle(index: number) {
		if (!data.poll.multiple) {
			picked = [index];
		} else {
			picked = picked.includes(index) ? picked.filter((i) => i !== index) : [...picked, index];
		}
	}

	const deadline = $derived(
		data.poll.closesAt ? new Date(data.poll.closesAt).toLocaleString() : null
	);
</script>

<svelte:head>
	<title>{data.poll.question} &middot; quickpoll</title>
</svelte:head>

<div class="layout">
	<section class="card poll">
		<div class="status">
			{#if closed}
				<span class="pill closed">closed &middot; final results</span>
			{:else}
				<span class="pill">live</span>
			{/if}
			{#if data.poll.multiple}<span class="pill">pick one or more</span>{/if}
			{#if deadline && !closed}<span class="muted">closes {deadline}</span>{/if}
		</div>
		<h1>{data.poll.question}</h1>

		{#if !closed && !hasVoted}
			<form
				method="POST"
				action="?/vote"
				use:enhance={() => {
					submitting = true;
					return async ({ update }) => {
						await update();
						submitting = false;
						picked = [];
					};
				}}
			>
				<input type="hidden" name="round" value={data.poll.round} />
				<div class="choices">
					{#each data.poll.options as option, i (i)}
						<label class="choice" class:selected={picked.includes(i)}>
							<input
								type={data.poll.multiple ? 'checkbox' : 'radio'}
								name="choice"
								value={i}
								checked={picked.includes(i)}
								onchange={() => toggle(i)}
							/>
							{option}
						</label>
					{/each}
				</div>
				{#if form?.message}<p class="error">{form.message}</p>{/if}
				<button type="submit" disabled={submitting || picked.length === 0}>
					{submitting ? 'Voting…' : 'Vote'}
				</button>
			</form>
		{/if}

		{#if results}
			<div class="results">
				{#if hasVoted && !closed}<p class="thanks">Thanks for voting! Results update live.</p>{/if}
				<ResultsBars options={data.poll.options} {results} highlight={data.myChoices} />
			</div>
		{:else if hasVoted || closed}
			<p class="muted">Loading results…</p>
		{:else}
			<p class="muted hidden-note">
				Results are hidden until you vote. {voters}
				{voters === 1 ? 'person has' : 'people have'} voted so far.
			</p>
		{/if}
	</section>

	<aside class="card">
		<ShareBox url={data.shareUrl} qrSvg={data.qrSvg} />
	</aside>
</div>

<style>
	.layout {
		display: grid;
		grid-template-columns: minmax(0, 2fr) minmax(0, 1fr);
		gap: 1.5rem;
		align-items: start;
	}
	@media (max-width: 760px) {
		.layout {
			grid-template-columns: 1fr;
		}
	}
	h1 {
		margin: 0.5rem 0 1.25rem;
		font-size: 1.8rem;
	}
	.status {
		display: flex;
		gap: 0.5rem;
		flex-wrap: wrap;
		align-items: center;
	}
	.choices {
		display: grid;
		gap: 0.6rem;
		margin-bottom: 1rem;
	}
	.choice {
		display: flex;
		gap: 0.6rem;
		align-items: center;
		padding: 0.75rem 0.9rem;
		border: 1px solid var(--border);
		border-radius: 10px;
		font-weight: 500;
		cursor: pointer;
	}
	.choice.selected {
		border-color: var(--accent);
		background: var(--accent-soft);
	}
	.results {
		margin-top: 1.5rem;
	}
	.thanks {
		color: var(--ok);
		font-weight: 600;
	}
</style>
