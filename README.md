# Design Fail Watch — Skin A demo (fail-first)

**Share:** https://bnjmnsmith6.github.io/design-fail-watch/

Cold open seeds a **broken** near-complete path. Press **Play** — it fails spatially where the next step was never built. Then edit the gap → Play → Goal (second beat). No score / timer / stars.

Skin A only (abstract / darker / plain **dot**). Reset restores the incomplete starter; **Clear** blanks to S/G only.

## Local

```bash
python3 -m http.server 8765 --bind 127.0.0.1
```

Then open http://127.0.0.1:8765/?skin=a

## Rule

Deterministic BFS / greedy path on built tiles. Same build always fails the same way.
