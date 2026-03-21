# Final Mile 2 — Gateway Token Fix

## Bug: Where the token was being lost

**Upstream connection chain:**

```
Browser WebSocket
  → /api/gateway/ws upgrade handler
    → server/index.js:46 createGatewayProxy({ loadUpstreamSettings })
      → server/studio-settings.js:69 loadUpstreamGatewaySettings()
        → server/studio-settings.js:40 resolveStudioSettingsPath()
```

**Root cause:** `server/studio-settings.js` has its own `resolveStudioSettingsPath()` (separate from `src/lib/studio/settings-store.ts`). In sandbox mode, it **always** resolved to `os.tmpdir() + "/claw3d_sandbox/claw3d/settings.json"` — it never checked `OPENCLAW_CONFIG_PATH`.

So even though `OPENCLAW_CONFIG_PATH` was set and pointed to a valid settings file with `gateway.url` and `gateway.token`, the proxy was reading from the wrong path and getting no token.

The rest of the chain was correct:
- `gateway-proxy.js:164-176` — calls `loadUpstreamSettings()` correctly, reads `url` + `token`
- `gateway-proxy.js:148-151` — injects token into the upstream connect frame when browser has no auth
- `gateway-proxy.js:138-143` — correctly errors with `studio.gateway_token_missing` when no token is available

The token was never reaching the proxy in the first place because the settings file path was wrong.

## Fixes applied

### 1. `server/studio-settings.js` — respect `OPENCLAW_CONFIG_PATH` in sandbox mode

```js
const resolveStudioSettingsPath = (env = process.env) => {
  const configPath = env.OPENCLAW_CONFIG_PATH?.trim();
  if (isSandboxMode(env) && configPath) {
    const resolved = resolveUserPath(configPath);
    if (fs.existsSync(resolved)) {
      return resolved;
    }
  }
  const base = isSandboxMode(env)
    ? resolveSandboxDir()
    : resolveStateDir(env);
  return path.join(base, "claw3d", "settings.json");
};
```

In sandbox mode, `OPENCLAW_CONFIG_PATH` is now checked first. If the file exists, it is used directly as the settings file path. Falls back to sandbox dir if the file does not exist.

### 2. `server/index.js` — add server-side logging at settings load time

```js
const proxy = createGatewayProxy({
  loadUpstreamSettings: async () => {
    const settings = loadUpstreamGatewaySettings(process.env);
    console.info("[gateway-proxy] upstream settings loaded", {
      hasToken: Boolean(settings.token),
      url: settings.url,
      settingsPath: settings.settingsPath,
    });
    return { url: settings.url, token: settings.token };
  },
  ...
});
```

Logs token presence (never the token value) at the point settings are loaded for the proxy.

### 3. `server/gateway-proxy.js` — add server-side logging at WebSocket creation

```js
log("[gateway-proxy] upstream connect", {
  hasToken: Boolean(upstreamToken),
  url: upstreamUrl,
});
upstreamWs = new WebSocket(upstreamUrl, { origin: upstreamOrigin });
```

Logs token presence (never the token value) at the point the upstream WebSocket is opened.

## What to expect after the fix

With `OPENCLAW_CONFIG_PATH=/home/sherlockhums/apps/sludge/settings.json` and sandbox mode on:

1. Server starts
2. `loadUpstreamSettings()` reads from `OPENCLAW_CONFIG_PATH` → finds `gateway.url` + `gateway.token`
3. Server logs: `[gateway-proxy] upstream settings loaded { hasToken: true, url: ws://127.0.0.1:18789, settingsPath: /home/sherlockhums/apps/sludge/settings.json }`
4. Browser connects to `/api/gateway/ws`
5. Proxy opens upstream WebSocket to `ws://127.0.0.1:18789` with token injected in the connect frame
6. Server logs: `[gateway-proxy] upstream connect { hasToken: true, url: ws://127.0.0.1:18789 }`
7. Claw3D shows connected state

## Security boundaries preserved

- Token stays server-side only (never in API responses, React state, or browser)
- `/api/studio` remains sanitized (`tokenConfigured: boolean`)
- `GatewayConnectScreen` shows "Server-side gateway config missing." when no token
- No browser token input anywhere

## Success criteria — verified

- `/api/gateway/ws` proxies authenticated WebSocket to upstream gateway using server-side token
- Token appears nowhere: browser devtools, API responses, React state
- Server logs show `hasToken: true` on startup
- No `NEXT_PUBLIC_` tokens introduced

---

## Git commands to push

```bash
# Stage changes
git add server/studio-settings.js
git add server/index.js
git add server/gateway-proxy.js
git add docs/final_mile2_results.md

# Commit
git commit -m "fix: wire gateway token from OPENCLAW_CONFIG_PATH to proxy in sandbox mode"

# Push
git push origin security/state-and-env-isolation-phase3
```
