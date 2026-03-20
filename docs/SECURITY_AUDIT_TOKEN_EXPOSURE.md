# Claw3D Security Audit Report

**Date:** 2026-03-20  
**Scope:** ~/apps/Claw3D - Browser-side token exposure  
**Severity:** High

---

## Executive Summary

The audit confirms tokens are exposed in the browser. The primary issue is a **gateway token stored in browser React state** with no server-side proxying, meaning the raw credential travels to the client and persists in memory. The ElevenLabs key exposure is contained to server-side API routes, but the overall env-var boundary is undefined.

---

## Vulnerabilities Found

### 1. Gateway Token in Browser State (HIGH)

**File:** `src/lib/gateway/GatewayClient.ts`  
**Lines:** 527, 556–561, 615–628, 719, 734  

**Finding:**
The raw gateway token is loaded from `/api/studio`, stored in React state, and used for WebSocket connections. An attacker with XSS access can read `token` from React DevTools or the component state.

```typescript
// Line 527
const [token, setToken] = useState("");
// Line 556–561: Loaded from API (raw token returned from server)
loadedGatewaySettings.current = { token: nextToken };
setToken(nextToken);
// Line 615–628: Used for gateway connection
await client.connect({ token, ... });
```

**Impact:** If a user inputs their gateway token in the UI settings, it is sent to the server, stored, returned raw in the API response, and held in client memory.

**Note:** The server IS sanitizing tokens in `sanitizeStudioGatewaySettings` (returns `tokenConfigured: boolean` only). The problem is the `loadStudioSettings` flow loads the raw token from `settings.json` and passes it through to the API response.

---

### 2. Env Var Boundary Undefined (MEDIUM)

**Files:**
- `src/lib/voiceReply/provider.ts` (lines 14, 24, 33)
- `src/features/agents/state/transcript.ts` (lines 15, 19)
- `src/app/api/office/call/route.ts` (line 44)
- `src/lib/openclaw/voiceTranscription.ts` (line 10)
- `src/lib/gateway/GatewayClient.ts` (line 102)

**Finding:**
No `NEXT_PUBLIC_` prefix convention is enforced. Most usage is safe (server-only API routes), but `GatewayClient.ts` line 102 reads `NEXT_PUBLIC_GATEWAY_URL` which is correct — but there is no documented policy preventing non-`NEXT_PUBLIC_` vars from being read in client code.

**Impact:** Future additions could accidentally read server-only env vars in client modules.

---

### 3. Jira API Token in Plaintext File (LOW)

**File:** `src/lib/studio/settings-store.ts`  
**Acknowledged risk** (see comment on line 13–15): `settings.json` is plaintext, and the threat model is documented as intentional for single-user workflow.

**Finding:** No encryption or server-side proxying of Jira API tokens. If `settings.json` is compromised, Jira credentials are exposed.

---

### 4. Voice Reply (ElevenLabs) - Correctly Server-Side

**File:** `src/lib/voiceReply/provider.ts`  
**Status:** ✅ Only imported by `src/app/api/office/voice/reply/route.ts` — a Next.js server route. The `ELEVENLABS_API_KEY` is only accessed in server context. **No client-side exposure.**

---

## Already Correct

| Pattern | Status |
|---------|--------|
| `/api/studio` GET returns `tokenConfigured` not raw token | ✅ Correct |
| `sanitizeStandupJiraConfig` returns `apiTokenConfigured` not raw token | ✅ Correct |
| `voiceReply/provider.ts` only used in server routes | ✅ Correct |
| `StudioGatewaySettingsPublic` does not include raw token | ✅ Correct |

---

## Minimal Patch

The minimal fix addresses the gateway token exposure by ensuring the API never returns the raw token to the browser. Instead, the token should be kept server-side and used only for server-initiated gateway connections (proxying).

### Change: `src/app/api/studio/route.ts`

Always sanitize the gateway token on every response:

