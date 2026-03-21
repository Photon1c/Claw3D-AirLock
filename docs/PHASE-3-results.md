# Phase 3 Results: State Isolation

## Objective
Eliminate implicit credential/state inheritance and enforce explicit, isolated configuration.

## What was removed

- **Implicit credential discovery**: `~/.openclaw/openclaw.json` is no longer auto-read as a fallback
- **Legacy fallbacks**: `MOLTBOT_STATE_DIR`, `CLAWDBOT_STATE_DIR`, `.clawdbot`, `.moltbot` all removed
- **"Use local defaults" button**: Removed since it relied on implicit `openclaw.json` discovery
- **`loadLocalGatewayDefaults` / `readOpenclawGatewayDefaults`**: Removed from both TS and JS codebases
- **`resolveConfigPathCandidates`**: Removed legacy path candidates; now only returns explicit config path
- **Hardcoded `~/.openclaw`**: Replaced with `OPENCLAW_STATE_DIR` env var in SSH scripts and media route
- **`normalizeLocalGatewayDefaults`**: Removed unused client-side normalization
- **`localGatewayDefaults` field**: Removed from API response, coordinator types, and UI components
- **`useLocalGatewayDefaults` callback**: Removed from `GatewayConnectionState`
- **`stableHash` / `resolveStateFromSeed`**: Removed unused office presence helpers

## What was added

- **`OPENCLAW_STATE_DIR`** is now the **only** way to configure state storage — fails explicitly if not set
- **`OPENCLAW_CONFIG_PATH`** is preserved as an explicit settings-file override (not a fallback)
- **Sandbox mode** via `AIRLOCK_SANDBOX_MODE=1` (or `CLAW3D_SANDBOX=1`) — uses isolated temp dir at `/tmp/claw3d_sandbox/`, no host state access
- **Clear error messages** when state dir is not configured
- **Sandbox-aware path resolution** in all store functions, settings, and media routes
- **`isSandboxMode()`** exported from `paths.ts`
- **`resolveSandboxDir()`** exported from `paths.ts`
- **`resolveStudioSettingsPath(env)`** now accepts env parameter
- All store operations now pass `env` through the call chain for sandbox awareness

## Files changed

### Core state resolution
- `src/lib/clawdbot/paths.ts` — refactored `resolveStateDir()` to fail explicitly; removed legacy fallbacks; added sandbox mode; exported `isSandboxMode()`, `resolveSandboxDir()`
- `server/studio-settings.js` — same refactor for gateway-proxy

### Settings layer
- `src/lib/studio/settings-store.ts` — removed `openclaw.json` fallback; all functions now sandbox-aware with env parameter
- `src/lib/studio/coordinator.ts` — removed `localGatewayDefaults` from `StudioSettingsResponse`
- `src/app/api/studio/route.ts` — removed `localGatewayDefaults` from API response

### Client-side gateway
- `src/lib/gateway/GatewayClient.ts` — removed `useLocalGatewayDefaults`, `normalizeLocalGatewayDefaults`, `localGatewayDefaults` state; removed `useLocalGatewayDefaults` from return type
- `src/features/agents/components/GatewayConnectScreen.tsx` — removed `localGatewayDefaults` prop and "Use local defaults" UI
- `src/features/agents/screens/AgentsPageScreen.tsx` — removed `localGatewayDefaults` and `useLocalGatewayDefaults` usage
- `src/features/office/screens/OfficeScreen.tsx` — same

### Office and standup
- `src/lib/office/presence.ts` — simplified `loadOfficePresenceSnapshot()`; now takes explicit agents array; removed `openclaw.json` reading
- `src/lib/office/standup/service.ts` — removed `openclaw.json` fallback in `normalizeAgentSnapshots()`
- `src/lib/office/store.ts` — sandbox-aware `resolveStorePath()` and all store operations
- `src/lib/office/standup/store.ts` — sandbox-aware store operations

### Agent state
- `src/lib/agent-state/local.ts` — sandbox-aware `trashAgentStateLocally()` and `restoreAgentStateLocally()`
- `src/lib/ssh/agent-state.ts` — SSH scripts now use `OPENCLAW_STATE_DIR` env var instead of hardcoded `~/.openclaw`; sandbox mode detection added

### Media route
- `src/app/api/gateway/media/route.ts` — local and remote path validation now uses `OPENCLAW_STATE_DIR`; remote access requires `OPENCLAW_STATE_DIR` (no sandbox mode); SSH script updated with escaped env var

### Text utilities
- `src/lib/text/speech-image.ts` — removed implicit `~/.openclaw` path construction
- `src/lib/text/media-markdown.ts` — updated comment to reflect explicit state dir
- `src/features/agents/operations/useAgentSettingsMutationController.ts` — updated delete confirmation message

## Verification

Confirmed zero remaining references to:
- `.openclaw` in source and server code
- `readOpenclawGatewayDefaults` / `loadLocalGatewayDefaults`
- `MOLTBOT_STATE_DIR` / `CLAWDBOT_STATE_DIR`
- Legacy config filenames in implicit resolution

## Configuration model

### Primary: `OPENCLAW_STATE_DIR`
Sets the state root directory. Settings are stored at `<OPENCLAW_STATE_DIR>/claw3d/settings.json`.
```bash
export OPENCLAW_STATE_DIR=/path/to/your/state
```

### Override: `OPENCLAW_CONFIG_PATH`
Points directly to a settings file. Takes precedence over `OPENCLAW_STATE_DIR` if both are set. Not a fallback — an explicit override only.
```bash
export OPENCLAW_CONFIG_PATH=/path/to/settings.json
```

### Sandbox mode (isolated, no host state access)
```bash
export AIRLOCK_SANDBOX_MODE=1
# or
export CLAW3D_SANDBOX=1
# State goes to /tmp/claw3d_sandbox/
```

If neither `OPENCLAW_STATE_DIR` nor `OPENCLAW_CONFIG_PATH` is set, the application exits with a clear error. There is no implicit fallback to `~/.openclaw`.

## Remaining risks
- `OPENCLAW_PACKAGE_ROOT` is a server-only var; ensure it stays server-side
- `ELEVENLABS_API_KEY` and voice config are server-only; no changes made to those paths
- Single-user threat model for `settings.json` is unchanged (documented in settings-store.ts)
- SSH remote operations require `OPENCLAW_STATE_DIR` to be set on the remote host; sandbox mode is not supported for remote media access

## Git Commands

To push these changes to a feature branch:

```bash
cd /home/sherlockhums/apps/Claw3D

git checkout -b security/state-and-env-isolation-phase3

git add src/lib/clawdbot/paths.ts \
       src/lib/studio/settings-store.ts \
       src/lib/studio/coordinator.ts \
       src/app/api/studio/route.ts \
       src/lib/gateway/GatewayClient.ts \
       src/features/agents/components/GatewayConnectScreen.tsx \
       src/features/agents/screens/AgentsPageScreen.tsx \
       src/features/office/screens/OfficeScreen.tsx \
       src/lib/office/presence.ts \
       src/lib/office/standup/service.ts \
       src/lib/office/store.ts \
       src/lib/office/standup/store.ts \
       src/lib/agent-state/local.ts \
       src/lib/ssh/agent-state.ts \
       src/app/api/gateway/media/route.ts \
       src/lib/text/speech-image.ts \
       src/lib/text/media-markdown.ts \
       src/features/agents/operations/useAgentSettingsMutationController.ts \
       server/studio-settings.js \
       docs/PHASE-3-results.md

git commit -m "phase-3: eliminate implicit state inheritance, enforce explicit config"

git push -u origin security/state-and-env-isolation-phase3
```
