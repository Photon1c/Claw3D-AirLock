# Agent Instructions

Keep repository instructions generic and safe for open source.

This repo is a frontend for OpenClaw. Keep any OpenClaw runtime checkout separate from this repository.

Do not modify the OpenClaw source code. When the user asks for changes, they are asking for changes to this app. Your solutions should be applied to this app but to understand the full context of implementing your solution, you will need to search through OpenClaw's source code.

If you use local private overlay instructions, keep them outside the repository and do not commit them here.

Do not commit personal, environment-specific, or secret instructions to this repository.

---

## Environment Variable Policy

### Client-Safe Variables (Browser-Bundled)

Only variables prefixed with `NEXT_PUBLIC_` may be accessed in `src/` client modules. These are embedded in the browser bundle at build time.

Allowed `NEXT_PUBLIC_` variables:
- `NEXT_PUBLIC_GATEWAY_URL` — WebSocket gateway URL (no credentials)
- `NEXT_PUBLIC_STUDIO_TRANSCRIPT_V2` — Feature flag (boolean)
- `NEXT_PUBLIC_STUDIO_TRANSCRIPT_DEBUG` — Debug flag (boolean)

### Server-Only Variables

All other environment variables are server-only and MUST NOT be accessed in client code:

- `ELEVENLABS_API_KEY` — ElevenLabs API key
- `ELEVENLABS_VOICE_ID` — Voice configuration
- `ELEVENLABS_MODEL_ID` — Model selection
- `OPENCLAW_PACKAGE_ROOT` — OpenClaw runtime path
- `STUDIO_ACCESS_TOKEN` — Studio access token
- `CORE_DB_*` — Database credentials (if used)
- Any variable without `NEXT_PUBLIC_` prefix

### Rule

Do NOT use `process.env.VARIABLE_NAME` (without `NEXT_PUBLIC_` prefix) in any file under `src/` that is or could be imported by client components.

For server-side access (API routes, server-only modules), all `process.env.*` variables are allowed.

### Enforcement

ESLint rule `no-restricted-globals` with a custom blocklist catches accidental server-var usage in client code. See `.eslintrc.cjs` or `eslint.config.mjs` for the current blocklist.

## Security Boundaries

### Token Handling

1. **Gateway token**: Stored server-side, used only for server-initiated WebSocket connections via `/api/gateway/proxy`. Never exposed to browser JavaScript.
2. **Jira tokens**: Stored in `settings.json` (single-user threat model acknowledged). Future versions should use encrypted storage or server-side session.
3. **API keys** (ElevenLabs): Server-only. All API calls go through Next.js API routes.

### API Response Sanitization

All `/api/*` responses MUST sanitize sensitive fields before returning to client:
- `token` → `tokenConfigured: boolean`
- `apiToken` → `apiTokenConfigured: boolean`
- No raw credentials in JSON responses