```typescript
// In GET handler:
const settings = loadStudioSettings();
// Force sanitization so raw token is NEVER sent to client
return NextResponse.json({
  settings: sanitizeStudioSettings(settings),
  localGatewayDefaults: sanitizeStudioGatewaySettings(loadLocalGatewayDefaults()),
}, { headers: { "Cache-Control": "no-store" } });

// In PUT handler (gateway token patch):
const settings = applyStudioSettingsPatch(body);
return NextResponse.json({
  settings: sanitizeStudioSettings(settings),
}, { headers: { "Cache-Control": "no-store" } });
```

**Rationale:** The server currently sanitizes on GET, but the token is still loaded from `settings.json` and passed to the client through the coordinator. This change makes the sanitization **mandatory and explicit** at the API boundary.

### Change: `src/lib/gateway/GatewayClient.ts`

Remove the client-side token flow entirely. The browser should NOT hold the gateway token. Instead, the server should proxy gateway WebSocket connections.

**Minimal patch (alternative):** If proxying is out of scope, at minimum add a comment warning and reduce the token exposure surface:

```typescript
// Line 526–530: After loading, immediately overwrite token state
// to prevent it from appearing in React DevTools snapshots.
const [token, setToken] = useState("");
// ... load from settings ...
setToken(nextToken);

// Add: Clear token from state after connection
// (token is used only for the initial connect() call)
```

**Better approach (Phase 2):** Create a server-side WebSocket proxy at `/api/gateway/proxy` that authenticates the user via session cookie and forwards traffic to the gateway using the server-side token.

---

## Phase 2 Fixes Applied

### 1. Token Removed from Browser State

**Files changed:**
- `src/lib/gateway/GatewayClient.ts`
  - Removed `token` and `setToken` from React state
  - Removed `token` from `loadedGatewaySettings` ref
  - `connect()` now passes `token: undefined` — browser never sends token to server
  - `normalizeLocalGatewayDefaults` updated to work with `StudioGatewaySettingsPublic` (no raw token)
- `src/lib/studio/coordinator.ts`
  - `loadSettings()` now sanitizes gateway token client-side before returning
- `src/features/agents/components/GatewayConnectScreen.tsx`
  - Removed token input field — authentication is server-side only
  - `GatewayConnectScreenProps` updated: removed `token`, `onTokenChange`
  - Added notice: "Authentication is handled automatically by the server"
- `src/features/office/screens/OfficeScreen.tsx`
  - Updated `GatewayConnectScreen` usage — removed `token`, `setToken` props
- `src/features/agents/screens/AgentsPageScreen.tsx`
  - Updated `GatewayConnectScreen` usage — removed `token`, `setToken` props

**Result:** The browser no longer holds or transmits the gateway token. Authentication is handled entirely by the server-side proxy at `/api/gateway/ws`.

### 2. Env Var Policy Established

**Files changed:**
- `AGENTS.md`
  - Added **Environment Variable Policy** section with explicit allow-list
  - Allowed: `NEXT_PUBLIC_GATEWAY_URL`, `NEXT_PUBLIC_STUDIO_TRANSCRIPT_V2`, `NEXT_PUBLIC_STUDIO_TRANSCRIPT_DEBUG`
  - All other env vars are server-only
- `eslint.config.mjs`
  - Added `no-restricted-globals` rule blocking `process.env` in client code
  - Excludes `src/app/api/**` and `src/lib/studio/settings-store.ts`
  - Points to `AGENTS.md` for the full policy

### 3. Gateway Token Proxy — Already Correct

The server-side proxy in `server/gateway-proxy.js` was already designed correctly:
- Loads token from `loadUpstreamSettings()` (server-side)
- Injects token into upstream gateway connection
- Accepts browser connections at `/api/gateway/ws`
- No change needed — this was the intended architecture

The bug was that the browser was ALSO sending the token, which the proxy would use if present. With Phase 2 changes, the browser no longer sends any token.

---

## Severity Matrix (Post-Phase 2)

| Vulnerability | Severity | Status |
|---------------|----------|--------|
| Gateway token in browser state | ~~High~~ | ✅ **Fixed** |
| Undefined env var boundary | ~~Medium~~ | ✅ **Fixed** |
| Jira token in plaintext file | Low | ⚠️ Acknowledged (architectural change needed) |
| ElevenLabs key exposure | None | ✅ Already safe |

---

## GitHub Push Commands

Create a feature branch and push all changes:

```bash
# Navigate to the Claw3D repo
cd ~/apps/Claw3D

# Verify clean working tree (or stage changes)
git status

# Create and switch to a feature branch
git checkout -b security/token-isolation-phase2

# Stage all changed files
git add AGENTS.md
git add eslint.config.mjs
git add docs/SECURITY_AUDIT_TOKEN_EXPOSURE.md
git add src/app/api/studio/route.ts
git add src/lib/studio/coordinator.ts
git add src/lib/gateway/GatewayClient.ts
git add src/lib/gateway/proxy-url.ts
git add src/features/agents/components/GatewayConnectScreen.tsx
git add src/features/office/screens/OfficeScreen.tsx
git add src/features/agents/screens/AgentsPageScreen.tsx

# Or stage all changes at once
git add -A

# Commit with descriptive message
git commit -m "security: isolate gateway token from browser

Phase 2 of token hardening:
- Remove gateway token from browser React state
- Browser connects via server-side proxy at /api/gateway/ws
- Server injects token for upstream gateway auth
- Add NEXT_PUBLIC_ env var policy to AGENTS.md
- Add ESLint rule blocking process.env in client code
- Remove token input from GatewayConnectScreen UI

Fixes: gateway token exposure in browser state"

# Push to remote feature branch
git push -u origin security/token-isolation-phase2

# Create PR (if remote is configured)
gh pr create \
  --title "security: isolate gateway token from browser (Phase 2)" \
  --body "## Summary

Phase 2 of Claw3D token hardening:

1. **Removed token from browser state** — Gateway token no longer stored in React state. Browser connects via server-side WebSocket proxy at `/api/gateway/ws`.

2. **Server-side proxy auth** — `server/gateway-proxy.js` injects the token for upstream gateway connections. Browser never sees or sends credentials.

3. **Env var policy** — Added `NEXT_PUBLIC_` prefix convention to `AGENTS.md` with explicit allow-list and ESLint enforcement.

4. **UI cleanup** — Removed token input field from `GatewayConnectScreen`. Added notice that auth is handled automatically.

## Files Changed

\`\`\`
AGENTS.md                                  # +Env var policy
eslint.config.mjs                          # +process.env lint rule
docs/SECURITY_AUDIT_TOKEN_EXPOSURE.md     # +Phase 2 report
src/app/api/studio/route.ts                # explicit sanitization
src/lib/studio/coordinator.ts              # strip token client-side
src/lib/gateway/GatewayClient.ts           # -token state, -setToken
src/features/agents/components/GatewayConnectScreen.tsx  # -token input
src/features/office/screens/OfficeScreen.tsx             # -token prop
src/features/agents/screens/AgentsPageScreen.tsx        # -token prop
\`\`\`

## Testing

1. \`npm run lint\` — should pass with no errors
2. Build: \`npm run build\` — inspect \`dist/` for any remaining token strings
3. Load the app in browser — Gateway Connect screen should show URL input only (no token field)
4. Connect to a gateway — should work via server-side proxy" \
  --reviewer <reviewer> \
  --assignee <assignee>
```

### Quick Verify Before Push

```bash
# Check what files changed
git diff --stat

# Verify no token strings in client bundle (after build)
grep -r "gateway.*token\|token.*gateway" dist/ || echo "Clean: no token refs in dist"

# Run lint
npm run lint
```

### Git Remote Info (if not already set)

```bash
# Check remote
git remote -v

# If needed, add fork remote
git remote add fork https://github.com/<your-username>/Claw3D.git
git remote add upstream https://github.com/<original-owner>/Claw3D.git

# Set push URL to fork
git remote set-url --push fork https://github.com/<your-username>/Claw3D.git
```

---

## Remaining Considerations (Phase 3)

1. **Jira API tokens**: Still stored in plaintext `settings.json`. Future: use encrypted storage or server-side session with HTTP-only cookie.
2. **Gateway token in `settings.json`**: Currently the server reads the token from `settings.json` for the proxy. Consider moving to environment variable for production deployments.
3. **Device auth tokens**: `GatewayBrowserClient` stores device auth tokens in `localStorage`. These are different from the gateway token and are used for device-to-gateway authentication — currently within the acknowledged threat model.
