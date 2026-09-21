/**
 * Design Fail Watch — shared core
 * Grid build + deterministic traversal + spatial fail locus.
 *
 * DETERMINISTIC RULE (documented):
 * 1. Built tiles form an orthogonal (4-neighbor) graph.
 * 2. On Play, BFS from Start over built tiles only. Neighbor expand
 *    order is fixed: North, East, South, West. First visit wins →
 *    unique parent tree / unique shortest path when Goal is reachable.
 * 3. If Goal is reachable: agent walks that BFS path cell-by-cell.
 * 4. If Goal is unreachable: agent walks from Start following the
 *    greedy policy — among unvisited built orthogonal neighbors, pick
 *    the one with smallest Manhattan distance to Goal; ties broken
 *    N > E > S > W. Stops when no such neighbor remains.
 * 5. Fail locus: last occupied cell (where no onward built step exists
 *    and Goal not reached). Also records "expected" empty neighbor:
 *    among empty orthogonal neighbors of the fail cell, the one with
 *    smallest Manhattan to Goal (ties N>E>S>W) — the unfinished promise.
 * Same grid → same path → same fail every time. No RNG.
 */

(function (global) {
  "use strict";

  const DIRS = [
    { name: "N", dr: -1, dc: 0 },
    { name: "E", dr: 0, dc: 1 },
    { name: "S", dr: 1, dc: 0 },
    { name: "W", dr: 0, dc: -1 },
  ];

  const MODE = { BUILD: "build", PLAY: "play", DONE: "done" };

  function key(r, c) {
    return r + "," + c;
  }

  function manhattan(a, b) {
    return Math.abs(a.r - b.r) + Math.abs(a.c - b.c);
  }

  function createGame(opts) {
    const size = (opts && opts.size) || 8;
    const start = { r: size - 1, c: 0 };
    const goal = { r: 0, c: size - 1 };

    /** @type {boolean[][]} true = built/traversable */
    const built = Array.from({ length: size }, () => Array(size).fill(false));
    // Start and Goal cells are always traversable (player still "owns" the path between)
    built[start.r][start.c] = true;
    built[goal.r][goal.c] = true;

    let mode = MODE.BUILD;
    let tool = "paint"; // paint | erase
    let agent = { r: start.r, c: start.c };
    /** @type {{r:number,c:number}[]} */
    let walkPath = [];
    let walkIndex = 0;
    /** @type {null | { cell:{r:number,c:number}, expected:null|{r:number,c:number}, reason:string }} */
    let failLocus = null;
    let success = false;
    let animTimer = null;
    let listeners = [];

    function emit() {
      const snap = snapshot();
      listeners.forEach(function (fn) {
        fn(snap);
      });
    }

    function onChange(fn) {
      listeners.push(fn);
      return function () {
        listeners = listeners.filter(function (x) {
          return x !== fn;
        });
      };
    }

    function inBounds(r, c) {
      return r >= 0 && c >= 0 && r < size && c < size;
    }

    function isStart(r, c) {
      return r === start.r && c === start.c;
    }
    function isGoal(r, c) {
      return r === goal.r && c === goal.c;
    }

    function setTool(t) {
      if (mode === MODE.PLAY) return;
      tool = t;
      emit();
    }

    function setBuilt(r, c, value) {
      if (!inBounds(r, c)) return;
      if (isStart(r, c) || isGoal(r, c)) {
        built[r][c] = true; // locked on
        return;
      }
      built[r][c] = !!value;
    }

    function paintAt(r, c) {
      if (mode === MODE.PLAY) return false;
      if (mode === MODE.DONE) {
        // free iterate: return to build, clear run state
        clearRunState();
        mode = MODE.BUILD;
      }
      if (tool === "paint") setBuilt(r, c, true);
      else if (tool === "erase") setBuilt(r, c, false);
      emit();
      return true;
    }

    function clearRunState() {
      if (animTimer) {
        clearInterval(animTimer);
        animTimer = null;
      }
      agent = { r: start.r, c: start.c };
      walkPath = [];
      walkIndex = 0;
      failLocus = null;
      success = false;
    }

    /**
     * Near-complete S→G path with one intentional gap on the climb
     * (right column). First Play fails spatially at the gap without
     * the player crafting a break. Same grid every cold load / Reset.
     */
    function starterCells() {
      const cells = [];
      // Bottom row: Start → southeast corner
      for (let c = 0; c < size; c++) {
        cells.push({ r: start.r, c: c });
      }
      // Right column climb toward Goal, skip one mid cell (the lie)
      const gapR = Math.floor(size / 2);
      for (let r = start.r - 1; r >= 0; r--) {
        if (r === gapR) continue;
        cells.push({ r: r, c: goal.c });
      }
      return { cells: cells, gap: { r: gapR, c: goal.c } };
    }

    function applyBlankGrid() {
      for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
          built[r][c] = isStart(r, c) || isGoal(r, c);
        }
      }
    }

    function seedIncompleteStarter() {
      if (animTimer) {
        clearInterval(animTimer);
        animTimer = null;
      }
      applyBlankGrid();
      const starter = starterCells();
      for (let i = 0; i < starter.cells.length; i++) {
        const p = starter.cells[i];
        built[p.r][p.c] = true;
      }
      built[start.r][start.c] = true;
      built[goal.r][goal.c] = true;
      mode = MODE.BUILD;
      clearRunState();
      emit();
    }

    /** Reset restores the incomplete fail-lesson starter (not blank win farm). */
    function resetGrid() {
      seedIncompleteStarter();
    }

    /** Explicit Clear → blank S/G only (behind Clear control). */
    function clearGrid() {
      if (animTimer) {
        clearInterval(animTimer);
        animTimer = null;
      }
      applyBlankGrid();
      mode = MODE.BUILD;
      clearRunState();
      emit();
    }

    function neighbors(r, c) {
      const out = [];
      for (let i = 0; i < DIRS.length; i++) {
        const nr = r + DIRS[i].dr;
        const nc = c + DIRS[i].dc;
        if (inBounds(nr, nc)) out.push({ r: nr, c: nc, dir: DIRS[i].name });
      }
      return out;
    }

    /** BFS over built tiles; returns { reachable, parentMap, path or null } */
    function bfsPath() {
      const parent = new Map();
      const visited = new Set();
      const q = [];
      const sk = key(start.r, start.c);
      visited.add(sk);
      parent.set(sk, null);
      q.push({ r: start.r, c: start.c });

      let found = false;
      while (q.length) {
        const cur = q.shift();
        if (isGoal(cur.r, cur.c)) {
          found = true;
          break;
        }
        const nbs = neighbors(cur.r, cur.c); // N,E,S,W order
        for (let i = 0; i < nbs.length; i++) {
          const n = nbs[i];
          if (!built[n.r][n.c]) continue;
          const nk = key(n.r, n.c);
          if (visited.has(nk)) continue;
          visited.add(nk);
          parent.set(nk, key(cur.r, cur.c));
          q.push({ r: n.r, c: n.c });
        }
      }

      if (!found) {
        return { reachable: false, parent: parent, path: null };
      }

      // reconstruct
      const path = [];
      let ck = key(goal.r, goal.c);
      while (ck) {
        const parts = ck.split(",");
        path.push({ r: +parts[0], c: +parts[1] });
        ck = parent.get(ck);
      }
      path.reverse();
      return { reachable: true, parent: parent, path: path };
    }

    /** Greedy walk when Goal unreachable — deterministic */
    function greedyWalkUntilStuck() {
      const path = [{ r: start.r, c: start.c }];
      const visited = new Set([key(start.r, start.c)]);
      let cur = { r: start.r, c: start.c };

      for (;;) {
        const candidates = neighbors(cur.r, cur.c).filter(function (n) {
          return built[n.r][n.c] && !visited.has(key(n.r, n.c));
        });
        if (!candidates.length) break;

        candidates.sort(function (a, b) {
          const da = manhattan(a, goal);
          const db = manhattan(b, goal);
          if (da !== db) return da - db;
          // tie: N > E > S > W (DIRS order = index in neighbor list already N,E,S,W;
          // preserve that by comparing dir order)
          const order = { N: 0, E: 1, S: 2, W: 3 };
          return order[a.dir] - order[b.dir];
        });

        const next = candidates[0];
        visited.add(key(next.r, next.c));
        cur = { r: next.r, c: next.c };
        path.push(cur);
        if (isGoal(cur.r, cur.c)) break;
      }
      return path;
    }

    function pickExpectedEmpty(cell) {
      const empties = neighbors(cell.r, cell.c).filter(function (n) {
        return !built[n.r][n.c];
      });
      if (!empties.length) return null;
      empties.sort(function (a, b) {
        const da = manhattan(a, goal);
        const db = manhattan(b, goal);
        if (da !== db) return da - db;
        const order = { N: 0, E: 1, S: 2, W: 3 };
        return order[a.dir] - order[b.dir];
      });
      return { r: empties[0].r, c: empties[0].c };
    }

    function computeWalk() {
      const bfs = bfsPath();
      if (bfs.reachable) {
        return {
          path: bfs.path,
          success: true,
          failLocus: null,
        };
      }
      const path = greedyWalkUntilStuck();
      const last = path[path.length - 1];
      const atGoal = isGoal(last.r, last.c);
      if (atGoal) {
        // edge case: greedy reached goal even if BFS said no — shouldn't happen
        return { path: path, success: true, failLocus: null };
      }
      const expected = pickExpectedEmpty(last);
      return {
        path: path,
        success: false,
        failLocus: {
          cell: { r: last.r, c: last.c },
          expected: expected,
          reason: expected
            ? "Broke here — next step never built."
            : "Dead end — no onward built tile and Goal not reached.",
        },
      };
    }

    function play(stepMs) {
      if (mode === MODE.PLAY) return;
      clearRunState();
      const result = computeWalk();
      walkPath = result.path;
      walkIndex = 0;
      agent = { r: walkPath[0].r, c: walkPath[0].c };
      success = false;
      failLocus = null;
      mode = MODE.PLAY;
      emit();

      const ms = stepMs || 280;
      animTimer = setInterval(function () {
        if (walkIndex >= walkPath.length - 1) {
          // finished walking
          clearInterval(animTimer);
          animTimer = null;
          if (result.success) {
            success = true;
            failLocus = null;
            mode = MODE.DONE;
          } else {
            success = false;
            failLocus = result.failLocus;
            mode = MODE.DONE;
          }
          emit();
          return;
        }
        walkIndex += 1;
        agent = {
          r: walkPath[walkIndex].r,
          c: walkPath[walkIndex].c,
        };
        emit();
      }, ms);
    }

    function stop() {
      if (mode !== MODE.PLAY) return;
      if (animTimer) {
        clearInterval(animTimer);
        animTimer = null;
      }
      // Return to build with free iterate; keep grid, clear run highlights
      mode = MODE.BUILD;
      clearRunState();
      emit();
    }

    function returnToBuild() {
      if (mode === MODE.PLAY) return; // must Stop first, or wait for done
      if (animTimer) {
        clearInterval(animTimer);
        animTimer = null;
      }
      mode = MODE.BUILD;
      clearRunState();
      emit();
    }

    function snapshot() {
      return {
        size: size,
        start: { r: start.r, c: start.c },
        goal: { r: goal.r, c: goal.c },
        built: built.map(function (row) {
          return row.slice();
        }),
        mode: mode,
        tool: tool,
        agent: { r: agent.r, c: agent.c },
        walkPath: walkPath.map(function (p) {
          return { r: p.r, c: p.c };
        }),
        walkIndex: walkIndex,
        failLocus: failLocus
          ? {
              cell: { r: failLocus.cell.r, c: failLocus.cell.c },
              expected: failLocus.expected
                ? { r: failLocus.expected.r, c: failLocus.expected.c }
                : null,
              reason: failLocus.reason,
            }
          : null,
        success: success,
        canEdit: mode !== MODE.PLAY,
        RULE_TEXT:
          "BFS shortest path on built tiles (expand N→E→S→W). If unreachable, greedy Manhattan-to-Goal among unvisited built neighbors (ties N>E>S>W). Fail locus = last occupied cell + expected empty next.",
      };
    }

    // Serialize / restore grid for skin switch without losing build
    function exportGrid() {
      return {
        size: size,
        built: built.map(function (row) {
          return row.slice();
        }),
      };
    }

    function importGrid(data) {
      if (!data || !data.built || data.size !== size) return false;
      if (mode === MODE.PLAY) return false;
      clearRunState();
      for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
          built[r][c] = !!data.built[r][c];
        }
      }
      built[start.r][start.c] = true;
      built[goal.r][goal.c] = true;
      mode = MODE.BUILD;
      emit();
      return true;
    }

    return {
      MODE: MODE,
      paintAt: paintAt,
      setTool: setTool,
      play: play,
      stop: stop,
      returnToBuild: returnToBuild,
      resetGrid: resetGrid,
      clearGrid: clearGrid,
      seedIncompleteStarter: seedIncompleteStarter,
      onChange: onChange,
      snapshot: snapshot,
      exportGrid: exportGrid,
      importGrid: importGrid,
      DIRS: DIRS,
    };
  }

  global.DFWCore = {
    createGame: createGame,
    DIRS: DIRS,
    MODE: MODE,
    manhattan: manhattan,
  };
})(typeof window !== "undefined" ? window : globalThis);
