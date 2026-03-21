# Bug Report: resolveSandboxDir Not Exported

## Status: RESOLVED

## Issue

`resolveSandboxDir` was imported from `@/lib/clawdbot/paths` but not exported, causing runtime errors.

## Fix Applied

- ✅ Exported `resolveSandboxDir` from `src/lib/clawdbot/paths.ts`
- ✅ Removed stale token references from `AgentsPageScreen.tsx` (token removed in Phase 2)
- ✅ Added `tokenConfigured: boolean` to `GatewayConnectionState` for UI feedback
- ✅ Updated `ConnectionPanel` to use `tokenConfigured` instead of exposing token
- ✅ Fixed TypeScript error in `eventTriggers.ts` (impossible comparison)

## Related Files Changed

- `src/lib/clawdbot/paths.ts` - exported `resolveSandboxDir()`
- `src/lib/gateway/GatewayClient.ts` - added `tokenConfigured` state
- `src/features/agents/components/ConnectionPanel.tsx` - updated props
- `src/features/agents/screens/AgentsPageScreen.tsx` - removed stale token refs
- `src/lib/office/eventTriggers.ts` - fixed impossible comparison
- `tests/unit/connectionPanel-close.test.ts` - updated tests
- `tests/unit/useGatewayConnection.test.ts` - updated tests

## Notes

The gateway token prompt UX is now handled via `tokenConfigured: boolean` in the connection panel, indicating whether a token is configured without exposing the actual token value. This aligns with the Phase 2 security isolation work where the token is kept server-side.

## Verification

```bash
npm run build  # ✅ Passes
npm run typecheck  # ✅ Passes
npm run test -- --run tests/unit/connectionPanel-close.test.ts tests/unit/useGatewayConnection.test.ts  # ✅ 7 tests pass
```

## Git Commands to Push

```bash
# Add the bug fix files (all on one line)
git add src/lib/clawdbot/paths.ts src/lib/gateway/GatewayClient.ts src/features/agents/components/ConnectionPanel.tsx src/features/agents/screens/AgentsPageScreen.tsx src/lib/office/eventTriggers.ts tests/unit/connectionPanel-close.test.ts tests/unit/useGatewayConnection.test.ts docs/bug-red.md

# Commit with descriptive message
git commit -m "fix: export resolveSandboxDir and update token handling for Phase 3 follow-up"

# Push to feature branch
git push origin security/state-and-env-isolation-phase3
```
