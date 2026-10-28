import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	plugins: [sveltekit()],
	server: { port: 5112, strictPort: true },
	preview: { port: 5112, strictPort: true },
	test: {
		expect: { requireAssertions: true },
		environment: 'node',
		include: ['src/**/*.{test,spec}.ts']
	}
});
