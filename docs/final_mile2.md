AirLock (Claw3D fork) – Final Mile Gateway Token Fix
Context
Phase 2/3 hardening is done:
No browser-side token handling.
No implicit ~/.openclaw inheritance.
Claw3D boots and core routes return 200.
OpenClaw gateway is reachable at: ws://127.0.0.1:18789.
Server process is started with:
OPENCLAW_CONFIG_PATH=/home/sherlockhums/apps/sludge/settings.json
That file contains valid gateway: { url, token }.
Problem
Claw3D (port 3000) is not using the server-side token when connecting upstream. The /api/gateway/ws bridge behaves as if no token is configured.

Do NOT:

Reintroduce any browser token input.
Use NEXT_PUBLIC_* for tokens.
Put tokens into React state, URL query, or API responses.
Goal
Server-side only:

Read gateway.url + gateway.token from OPENCLAW_CONFIG_PATH.
Use that token when /api/gateway/ws connects to the upstream gateway.
Keep the client limited to /api/gateway/ws with no knowledge of the token.
Tasks
1. Trace the upstream connection path
Follow this chain (adjust filenames if slightly different):

HTTP/WebSocket entrypoint

src/app/api/gateway/... or /api/gateway/ws handler.
Server proxy

server/gateway-proxy.js (or equivalent).
This is where the upstream WebSocket to ws://127.0.0.1:18789 is created.
Settings / config

src/lib/studio/settings-store.ts
/api/studio handler that uses settings-store.ts.
Confirm where StudioSettings.gateway.url and StudioSettings.gateway.token live in memory.

2. Verify token flow
In loadStudioSettings() (or its call chain), confirm:

It reads from OPENCLAW_CONFIG_PATH when sandbox mode is on.
It populates settings.gateway.url and settings.gateway.token.
In the server-side proxy (gateway-proxy.js):

Confirm that you can access the loaded gateway.token at the moment you initiate the upstream WebSocket.
If you can’t, this is where the token is being dropped.
3. Find where the token is lost
Common failure points to check:

settings-store.ts:

Token present when reading from OPENCLAW_CONFIG_PATH, but removed or not persisted into the in-memory StudioSettings object that the proxy actually uses.
/api/studio:

Correct behavior: sanitize responses to the browser.
Wrong behavior: constructing a separate “public” settings shape and then accidentally using that sanitized version on the server.
gateway-proxy.js:

Using only gateway.url and ignoring the gateway.token.
Overwriting config with default values that omit the token.
4. Patch the server-side proxy
In the file that initiates the upstream WebSocket (likely server/gateway-proxy.js):

Ensure you have access to gateway.url and gateway.token from loadStudioSettings() or an equivalent config loader.

When constructing the upstream WebSocket or HTTP request:

Inject the token in headers or protocol-specific auth, e.g.:

jsCopyCopied!
const token = studioSettings.gateway?.token;
const url = studioSettings.gateway?.url || 'ws://127.0.0.1:18789';

const ws = new WebSocket(url, {
  headers: {
    'x-openclaw-gateway-token': token, // or whatever header the gateway expects
  },
});
Do not surface this token anywhere that can get serialized back to the client.

Client behavior must remain:

Connect only to /api/gateway/ws.
No direct connection from browser to upstream gateway.
5. Add minimal server-only logging
In the proxy (around the point you create the upstream WebSocket):

Log only the presence of a token, never its value:
jsCopyCopied!
console.log('[gateway-proxy] upstream connect', {
  hasToken: Boolean(token),
  url,
});
No token string, no partial token, no base64.

UI Behavior Requirements
If server-side token is present:

Gateway connection should auto-establish silently.
No token prompts in the UI.
If token is missing server-side:

Show a message like: “Server-side gateway config missing.”
Do not render forms or inputs asking the user to paste a token.
This should be based on sanitized /api/studio data (e.g., tokenConfigured: boolean), not the raw token.
Success Criteria
/api/gateway/ws successfully proxies an authenticated WebSocket to the OpenClaw gateway using the server-side token.
Claw3D shows a connected / healthy gateway state when the upstream is reachable.
No token appears in:
Browser devtools (network, localStorage, sessionStorage, IndexedDB).
Any API response payloads.
React state or props.
Deliverables for the PR
Minimal code changes:

One patch in the server-side proxy (gateway-proxy.js or equivalent).
Optional small tweaks in settings-store.ts or /api/studio if they’re dropping the token before it reaches the proxy.
Short explanation in the PR description:

Where in the chain the token was being lost (e.g. “proxy was using sanitized settings, which omitted token”).
How the new code now loads and injects the token while keeping it server-side only.
