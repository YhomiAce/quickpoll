import adapter from '@sveltejs/adapter-node';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),
	compilerOptions: {
		// Use runes mode everywhere except third-party libraries.
		runes: ({ filename }) => (filename.split(/[/\\]/).includes('node_modules') ? undefined : true)
	},
	kit: {
		// adapter-node reads PORT, HOST, ORIGIN, PROTOCOL_HEADER, HOST_HEADER and
		// ADDRESS_HEADER from the environment at runtime.
		adapter: adapter({ out: 'build' })
	}
};

export default config;
