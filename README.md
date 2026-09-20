# Design Fail Watch — Skin A demo

**Share:** https://bnjmnsmith6.github.io/design-fail-watch/ — open the link, paint a path from S to G, press Play, watch where it breaks.

Skin A only (abstract / darker / plain dot). Build → Play → spatial fail → edit → free re-run. No account.

## Local

```bash
python3 -m http.server 8765 --bind 127.0.0.1
```

Then open http://127.0.0.1:8765/

## Rule

Deterministic BFS / greedy path on built tiles. Same build always fails the same way.
