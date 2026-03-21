You are working on a documentation-only cleanup for the AirLock fork of Claw3D.

Context:
Phase 3 hardened state isolation and removed implicit ~/.openclaw fallback behavior from live runtime paths. However, the documentation is now out of sync with the actual implementation.

Important current reality:
- There is no longer implicit runtime fallback to ~/.openclaw in the live app flow
- State/config is now explicit
- `AIRLOCK_SANDBOX_MODE=1` enables isolated sandbox mode
- `OPENCLAW_STATE_DIR` is the primary explicit state-dir mechanism
- `OPENCLAW_CONFIG_PATH` still exists intentionally as an explicit direct settings-file override
- Some docs and tests still describe older fallback behavior as if it were current

Goal:
Update documentation so it accurately reflects the current hardened architecture and configuration model.

Do not:
1. Change runtime code
2. Reintroduce or suggest implicit ~/.openclaw fallback as current behavior
3. Rewrite large sections unnecessarily
4. Touch unrelated docs unless they directly mention the outdated behavior

Tasks:

### 1. Audit stale documentation
Find documentation files that still claim or imply any of the following as current behavior:
- automatic reading from `~/.openclaw`
- fallback to `openclaw.json`
- fallback to legacy paths like `.moltbot` or `.clawdbot`
- “use local defaults” behavior
- incorrect statement that `OPENCLAW_STATE_DIR` is the only explicit config path if `OPENCLAW_CONFIG_PATH` still exists

### 2. Correct the architecture description
Update docs to reflect the current model:

Current correct model:
- No implicit credential/state inheritance from `~/.openclaw`
- `OPENCLAW_STATE_DIR` explicitly selects the state root
- `OPENCLAW_CONFIG_PATH` explicitly selects a settings file
- `AIRLOCK_SANDBOX_MODE=1` (or `CLAW3D_SANDBOX=1`) enables isolated sandbox mode
- If no explicit configuration is provided, the app should fail clearly rather than silently inherit host state

### 3. Update key docs first
Prioritize:
- `README.md`
- `CONTRIBUTING.md`
- `docs/PHASE-3-results.md`
- any docs that still describe `openclaw.json` fallback as live behavior
- any docs that still describe default `~/.openclaw` state use as the current runtime model

### 4. Clarify `OPENCLAW_CONFIG_PATH`
Add precise wording that:
- `OPENCLAW_CONFIG_PATH` is an explicit override
- it is not an implicit fallback
- it points directly to a settings file
- it takes precedence over `OPENCLAW_STATE_DIR` if both are set

### 5. Preserve useful historical context carefully
If a doc is describing previous behavior for audit/history purposes, keep that context but label it clearly as:
- previous behavior
- pre-Phase-3 behavior
- legacy behavior
Do not let historical notes read like current runtime behavior.

### 6. Deliverables
Provide:
1. A short list of files updated
2. A short summary of the corrections made
3. Any doc/test files that still contain historical references intentionally left in place
4. A note if any tests appear out of sync with current documented behavior

Style requirements:
- Be precise
- Be concise
- Prefer explicit trust-boundary language
- Avoid ambiguity between “current behavior” and “legacy behavior”

## Deliverables

### Files updated (4)

1. **`README.md`** — Rewrote the Configuration section. Replaced the claim that config lives at `~/.openclaw/openclaw.json` and `~/.openclaw/claw3d/settings.json` with explicit descriptions of `OPENCLAW_STATE_DIR`, `OPENCLAW_CONFIG_PATH`, and sandbox mode. Added clear error behavior when no config is set.

2. **`CONTRIBUTING.md`** — Replaced "reads config from `~/.openclaw` with legacy fallback" with explicit configuration requirement. Points contributors to `OPENCLAW_STATE_DIR` or sandbox mode.

3. **`docs/pi-chat-streaming.md`** — Fixed four stale references: (a) settings path description now references `OPENCLAW_STATE_DIR`, (b) removed claim that settings-store has fallback behavior, (c) removed token fallback to `openclaw.json` in the token resolution note, (d) updated media path example and sandbox mode constraint.

4. **`docs/PHASE-3-results.md`** — Added `OPENCLAW_CONFIG_PATH` section to the configuration model, clarified it is an explicit override (not a fallback), added a "no silent fallback" statement.

### Corrections made

- **Before**: Config auto-reads from `~/.openclaw/openclaw.json` with legacy `.moltbot`/`.clawdbot` fallback.
- **After**: Config is explicit. Set `OPENCLAW_STATE_DIR` or use sandbox mode. `OPENCLAW_CONFIG_PATH` is an explicit settings-file override, not a fallback. No implicit state discovery.

- **Before**: `~/.openclaw/claw3d/settings.json` (implied default).
- **After**: `<OPENCLAW_STATE_DIR>/claw3d/settings.json` or `<OPENCLAW_CONFIG_PATH>`.

- **Before**: Token fallback to `openclaw.json` described as current behavior.
- **After**: Token resolved from configured settings only. Explicit auth or error if absent.

### Files intentionally left as-is (with reasoning)

| File | Reason |
|------|--------|
| `docs/phase-3.md` | Phase 3 planning doc — describes pre-fix state; historical record |
| `docs/phase-3-doc-alignment-opencode.md` | Meta-doc for this task |
| `docs/PHASE-3-results.md` | Results doc (now updated) |
| `docs/SECOND_SECURITY_AUDIT_ENV_AND_STATE_VULNS.md` | Security audit doc; `~/.openclaw` references describe the vulnerability (pre-fix), not current behavior |
| `docs/permissions-sandboxing.md` lines 20, 91, 181, 277-278 | These describe OpenClaw **upstream gateway** behavior, not Claw3D runtime paths |
| `skills-overview.md` lines 27-43, 61, 121, 154 | These describe OpenClaw **upstream gateway** skill metadata and `openclaw.json` as a gateway config file, not Claw3D's settings model |
| `TUTORIAL.md` | External OpenClaw docs links only; no Claw3D config claims |

### Tests out of sync

No test files were found that describe `openclaw.json` fallback or `~/.openclaw` implicit discovery as current behavior. No tests were updated as part of this task.

## Git Commands

```bash
cd /home/sherlockhums/apps/Claw3D

git checkout -b security/state-and-env-isolation-phase3

git add README.md \
       CONTRIBUTING.md \
       docs/pi-chat-streaming.md \
       docs/PHASE-3-results.md \
       docs/phase-3-doc-alignment-opencode.md

git commit -m "docs: align documentation with Phase 3 explicit config model"

git push -u origin security/state-and-env-isolation-phase3
```
