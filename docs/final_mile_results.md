You are patching the AirLock fork of Claw3D after successful Phase 3 state-isolation work.

Current intent: do not make the browser carry the token again. Fix this as a server-config and UI-messaging problem, plus patch the OfficeScreen render loop.

Current status:
- App now boots successfully.
- Core routes return 200.
- Remaining issues are:
  1. upstream gateway connection still requires explicit server-side config/token
  2. frontend runtime bug: `Maximum update depth exceeded` in `OfficeScreen.tsx`
- Do not undo any Phase 2/3 security hardening.

Primary objective:
Restore minimum viable operability while preserving the hardened trust boundary.

Hard rules:
1. Do NOT reintroduce browser-side token handling.
2. Do NOT add gateway token to client-safe env vars or React state/props.
3. Do NOT revert sandbox/state isolation.
4. Keep fixes minimal and debuggable.
5. Prefer server-side explicit config over UI credential entry.

Issues to solve:

## Issue A — Explicit gateway config under sandbox mode
Observed behavior:
- AirLock boots
- gateway connection fails because upstream token/config is missing
- `src/lib/studio/settings-store.ts` currently resolves settings from:
  - sandbox dir if sandbox mode is on
  - otherwise `resolveStateDir(env)`
- `/api/studio` loads/saves settings through `settings-store.ts`

Goal:
Make explicit server-side gateway configuration workable under sandbox mode without reintroducing implicit inheritance.

Tasks:
1. Inspect current `StudioSettings` shape and confirm where `gateway.url` and `gateway.token` are expected.
2. Support a clean explicit server-side config path for sandbox/dev usage.
3. Preferred behavior:
   - if sandbox mode is on and a settings file exists in sandbox path, use it
   - optionally support `OPENCLAW_CONFIG_PATH` as an explicit override if already part of runtime model
   - do NOT expose token in API responses
4. Improve startup/runtime errors so missing gateway config is reported clearly and actionably.
5. If the current UI still prompts for token, change it so the UI reflects:
   - “server-side gateway config missing”
   - not “user must enter token in browser”
6. Keep `/api/studio` sanitized.

Success criteria:
- with explicit server-side settings file present, AirLock can connect upstream
- token remains server-side only
- no browser token props/state/localStorage/network payloads

## Issue B — React maximum update depth in OfficeScreen
Observed browser error:
- `Maximum update depth exceeded`
- points to `OfficeScreen.tsx` around the effect handling `phoneCallByAgentId`

Relevant code pattern:
- effect depends on `phoneCallByAgentId`
- inside it, `setPreparedPhoneCallsByAgentId(...)` is called
- likely causing repeated updates because derived state is recomputed every render even when no effective change occurred

Tasks:
1. Inspect the `useEffect` around the `phoneCallByAgentId` cleanup logic.
2. Determine whether `setPreparedPhoneCallsByAgentId` is firing on every render due to always creating a new object.
3. Patch it safely by avoiding state updates when nothing materially changed.
4. Preferred fix:
   - compare previous vs next filtered result
   - return previous state if unchanged
   - avoid unnecessary object recreation where possible
5. Review nearby effects for similar dependency/state feedback loops.
6. Do not rewrite the whole screen.

Likely target file:
- `src/features/office/screens/OfficeScreen.tsx`

Relevant snippets already known:
- `settings-store.ts` imports `isSandboxMode`, `resolveSandboxDir`, `resolveStateDir`
- `resolveStudioSettingsPath()` currently chooses sandbox dir or state dir
- `/api/studio` GET/PUT loads and saves sanitized settings
- `OfficeScreen.tsx` has an effect that filters phone-call refs and calls `setPreparedPhoneCallsByAgentId(...)`

Deliverables:
1. Minimal code patch for explicit server-side gateway config under sandbox mode
2. Minimal code patch for the `OfficeScreen` render loop
3. Short note explaining:
   - what caused the loop
   - how the gateway config is now expected to work in sandbox mode
