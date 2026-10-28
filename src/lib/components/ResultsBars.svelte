<script lang="ts">
	import { percentages } from '#lib/poll-rules.ts';
	import type { Results } from '#lib/types.ts';

	interface Props {
		options: string[];
		results: Results;
		/** Options picked by the current visitor, highlighted in the list. */
		highlight?: number[] | null;
	}

	let { options, results, highlight = null }: Props = $props();

	const shares = $derived(percentages(results));
	const top = $derived(Math.max(0, ...results.counts));
</script>

<ul class="bars" aria-live="polite">
	{#each options as option, i (i)}
		<li class:mine={highlight?.includes(i)} class:leading={top > 0 && results.counts[i] === top}>
			<div class="label">
				<span>{option}{#if highlight?.includes(i)}<span class="you">your vote</span>{/if}</span>
				<span class="count">{results.counts[i]} &middot; {shares[i]}%</span>
			</div>
			<div class="track"><div class="fill" style:width="{shares[i]}%"></div></div>
		</li>
	{/each}
</ul>
<p class="muted total">{results.voters} {results.voters === 1 ? 'vote' : 'votes'}</p>

<style>
	.bars {
		list-style: none;
		padding: 0;
		margin: 0;
		display: grid;
		gap: 0.85rem;
	}
	.label {
		display: flex;
		justify-content: space-between;
		gap: 1rem;
		margin-bottom: 0.3rem;
	}
	.count {
		font-variant-numeric: tabular-nums;
		color: var(--muted);
		white-space: nowrap;
	}
	.track {
		height: 0.9rem;
		background: var(--accent-soft);
		border-radius: 999px;
		overflow: hidden;
	}
	.fill {
		height: 100%;
		background: var(--accent);
		opacity: 0.65;
		border-radius: 999px;
		transition: width 0.6s cubic-bezier(0.22, 1, 0.36, 1);
	}
	.leading .fill {
		opacity: 1;
	}
	.you {
		margin-left: 0.5rem;
		font-size: 0.75rem;
		color: var(--ok);
		font-weight: 600;
	}
	.total {
		margin-top: 1rem;
	}
</style>
