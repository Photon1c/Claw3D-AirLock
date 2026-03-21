You are working on Phase 3 of AirLock (Claw3D fork).

Current status:
- Token exposure to browser has been FIXED in Phase 2.
- Remaining issue is implicit state inheritance from ~/.openclaw.
- System is currently NOT RUNNABLE, which is acceptable.

Primary objective:
Eliminate implicit credential/state inheritance and enforce explicit, isolated configuration.

---

CORE PROBLEM

Claw3D automatically loads credentials from:

~/.openclaw/openclaw.json
~/.openclaw/claw3d/settings.json

This creates implicit trust between tools on the same host.

We must remove this behavior.

---

HARD RULES

1. No automatic reading from ~/.openclaw
2. No fallback to global state directories
3. All credential/state access must be explicit
4. Default behavior must be least-privilege
5. Do not reintroduce browser token exposure
6. Do not prioritize convenience over isolation

---

PHASE 3 TASKS

### 1. State Source Audit

Identify all code paths that:
- read from ~/.openclaw
- fallback to global config
- auto-discover gateway settings

Output:
- list of files + functions responsible

---

### 2. Remove Implicit Fallback

Refactor so that:

❌ Current:
- if no config → read ~/.openclaw

✅ New:
- if no config → fail explicitly OR require user-provided config

---

### 3. Explicit Configuration Model

Introduce one of:

Option A (preferred):
- require OPENCLAW_STATE_DIR explicitly
- no default

Option B:
- default to local project-scoped state:
  ./airlock_state/

Option C:
- require config via .env or startup argument

---

### 4. Sandbox Mode (Important)

Add a safe default mode:

- automatically uses isolated state directory
- does NOT touch host-level state
- clearly logs:
  “Running in sandbox mode — no global state access”

---

### 5. Settings Layer Split

Separate:

- public config (safe for UI)
- secret config (server-only)

Ensure:
- secret config never leaves server boundary
- UI only sees non-sensitive metadata

---

### 6. Runtime Behavior

After refactor:

- AirLock starts without accessing ~/.openclaw
- If no config is provided:
  - either fail clearly
  - or run in sandbox mode

---

### 7. Minimum Viable Recovery

Restore only:

- Studio UI loads
- Server starts
- Gateway connection works when explicitly configured
- No implicit credential discovery

---

### 8. Verification

Confirm:

- no reads from ~/.openclaw
- no implicit token discovery
- OPENCLAW_STATE_DIR respected strictly
- sandbox mode works
- system fails safely without config

---

DELIVERABLES

1. State inheritance map (before)
2. Refactored state handling
3. Explicit config model
4. Sandbox mode implementation
5. Short security note:
   - what was removed
   - what is now isolated
   - remaining risks

---

DECISION RULE

If forced to choose:
- convenience vs isolation → choose isolation
- auto-config vs explicit config → choose explicit

---

Start with:
1. State access map
2. Proposed isolation model
3. Step-by-step plan