4. Any remaining blockers to a clean local test run

Implementation order:
1. Inspect StudioSettings shape and config loading path
2. Patch gateway config/runtime messaging
3. Patch OfficeScreen effect loop
4. Run local sanity checks
5. Summarize remaining blockers

Decision rule:
If forced to choose between convenience and security boundary, preserve the security boundary.

---

## Implementation Notes

### Issue B — React maximum update depth in OfficeScreen

**Root cause**: The effect at `OfficeScreen.tsx:1758` (cleanup of `phoneCallByAgentId` refs) called `setPreparedPhoneCallsByAgentId` with `Object.fromEntries(...)` on every `phoneCallByAgentId` change. Even when the filtered result was structurally identical to the previous state, a new object reference was created. React saw a state change and re-rendered, which could cascade into a feedback loop if other dependencies (like `officeTriggerState`) also changed as a result.

**Fix**: Added a shallow equality check before calling the setter. If the filtered result is shallowly equal to the previous state, return the previous reference to avoid triggering a re-render.

```tsx
setPreparedPhoneCallsByAgentId((previous) => {
  const next = Object.fromEntries(
    Object.entries(previous).filter(([, entry]) => activeKeys.has(entry.requestKey)),
  );
  if (
    Object.keys(previous).length === Object.keys(next).length &&
    Object.keys(previous).every((key) => previous[key] === next[key])
  ) {
    return previous;
  }
  return next;
});
```

### Issue A — Explicit gateway config under sandbox mode

**How it works now in sandbox mode**:

1. `resolveStudioSettingsPath()` checks `OPENCLAW_CONFIG_PATH` first when `isSandboxMode` is true. If that file exists, it uses it as the settings file path directly.
2. `loadStudioSettings()` loads settings from that path. Additionally, if sandbox mode is on and the loaded settings have no gateway URL, it calls `loadGatewayFromOpenClawConfig()` to extract gateway config (`url` + `token`) from the OpenClaw settings file and merges it into the returned `StudioSettings`.
3. `/api/studio` GET returns sanitized settings (token replaced with `tokenConfigured: boolean`).
4. `useGatewayConnection` reads the gateway URL from the sanitized settings and auto-connects. The token stays server-side.
5. `GatewayConnectScreen` now shows "Server-side gateway config missing." when a URL is configured but no token is found, instead of prompting the user to enter a token in the browser.

**Expected behavior in sandbox mode with `OPENCLAW_CONFIG_PATH` set**:
- App boots
- `/api/studio` loads settings from the OpenClaw config file (via `loadStudioSettings`)
- `useGatewayConnection` reads `gateway.url` from settings → auto-connects
- Connection uses server-side token from the config file (never exposed to browser)
- `GatewayConnectScreen` shows "Server-side gateway config missing." only if URL is set but token is absent

### Remaining blockers to clean local test run

1. **`OPENCLAW_CONFIG_PATH` must point to a valid OpenClaw settings file** (`settings.json`) that contains `gateway.url` and `gateway.token`. Without this, the app defaults to `DEFAULT_UPSTREAM_GATEWAY_URL` and will fail to connect.
2. **ESLint config has a pre-existing `excludedFiles` key error** (unrelated to these changes) that prevents `npm run lint` from running.
3. **The upstream gateway must be reachable** at the configured URL.
4. **Device approval** may be required on first connection (`openclaw devices approve --latest`).

---

## Git commands to push

```bash
git add src/lib/studio/settings-store.ts src/features/office/screens/OfficeScreen.tsx src/features/agents/components/GatewayConnectScreen.tsx src/features/agents/screens/AgentsPageScreen.tsx docs/final_mile_results.md && git commit -m "fix: explicit gateway config under sandbox mode + patch OfficeScreen render loop" && git push origin security/state-and-env-isolation-phase3
```
