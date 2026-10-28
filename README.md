# quickpoll

Live polls for meetings and classes. Create a poll in seconds, put the QR code on the projector
and watch the bars move as people vote.

## Features

- **Create a poll** with a question, 2 to 10 options, single or multiple choice, an optional
  close time ("close after N minutes") and a "hide results until I vote" switch.
- **Two links per poll:** a public link to share, and a private **admin link** (with a secret
  token) to close, reopen or reset the poll. Only a SHA-256 hash of the token is stored.
- **One vote per browser**, enforced with an HMAC-signed cookie, plus a **per-IP rate limit**.
- **Live results:** animated bars update in real time over **server-sent events**. Updates go
  through **Redis pub/sub**, so it works with several app processes or containers.
- **QR code** for the poll link on the poll page, for projecting in a room.
- **Closed polls** (closed by the admin or past their deadline) show the final results to everyone.
- **Landing page** with the create form and the most recent public polls.
- **Redis only:** polls are hashes, votes are `HINCRBY` counters, and everything expires after 30 days.
- Two sample polls with votes are created on first start if no polls exist.

Built with SvelteKit 3 (Svelte 5 runes, adapter-node), TypeScript, ioredis and zod.

## Local development

Requirements: Node.js 22+ and a Redis server.

```sh
npm install
cp .env.example .env   # then set REDIS_URL and COOKIE_SECRET
npm run dev            # http://localhost:5112
```

Other scripts:

| Command         | What it does                                                        |
| --------------- | ------------------------------------------------------------------- |
| `npm run build` | Production build into `build/` (`vite build`)                       |
| `npm start`     | Runs the production build (`node build`)                            |
| `npm test`      | Vitest unit tests (Redis tests are skipped if Redis is not running) |
| `npm run check` | Type-checks the project with `svelte-check`                         |

The Redis integration tests use `TEST_REDIS_URL` (default `redis://127.0.0.1:56379/3`).

## Environment variables

| Name              | Required               | Example                             | Build or runtime | Notes |
| ----------------- | ---------------------- | ----------------------------------- | ---------------- | ----- |
| `REDIS_URL`       | yes                    | `redis://localhost:6379/0`          | runtime          | Redis connection string (`redis://` or `rediss://`). |
| `COOKIE_SECRET`   | yes                    | output of `openssl rand -base64 32` | runtime          | At least 32 characters. Signs the "already voted" cookies. Changing it lets everyone vote again. |
| `ORIGIN`          | yes in production      | `https://polls.example.com`         | runtime          | Public URL of the app. Form posts (create, vote, close) whose `Origin` header differs are rejected with 403. Also used for share links, QR codes and the cookie `Secure` flag. Read by the app at runtime (see below). |
| `PORT`            | no (default `3000`)    | `3000`                              | runtime          | Port to listen on. |
| `HOST`            | no (default `0.0.0.0`) | `0.0.0.0`                           | runtime          | Interface to listen on. Keep `0.0.0.0` in containers. |
| `PROTOCOL_HEADER` | no                     | `x-forwarded-proto`                 | runtime          | Used when `ORIGIN` is unset: read the protocol from this proxy header. Without it the protocol is assumed to be `https`. |
| `HOST_HEADER`     | no                     | `x-forwarded-host`                  | runtime          | Used when `ORIGIN` is unset: read the host from this proxy header instead of `Host`. |
| `ADDRESS_HEADER`  | no                     | `x-forwarded-for`                   | runtime          | Header holding the client IP, used by the rate limit behind a proxy. |
| `XFF_DEPTH`       | no                     | `1`                                 | runtime          | Number of trusted proxies when `ADDRESS_HEADER=x-forwarded-for`. |
| `VOTE_RATE_LIMIT` | no (default `60`)      | `120`                               | runtime          | Maximum votes per IP per minute. Raise it if a whole class shares one NAT address. |

No variables are needed at build time.

`PORT`, `HOST`, `PROTOCOL_HEADER`, `HOST_HEADER`, `ADDRESS_HEADER` and `XFF_DEPTH` are read by
[`@sveltejs/adapter-node`](https://svelte.dev/docs/kit/adapter-node). The app's own variables are
declared in `src/env.ts` and read from `$app/env/private` when the server starts.

A note on `ORIGIN` in SvelteKit 3: adapter-node no longer reads an `ORIGIN` env var. SvelteKit only
knows the origin from the build-time `paths.origin` option or from request headers (`Host`, plus
`PROTOCOL_HEADER`, defaulting to `https`). So quickpoll turns off SvelteKit's built-in form CSRF check
and runs the same check in `src/hooks.server.ts`, comparing against `ORIGIN` at runtime when it is
set and against the header-derived origin otherwise. Changing `ORIGIN` needs a restart, not a rebuild.

## Deploying

```sh
npm ci           # install
npm run build    # build into build/
npm start        # start: node build
```

- **Port:** `PORT` (default `3000`). Listens on `HOST=0.0.0.0` (the default).
- **Build-time env vars:** none.
- **Runtime env vars:** `REDIS_URL`, `COOKIE_SECRET` and `ORIGIN` (required), plus the optional
  ones in the table above.
- **Health check:** `GET /api/health` returns `200 {"status":"ok"}` when Redis answers `PING`,
  otherwise `503`.
- **Migrations:** none. Redis needs no schema. On start, sample polls are seeded if no polls exist
  (guarded by a Redis lock, so this is safe with several instances).

### Behind a reverse proxy (Traefik, nginx, ...)

Set `ORIGIN` to the public URL, for example `ORIGIN=https://polls.example.com`. If it is unset, the
origin is derived from the `Host` header with an assumed `https` protocol. That works behind a
TLS-terminating proxy that keeps the `Host` header, but over plain `http` every form action
(create, vote, close) fails with `403 Cross-site POST form submissions are forbidden`.

If the app is served under several hostnames, use the proxy headers instead of `ORIGIN`:

```sh
PROTOCOL_HEADER=x-forwarded-proto
HOST_HEADER=x-forwarded-host
```

For a per-client rate limit behind the proxy, also set `ADDRESS_HEADER=x-forwarded-for` and
`XFF_DEPTH=1`. Otherwise every request looks like it comes from the proxy's IP.

Server-sent events need an unbuffered proxy. The stream sends `X-Accel-Buffering: no` and a
heartbeat every 15 seconds, which works with Traefik and nginx out of the box.

## How it works

| Redis key                      | Type       | Contents |
| ------------------------------ | ---------- | -------- |
| `qp:poll:<id>`                 | hash       | question, options (JSON), flags, close time, round, admin token hash |
| `qp:poll:<id>:votes`           | hash       | one `HINCRBY` counter per option index, plus `voters` |
| `qp:recent`                    | sorted set | public poll ids by creation time |
| `qp:events:<id>`               | channel    | pub/sub channel for live updates |
| `qp:rl:<bucket>:<ip>:<window>` | string     | rate-limit counters (60 s TTL) |

A Lua script records each vote, so the closed and deadline checks and the counter increments
happen atomically. Resetting a poll deletes its counters and bumps its `round`, which makes
existing vote cookies stale so people can vote again.

## License

MIT
