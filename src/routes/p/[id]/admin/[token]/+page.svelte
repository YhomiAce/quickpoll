<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { page } from '$app/state';
	import ResultsBars from '$lib/components/ResultsBars.svelte';
	import ShareBox from '$lib/components/ShareBox.svelte';
	import { connectLive } from '$lib/live';
	import type { Results } from '$lib/types';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let liveResults = $state<Results | null>(null);
	const results = $derived(liveResults ?? data.results);
	let copied = $state(false);

	// The admin token makes the stream include results even on "hide results" polls.
	$effect(() => {
		const id = data.poll.id;
		const round = data.poll.round;
		const wasClosed = data.closed;
		liveResults = null;
		return connectLive(
			id,
			(update) => {
				if (update.round !== round || update.closed !== wasClosed) void invalidateAll();
				else if (update.results) liveResults = update.results;
			},
			page.params.token
		);
	});

	async function copyAdmin() {
		await navigator.clipboard.writeText(data.adminUrl);
		copied = true;
		setTimeout(() => (copied = false), 1500);
	}

	function confirmSubmit(message: string) {
		return ({ cancel }: { cancel: () => void }) => {
			if (!confirm(message)) cancel();
		};
	}
</script>

<svelte:head>
	<title>Admin &middot; {data.poll.question}</title>
	<meta name="robots" content="noindex" />
</svelte:head>

{#if data.created}
	<div class="card notice">
		<strong>Your poll is ready.</strong> Save the admin link below: it is the only way to close or reset
		this poll, and it will not be shown again.
	</div>
{/if}

<div class="layout">
	<section class="card">
		<div class="status">
			<span class="pill">admin</span>
			{#if data.closed}<span class="pill closed">closed</span>{:else}<span class="pill">live</span>{/if}
		</div>
		<h1>{data.poll.question}</h1>
		<ResultsBars options={data.poll.options} {results} />

		<div class="controls">
			<a class="button" href="/p/{data.poll.id}">Open voting page</a>
			{#if data.closed}
				<form method="POST" action="?/reopen" use:enhance>
					<button class="secondary">Reopen poll</button>
				</form>
			{:else}
				<form
					method="POST"
					action="?/close"
					use:enhance={confirmSubmit('Close this poll? Voting stops immediately.')}
				>
					<button class="secondary">Close poll</button>
				</form>
			{/if}
			<form
				method="POST"
				action="?/reset"
				use:enhance={confirmSubmit('Delete all votes and start over?')}
			>
				<button class="danger">Reset votes</button>
			</form>
		</div>

		<div class="admin-link">
			<label for="admin-url">Admin link (keep it secret)</label>
			<div class="row">
				<input id="admin-url" type="text" readonly value={data.adminUrl} />
				<button type="button" class="secondary" onclick={copyAdmin}>{copied ? 'Copied!' : 'Copy'}</button>
			</div>
		</div>
	</section>

	<aside class="card">
		<ShareBox url={data.shareUrl} qrSvg={data.qrSvg} label="Public link" />
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
	.notice {
		margin-bottom: 1.5rem;
		border-color: var(--ok);
	}
	.status {
		display: flex;
		gap: 0.5rem;
	}
	h1 {
		margin: 0.5rem 0 1.25rem;
	}
	.controls {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem;
		margin: 1.5rem 0;
	}
	.controls form {
		margin: 0;
	}
	.row {
		display: flex;
		gap: 0.5rem;
		margin-top: 0.3rem;
	}
</style>
