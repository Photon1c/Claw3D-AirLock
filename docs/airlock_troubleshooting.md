# AirLock / Claw3D – Gateway Troubleshooting Notes

This document captures what we learned while wiring Claw3D (AirLock) to a local OpenClaw gateway, plus remaining rough edges.

---

## What works

- **Gateway is healthy** and running on the same machine at:

  ```text
  ws://127.0.0.1:18789
  ```

  (This is the same gateway used by the main OpenClaw UI and this chat.)

- **Claw3D dev server** runs on:

  ```text
  http://localhost:3000
  ```

- **Sandbox config path** for AirLock is explicitly set via `.env.local`:

  ```env
  OPENCLAW_CONFIG_PATH=/home/sherlockhums/apps/sludge/settings.json
  AIRLOCK_SANDBOX_MODE=1
  ```

- **Server-side settings file** (`/home/sherlockhums/apps/sludge/settings.json`) is minimal and correct after fixes:

  ```json
  {
    "version": 1,
    "gateway": {
      "url": "ws://127.0.0.1:18789",
      "token": "…"
    },
    "focused": {},
    "avatars": {},
    "deskAssignments": {},
    "analytics": {},
    "voiceReplies": {},
    "standup": {}
  }
  ```

- **AirLock proxy sees the token and config path correctly**. Dev logs confirm:

  ```text
  [gateway-proxy] upstream settings loaded {
    hasToken: true,
    url: 'ws://127.0.0.1:18789',
    settingsPath: '/home/sherlockhums/apps/sludge/settings.json'
  }
  ```

- **React stability fixes**:
  - Patched two `useEffect` loops in `OfficeScreen.tsx`:
    - Phone call cleanup (based on `phoneCallByAgentId`).
    - Text message cleanup (based on `textMessageByAgentId`).
  - Both now:
    - Short-circuit when there are no active requests.
    - Use a key-signature ref to avoid re-running `setState` unless the set of active keys actually changes.
  - Result: “Maximum update depth exceeded” errors are gone when connecting.

---

## What we discovered (root causes so far)

### 1. Wrong protocol in gateway URL

**Symptom:**

- Claw3D server logs showed:

  ```text
  [gateway-proxy] upstream settings loaded {
    hasToken: true,
    url: 'https://127.0.0.1:18789',
    settingsPath: '/home/sherlockhums/apps/sludge/settings.json'
  }
  Upstream gateway WebSocket error. Error: write EPROTO ... tls_get_more_records:packet length too long
  ```

**Cause:**

- `settings.json` had `gateway.url` set to `https://127.0.0.1:18789`, but the local gateway is plain WS on port 18789.
- OpenSSL error `tls_get_more_records: packet length too long` is exactly what you get when you speak TLS to a non-TLS server.

**Fix:**

- Edit `gateway.url` to use `ws://` instead of `https://`:

  ```json
  "gateway": {
    "url": "ws://127.0.0.1:18789",
    "token": "…"
  }
  ```

- Restart Claw3D dev server (`npm run dev`) so the new value is picked up.

---

### 2. React render loops in OfficeScreen

**Symptom:**

- On connect, the Office UI would explode with:

  ```text
  OfficeScreen.tsx:1758/1946 Maximum update depth exceeded.
  ```

- Stack traces pointed at `useEffect` blocks that:
  - Depended on `phoneCallByAgentId` / `textMessageByAgentId`.
  - Called `setPreparedPhoneCallsByAgentId` / `setPreparedTextMessagesByAgentId` every render.

**Root cause:**

- The cleanup effects were always recomputing new objects (and sometimes updating state) even when:
  - There were no active requests, or
  - The set of active request keys hadn’t changed.

**Fix (pattern):**

- For phone calls and text messages:

  ```tsx
  const lastActiveKeysRef = useRef<string | null>(null);

  useEffect(() => {
    const activeKeysArray = Object.values(sourceByAgentId).map((request) => request.key);

    // No active requests: clear refs and bail without touching state.
    if (activeKeysArray.length === 0) {
      promptedKeysRef.current = new Set();
      preparedKeysRef.current = new Set();
      lastActiveKeysRef.current = "";
      return;
    }

    // Avoid touching state if the active key set is unchanged.
    const activeKeysSignature = activeKeysArray.slice().sort().join(",");
    if (lastActiveKeysRef.current === activeKeysSignature) {
      return;
    }
    lastActiveKeysRef.current = activeKeysSignature;

    const activeKeys = new Set(activeKeysArray);

    promptedKeysRef.current = new Set(
      [...promptedKeysRef.current].filter((key) => activeKeys.has(key)),
    );
    preparedKeysRef.current = new Set(
      [...preparedKeysRef.current].filter((key) => activeKeys.has(key)),
    );

    setPreparedEntriesByAgentId((previous) =>
      Object.fromEntries(
        Object.entries(previous).filter(([, entry]) =>
          activeKeys.has(entry.requestKey),
        ),
      ),
    );
  }, [sourceByAgentId]);
  ```

- This makes the effects idempotent and prevents infinite update loops.

---

## Remaining work / open questions

1. **Proxy robustness / URL normalization**

   - Even after fixing `settings.json`, Claw3D occasionally issues both:

     ```text
     GET /api/office/standup/config?gatewayUrl=ws://localhost:18789
     GET /api/office/standup/config?gatewayUrl=https://localhost:18789
     ```

   - The server-side proxy currently trusts `gateway.url` from settings as-is.
   - A future hardening step would be:
     - In sandbox mode, if `gateway.url` looks like `https://localhost:<port>` but we know we’re targeting a local, non-TLS gateway, normalize it to `ws://localhost:<port>` before creating the upstream WebSocket.
     - Or, more generally: prefer `ws://` for `localhost`/`127.0.0.1` unless explicit TLS config is present.

2. **UI status text vs. actual gateway health**

   - `GatewayConnectScreen` uses client-side status to decide between:
     - “No local gateway found.”
     - “Server-side gateway config missing.”
     - “Not connected to a gateway.”
   - There are still edge cases where:
     - The real gateway **is** healthy (this OpenClaw instance), but the AirLock proxy is failing for protocol/config reasons.
     - The UI message can be misleading.
   - Future improvement:
     - Make the UI surface a clearer message when the proxy hit a *server-side* EPROTO/TLS mismatch vs. “no process listening.”

3. **Nice-to-have: small helper doc for future debugging**

   - Keep this file or a similar `docs/airlock_troubleshooting.md` around as the canonical place to:
     - Look up `OPENCLAW_CONFIG_PATH` expectations.
     - Interpret `[gateway-proxy]` logs.
     - Remember the ws vs https gotcha on localhost.

---

## Quick checklist for “why can’t AirLock connect?”

1. Is the gateway actually running on this machine?

   ```bash
   lsof -i:18789 -P -n || ss -tulpn | grep 18789
   ```

2. Does `OPENCLAW_CONFIG_PATH` point to a real JSON file?

   ```bash
   ls $OPENCLAW_CONFIG_PATH
   ```

3. Does that JSON have a `gateway` block with **ws://** and a token?

   ```bash
   sed -n '1,40p' /home/sherlockhums/apps/sludge/settings.json
   ```

4. Does the Claw3D server log show `hasToken: true` and a `ws://` URL?

   ```text
   [gateway-proxy] upstream settings loaded { hasToken: true, url: 'ws://127.0.0.1:18789', ... }
   ```

If all 4 checks pass and the UI still shows “No local gateway found.”, the bug is likely in AirLock’s proxy logic or status wiring, not in the actual gateway or token configuration.
