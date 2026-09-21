/**
 * Design Fail Watch — app shell (controls, skin switch, canvas I/O)
 */
(function () {
  "use strict";

  const GRID = 8;
  const CANVAS_CSS = 480;

  function readSkinFromURL() {
    return "a"; // shareable / Gate 2b: Skin A only
  }

  function writeSkinToURL(skin) {
    const url = new URL(window.location.href);
    url.searchParams.set("skin", skin);
    window.history.replaceState({}, "", url.toString());
  }

  // Persist grid across skin switches (same page re-render)
  const STORAGE_KEY = "dfw-fail-first-v1-grid";

  let skinId = "a"; // shareable: Skin A only (D3)
  let game = DFWCore.createGame({ size: GRID });
  let painting = false;

  // Shareable / Gate 2b: always cold-load incomplete starter (ignore stale session).
  let hadSessionGrid = false;
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch (_) {}
  // hadSessionGrid stays false — seed below;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      if (data && data.size === GRID) {
        game.importGrid(data);
        hadSessionGrid = true;
      }
    }
  } catch (e) {
    /* ignore */
  }
  if (!hadSessionGrid) {
    game.seedIncompleteStarter();
  }

  const els = {
    app: document.getElementById("app"),
    canvas: document.getElementById("canvas"),
    tagline: document.getElementById("tagline"),
    footer: document.getElementById("footer-note"),
    legendList: document.getElementById("legend-list"),
    ruleText: document.getElementById("rule-text"),
    status: document.getElementById("status"),
    overlay: document.getElementById("overlay-msg"),
    buildHint: document.getElementById("build-hint"),
    glanceHint: document.getElementById("glance-hint"),
    btnPlay: document.getElementById("btn-play"),
    btnStop: document.getElementById("btn-stop"),
    btnReset: document.getElementById("btn-reset"),
    btnClear: document.getElementById("btn-clear"),
    toolPaint: document.getElementById("tool-paint"),
    toolErase: document.getElementById("tool-erase"),
    btnSkinA: document.getElementById("btn-skin-a"),
    btnSkinB: document.getElementById("btn-skin-b"),
  };

  const ctx = els.canvas.getContext("2d");

  function persistGrid() {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(game.exportGrid()));
    } catch (e) {
      /* ignore */
    }
  }

  function applySkinChrome() {
    const skin = DFWSkins.get(skinId);
    els.app.classList.remove("skin-a", "skin-b");
    els.app.classList.add("skin-" + skinId);
    els.tagline.textContent = skin.tagline;
    els.footer.textContent = skin.footer;
    if (els.btnSkinA) els.btnSkinA.classList.toggle("active", skinId === "a");
    if (els.btnSkinB) els.btnSkinB.classList.toggle("active", skinId === "b");
    els.legendList.innerHTML = "";
    skin.legend.forEach(function (item) {
      const li = document.createElement("li");
      const sw = document.createElement("span");
      sw.className = "swatch";
      sw.style.background = item.color;
      li.appendChild(sw);
      li.appendChild(document.createTextNode(item.label));
      els.legendList.appendChild(li);
    });
  }

  function setSkin(next) {
    if (next !== "a" && next !== "b") return;
    persistGrid();
    skinId = next;
    writeSkinToURL(skinId);
    applySkinChrome();
    render(game.snapshot());
  }

  function cellFromEvent(ev) {
    const rect = els.canvas.getBoundingClientRect();
    const scaleX = els.canvas.width / rect.width;
    const scaleY = els.canvas.height / rect.height;
    const x = (ev.clientX - rect.left) * scaleX;
    const y = (ev.clientY - rect.top) * scaleY;
    const size = GRID;
    const cell = Math.min(els.canvas.width, els.canvas.height) / size;
    const ox = (els.canvas.width - cell * size) / 2;
    const oy = (els.canvas.height - cell * size) / 2;
    const c = Math.floor((x - ox) / cell);
    const r = Math.floor((y - oy) / cell);
    if (r < 0 || c < 0 || r >= size || c >= size) return null;
    return { r: r, c: c };
  }

  function canvasCssSize() {
    const stage = document.getElementById("stage");
    const avail = stage ? stage.clientWidth : CANVAS_CSS;
    // Keep square; shrink on narrow viewports (~390px phones)
    return Math.max(280, Math.min(CANVAS_CSS, avail || CANVAS_CSS));
  }

  let failPulseRaf = null;

  function stopFailPulse() {
    if (failPulseRaf != null) {
      cancelAnimationFrame(failPulseRaf);
      failPulseRaf = null;
    }
  }

  function ensureFailPulse(state) {
    const need =
      state.mode === "done" && !state.success && state.failLocus;
    if (need && failPulseRaf == null) {
      const tick = function () {
        failPulseRaf = requestAnimationFrame(tick);
        const dpr = window.devicePixelRatio || 1;
        const css = canvasCssSize();
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        DFWSkins.get(skinId).draw(
          ctx,
          Object.assign({}, game.snapshot(), {
            failPulseT: performance.now(),
          }),
          css,
          css
        );
      };
      failPulseRaf = requestAnimationFrame(tick);
    } else if (!need) {
      stopFailPulse();
    }
  }

  
  function scrollFailIntoView() {
    // F1/F2: keep fail locus in first fold without manual hunt
    try {
      const stage = document.getElementById('stage') || els.canvas;
      if (stage && stage.scrollIntoView) {
        stage.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
      // Prefer top of board visible on narrow phones
      if (els.canvas && els.canvas.getBoundingClientRect) {
        const rect = els.canvas.getBoundingClientRect();
        if (rect.bottom > window.innerHeight || rect.top < 0) {
          const y = window.scrollY + rect.top - 12;
          window.scrollTo({ top: Math.max(0, y), behavior: 'smooth' });
        }
      }
    } catch (_) {}
  }

  function render(state) {
    els.app.classList.toggle("mode-play", state.mode === "play");
    stopFailPulse();

    // HiDPI + responsive CSS size
    const dpr = window.devicePixelRatio || 1;
    const css = canvasCssSize();
    const needW = Math.round(css * dpr);
    if (els.canvas.width !== needW) {
      els.canvas.width = needW;
      els.canvas.height = needW;
      els.canvas.style.width = css + "px";
      els.canvas.style.height = css + "px";
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const drawState =
      state.mode === "done" && !state.success && state.failLocus
        ? Object.assign({}, state, { failPulseT: performance.now() })
        : state;
    DFWSkins.get(skinId).draw(ctx, drawState, css, css);

    els.ruleText.textContent = state.RULE_TEXT;
    els.toolPaint.classList.toggle("active", state.tool === "paint");
    els.toolErase.classList.toggle("active", state.tool === "erase");
    els.toolPaint.disabled = !state.canEdit;
    els.toolErase.disabled = !state.canEdit;
    els.btnPlay.disabled = state.mode === "play";
    els.btnStop.disabled = state.mode !== "play";
    els.btnReset.disabled = state.mode === "play";
    if (els.btnClear) els.btnClear.disabled = state.mode === "play";

    if (state.mode === "build") {
      els.status.textContent =
        "Mode: Build — broken starter on the board. Press Play to see where it breaks, then edit.";
      els.overlay.className = "overlay-msg hidden";
      els.buildHint.textContent =
        "Broken design — press Play. Then paint the gap and re-run.";
      if (els.glanceHint) {
        scrollFailIntoView();
      els.glanceHint.textContent = "Broken design — press Play.";
        els.glanceHint.className = "glance-hint";
      }
    } else if (state.mode === "play") {
      els.status.textContent = "Mode: Play — hands off. Build tools disabled until the run ends.";
      els.overlay.className = "overlay-msg";
      els.overlay.textContent = "Watching…";
      if (els.glanceHint) {
        els.glanceHint.textContent = "Watching — hands off";
        els.glanceHint.className = "glance-hint watching";
      }
    } else if (state.mode === "done") {
      if (state.success) {
        els.status.textContent =
          "Goal reached — path held. Edit and Play again anytime.";
        els.overlay.className = "overlay-msg ok quiet";
        els.overlay.textContent = "Goal.";
        if (els.glanceHint) {
          els.glanceHint.textContent = "Goal — edit & Play again anytime";
          els.glanceHint.className = "glance-hint done-ok";
        }
      } else {
        const fl = state.failLocus;
        const coord = "(" + fl.cell.r + "," + fl.cell.c + ")";
        els.status.textContent =
          "Fail at " + coord + " — " + fl.reason + " Edit and re-run free.";
        els.overlay.className = "overlay-msg fail";
        els.overlay.textContent =
          "Broke at " + coord + " — next step never built";
        if (els.glanceHint) {
          els.glanceHint.textContent = "Broke here — next step never built";
          els.glanceHint.className = "glance-hint done-fail";
        }
        ensureFailPulse(state);
      }
    }
  }

  game.onChange(function (state) {
    persistGrid();
    render(state);
  });

  // Tools
  els.toolPaint.addEventListener("click", function () {
    game.setTool("paint");
  });
  els.toolErase.addEventListener("click", function () {
    game.setTool("erase");
  });
  els.btnPlay.addEventListener("click", function () {
    game.play(260);
  });
  els.btnStop.addEventListener("click", function () {
    game.stop();
  });
  els.btnReset.addEventListener("click", function () {
    game.resetGrid(); // restores incomplete starter (fail lesson)
    persistGrid();
  });
  if (els.btnClear) {
    els.btnClear.addEventListener("click", function () {
      game.clearGrid(); // blank S/G only
      persistGrid();
    });
  }

  // Skin A only on shareable — buttons may be absent; never crash before canvas listeners.
  if (els.btnSkinA) {
    els.btnSkinA.addEventListener("click", function () {
      setSkin("a");
    });
  }
  if (els.btnSkinB) {
    els.btnSkinB.addEventListener("click", function () {
      setSkin("b");
    });
  }

  // Canvas paint
  els.canvas.addEventListener("mousedown", function (ev) {
    if (ev.button !== 0) return;
    const state = game.snapshot();
    if (!state.canEdit) return;
    painting = true;
    // After done, first paint returns to build (core handles)
    if (state.mode === "done") {
      // painting will clear via paintAt
    }
    const cell = cellFromEvent(ev);
    if (cell) game.paintAt(cell.r, cell.c);
  });
  window.addEventListener("mouseup", function () {
    painting = false;
  });
  els.canvas.addEventListener("mouseleave", function () {
    painting = false;
  });
  els.canvas.addEventListener("mousemove", function (ev) {
    if (!painting) return;
    if (!game.snapshot().canEdit) return;
    const cell = cellFromEvent(ev);
    if (cell) game.paintAt(cell.r, cell.c);
  });

  // Touch
  els.canvas.addEventListener(
    "touchstart",
    function (ev) {
      if (!game.snapshot().canEdit) return;
      painting = true;
      const t = ev.touches[0];
      const cell = cellFromEvent(t);
      if (cell) game.paintAt(cell.r, cell.c);
      ev.preventDefault();
    },
    { passive: false }
  );
  els.canvas.addEventListener(
    "touchmove",
    function (ev) {
      if (!painting) return;
      if (!game.snapshot().canEdit) return;
      const t = ev.touches[0];
      const cell = cellFromEvent(t);
      if (cell) game.paintAt(cell.r, cell.c);
      ev.preventDefault();
    },
    { passive: false }
  );
  els.canvas.addEventListener("touchend", function () {
    painting = false;
  });

  // After fail/success, clicking canvas in done mode starts edit (paintAt already does)
  // Also: click status area — allow explicit "edit again" by any paint

  let resizeTimer = null;
  window.addEventListener("resize", function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      render(game.snapshot());
    }, 100);
  });

  applySkinChrome();
  render(game.snapshot());
  persistGrid();
})();
