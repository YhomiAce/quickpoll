<script lang="ts">
	import favicon from '#lib/assets/favicon.svg';
	import '../app.css';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<header class="site-header">
	<a href="/" class="brand">quickpoll</a>
	<span class="tagline">live polls for meetings and classes</span>
</header>

<main>
	{@render children()}
</main>
