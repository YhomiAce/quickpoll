<script lang="ts">
	interface Props {
		url: string;
		/** SVG markup generated server-side by the `qrcode` package from `url`. */
		qrSvg: string;
		label?: string;
	}

	let { url, qrSvg, label = 'Join this poll' }: Props = $props();
	let copied = $state(false);

	async function copy() {
		await navigator.clipboard.writeText(url);
		copied = true;
		setTimeout(() => (copied = false), 1500);
	}
</script>

<div class="share">
	<h2>{label}</h2>
	<div class="qr" aria-label="QR code for {url}" role="img">
		<!-- eslint-disable-next-line svelte/no-at-html-tags -- trusted server-generated SVG -->
		{@html qrSvg}
	</div>
	<code>{url}</code>
	<button type="button" class="secondary" onclick={copy}>{copied ? 'Copied!' : 'Copy link'}</button>
</div>

<style>
	.share {
		display: grid;
		gap: 0.75rem;
		justify-items: center;
		text-align: center;
	}
	h2 {
		margin: 0;
		font-size: 1.1rem;
	}
	.qr {
		width: 100%;
		max-width: 240px;
	}
	.qr :global(svg) {
		width: 100%;
		height: auto;
	}
	code {
		word-break: break-all;
		font-size: 0.85rem;
	}
</style>
