Claw3D Security Assessment — Summary (Phase 1–2)

Date: March 20, 2026
Context: Evaluation of Claw3D prior to local execution; Airlock-based review workflow

1. Initial Finding (Critical)

Claw3D exposed the gateway token to the browser:

Token returned via /api/studio

Stored in React state (GatewayClient.ts)

Used directly for browser WebSocket connections

Risk:

Immediate credential exposure

Potential for interception or misuse via client-side access

2. Mitigation Work (Feature Branch: token-isolation-phase2)

A hardened version was implemented locally with the following changes:

✅ Browser Exposure Removed

Gateway token no longer sent to client

Browser connects only via /api/gateway/ws

Server-side proxy injects token

✅ Trust Boundary Centralized

gateway-proxy.js is now the single authentication path

Removed duplicate browser-side token handling

✅ Env Policy Introduced

NEXT_PUBLIC_* variables restricted to safe client usage

Server-only env enforced via ESLint rules

✅ UI Behavior Corrected

Token input fields removed

Users no longer handle sensitive credentials in browser

3. Remaining Issue (Architectural — Medium/High)
⚠️ Implicit OpenClaw State Inheritance

Claw3D still loads configuration via:

~/.openclaw/

Specifically:

~/.openclaw/claw3d/settings.json

~/.openclaw/openclaw.json (fallback)

Behavior:

Automatically discovers and uses existing OpenClaw gateway token

No explicit configuration required

Inherits credentials and state silently

4. Risk Assessment

Even after patching browser exposure:

Credentials are still accessible via filesystem

Trust boundary between tools remains implicit

New tools can inherit sensitive state without user awareness

Threat model:

Malicious or buggy code could read/export local state

Multi-tool environments lack isolation guarantees

5. Safe Testing Strategy (Airlock Model)

To prevent leakage during testing:

export OPENCLAW_STATE_DIR=~/claw3d-airlock-state

Use isolated config:

{
  "gateway": {
    "url": "ws://localhost:18789",
    "token": "test-token"
  }
}

Result:

Claw3D operates without accessing real OpenClaw state

Validates functionality under least-privilege conditions

6. Current Status

Security issue submitted upstream (token exposure)

Under triage; collaborator access granted

No assumption of upstream fixes yet

Local hardening demonstrates viable mitigation path

7. Recommended Next Phase (Phase 3)

Focus: State & Environment Isolation

Suggested improvements:

Remove default fallback to ~/.openclaw

Require explicit state/config path

Support sandbox mode by default

Avoid implicit credential reuse across tools

8. Key Insight

Claw3D has transitioned from browser-exposed credentials → server-protected credentials,
but still relies on implicit local state trust, which preserves a broader attack surface.

9. Strategic Outcome

Airlock workflow successfully prevented premature execution

Identified both:

surface-level vulnerability (fixed locally)

deeper architectural boundary issue (still present)

Reinforces need for:

explicit trust boundaries

isolated state per tool

least-privilege defaults across agent ecosystem
