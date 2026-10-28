<script lang="ts">
	import { enhance } from '$app/forms';
	import { MAX_OPTIONS, MIN_OPTIONS } from '#lib/poll-rules.ts';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	const initialOptions = (): string[] => {
		const previous = form?.values?.options ?? [];
		const list = [...previous];
		while (list.length < 3) list.push('');
		return list.slice(0, MAX_OPTIONS);
	};

	let options = $state(initialOptions());
	let submitting = $state(false);

	function addOption() {
		if (options.length < MAX_OPTIONS) options.push('');
	}

	function removeOption(index: number) {
		if (options.length > MIN_OPTIONS) options.splice(index, 1);
	}

	function ago(timestamp: number): string {
		const minutes = Math.round((Date.now() - timestamp) / 60_000);
		if (minutes < 1) return 'just now';
		if (minutes < 60) return `${minutes} min ago`;
		const hours = Math.round(minutes / 60);
		if (hours < 24) return `${hours} h ago`;
		return `${Math.round(hours / 24)} d ago`;
	}

	const isClosed = (p: { closesAt: number | null; closedAt: number | null }) =>
		p.closedAt !== null || (p.closesAt !== null && p.closesAt <= Date.now());
</script>

<svelte:head>
	<title>quickpoll &middot; live polls for meetings and classes</title>
	<meta name="description" content="Create a live poll in seconds and watch the votes come in." />
</svelte:head>

<div class="layout">
	<section class="card">
		<h1>Create a poll</h1>
		<form
			method="POST"
			action="?/create"
			use:enhance={() => {
				submitting = true;
				return async ({ update }) => {
					await update({ reset: false });
					submitting = false;
				};
			}}
		>
			<div class="field">
				<label for="question">Question</label>
				<input
					id="question"
					name="question"
					type="text"
					required
					maxlength="200"
					placeholder="What should we discuss first?"
					value={form?.values?.question ?? ''}
				/>
				{#if form?.errors?.question}<p class="error">{form.errors.question}</p>{/if}
			</div>

			<fieldset class="field">
				<legend>Options</legend>
				{#each options as _, i (i)}
					<div class="option-row">
						<input
							type="text"
							name="option"
							maxlength="100"
							placeholder="Option {i + 1}"
							aria-label="Option {i + 1}"
							bind:value={options[i]}
						/>
						<button
							type="button"
							class="secondary icon"
							aria-label="Remove option {i + 1}"
							disabled={options.length <= MIN_OPTIONS}
							onclick={() => removeOption(i)}>&times;</button
						>
					</div>
				{/each}
				<button
					type="button"
					class="secondary"
					disabled={options.length >= MAX_OPTIONS}
					onclick={addOption}>Add option</button
				>
				{#if form?.errors?.options}<p class="error">{form.errors.options}</p>{/if}
			</fieldset>

			<div class="field checks">
				<label
					><input type="checkbox" name="multiple" checked={form?.values?.multiple ?? false} /> Allow
					multiple choices</label
				>
				<label
					><input type="checkbox" name="hideResults" checked={form?.values?.hideResults ?? false} />
					Hide results until I vote</label
				>
				<label
					><input type="checkbox" name="listed" checked={form?.values?.listed ?? true} /> List on the
					landing page</label
				>
			</div>

			<div class="field">
				<label for="closeAfterMinutes">Close after (minutes, optional)</label>
				<input
					id="closeAfterMinutes"
					name="closeAfterMinutes"
					type="number"
					min="1"
					max="43200"
					placeholder="No deadline"
					value={form?.values?.closeAfterMinutes ?? ''}
				/>
				{#if form?.errors?.closeAfterMinutes}<p class="error">{form.errors.closeAfterMinutes}</p>{/if}
			</div>

			{#if form?.errors?.form}<p class="error">{form.errors.form}</p>{/if}
			<button type="submit" disabled={submitting}>{submitting ? 'Creating…' : 'Create poll'}</button>
		</form>
	</section>

	<section>
		<h2>Recent public polls</h2>
		{#if data.recent.length === 0}
			<p class="muted">No public polls yet. Be the first!</p>
		{:else}
			<ul class="recent">
				{#each data.recent as poll (poll.id)}
					<li class="card">
						<a href="/p/{poll.id}">{poll.question}</a>
						<div class="meta muted">
							{poll.voters}
							{poll.voters === 1 ? 'vote' : 'votes'} &middot; {ago(poll.createdAt)}
							{#if poll.multiple}<span class="pill">multiple choice</span>{/if}
							{#if isClosed(poll)}<span class="pill closed">closed</span>{/if}
						</div>
					</li>
				{/each}
			</ul>
		{/if}
	</section>
</div>

<style>
	.layout {
		display: grid;
		grid-template-columns: minmax(0, 3fr) minmax(0, 2fr);
		gap: 1.5rem;
		align-items: start;
	}
	@media (max-width: 760px) {
		.layout {
			grid-template-columns: 1fr;
		}
	}
	h1 {
		margin-top: 0;
	}
	.field {
		margin-bottom: 1.1rem;
	}
	fieldset {
		border: 0;
		padding: 0;
		margin-left: 0;
		margin-right: 0;
	}
	legend {
		font-weight: 600;
		margin-bottom: 0.4rem;
	}
	.option-row {
		display: flex;
		gap: 0.5rem;
		margin-bottom: 0.5rem;
	}
	.icon {
		padding: 0.4rem 0.8rem;
	}
	.checks {
		display: grid;
		gap: 0.35rem;
	}
	.checks label {
		font-weight: 400;
	}
	.recent {
		list-style: none;
		padding: 0;
		display: grid;
		gap: 0.75rem;
	}
	.recent a {
		font-weight: 600;
		color: var(--text);
	}
	.meta {
		font-size: 0.9rem;
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
		align-items: center;
	}
</style>
