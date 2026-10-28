import adapter from '@sveltejs/adapter-node';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	plugins: [
		sveltekit({
			compilerOptions: {
				// Use runes mode everywhere except third-party libraries.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},
			// adapter-node reads PORT, HOST, PROTOCOL_HEADER, HOST_HEADER, ADDRESS_HEADER
			// and XFF_DEPTH from the environment at runtime.
			adapter: adapter({ out: 'build' }),
			csrf: {
				// SvelteKit 3 only knows the origin at build time (`paths.origin`) or from
				// request headers. The same check runs in src/hooks.server.ts instead,
				// against the runtime ORIGIN env var when it is set.
				trustedOrigins: ['*']
			}
		})
	],
	server: { port: 5112, strictPort: true },
	preview: { port: 5112, strictPort: true },
	test: {
		expect: { requireAssertions: true },
		environment: 'node',
		include: ['src/**/*.{test,spec}.ts']
	}
});
