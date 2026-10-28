<script lang="ts">
	import { page } from '$app/state';
</script>

<svelte:head><title>{page.status} &middot; quickpoll</title></svelte:head>

<div class="card">
	<h1>{page.status === 404 ? 'Not found' : 'Something went wrong'}</h1>
	<p class="muted">{page.error?.message}</p>
	<a class="button" href="/">Back to quickpoll</a>
</div>
