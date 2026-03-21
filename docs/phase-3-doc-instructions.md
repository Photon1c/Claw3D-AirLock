# Phase 3 Documentation Updates

## Git Commands

```bash
cd /home/sherlockhums/apps/Claw3D

git checkout security/state-and-env-isolation-phase3

git add README.md \
       CONTRIBUTING.md \
       docs/pi-chat-streaming.md \
       docs/PHASE-3-results.md \
       docs/phase-3-doc-alignment-opencode.md

git commit -m "docs: align documentation with Phase 3 explicit config model"

git push origin security/state-and-env-isolation-phase3
```

## What this commit includes

- **`README.md`** — Configuration section updated to reflect explicit state dir model
- **`CONTRIBUTING.md`** — "Before you start" updated with explicit config requirement
- **`docs/pi-chat-streaming.md`** — Settings path, token resolution, and media path references corrected
- **`docs/PHASE-3-results.md`** — `OPENCLAW_CONFIG_PATH` clarified as explicit override
- **`docs/phase-3-doc-alignment-opencode.md`** — Deliverables and git commands added
