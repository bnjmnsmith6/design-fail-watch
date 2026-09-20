/**
 * Design Fail Watch — app shell (controls, skin switch, canvas I/O)
 */
(function () {
  "use strict";

  const GRID = 8;
  const CANVAS_CSS = 480;

  function readSkinFromURL() {
    const q = new URLSearchParams(window.location.search);
    const s = (q.get("skin") || "a").toLowerCase();
    return s === "b" ? "b" : "a";
  }

  function writeSkinToURL(skin) {
    const url = new URL(window.location.href);
    url.searchParams.set("skin", skin);
    window.history.replaceState({}, "", url.toString());
  }

  // Persist grid across skin switches (same page re-render)
  const STORAGE_KEY = "dfw-v0-grid";

  let skinId = readSkinFromURL();
  let game = DFWCore.createGame({ size: GRID });
  let painting = false;

  // Restore grid if present (same session / skin toggle)
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      if (data && data.size === GRID) game.importGrid(data);
    }
  } catch (e) {
    /* ignore */
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
    els.btnSkinA.classList.toggle("active", skinId === "a");
    els.btnSkinB.classList.toggle("active", skinId === "b");
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

  function render(state) {
    els.app.classList.toggle("mode-play", state.mode === "play");

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

    DFWSkins.get(skinId).draw(ctx, state, css, css);

    els.ruleText.textContent = state.RULE_TEXT;
    els.toolPaint.classList.toggle("active", state.tool === "paint");
    els.toolErase.classList.toggle("active", state.tool === "erase");
    els.toolPaint.disabled = !state.canEdit;
    els.toolErase.disabled = !state.canEdit;
    els.btnPlay.disabled = state.mode === "play";
    els.btnStop.disabled = state.mode !== "play";
    els.btnReset.disabled = state.mode === "play";

    if (state.mode === "build") {
      els.status.textContent =
        "Mode: Build — paint a continuous path from Start (S) to Goal (G), then Play.";
      els.overlay.className = "overlay-msg hidden";
      els.buildHint.textContent =
        "Paint / drag tiles S→G. Erase removes. Start & Goal stay fixed.";
      if (els.glanceHint) {
        els.glanceHint.textContent = "Paint path S→G, then Play";
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
          "Complete — continuous path held. Edit freely and Play again (no cost).";
        els.overlay.className = "overlay-msg ok";
        els.overlay.textContent = "Reached Goal. Edit tiles and re-run anytime.";
        if (els.glanceHint) {
          els.glanceHint.textContent = "Made it — edit & Play again anytime";
          els.glanceHint.className = "glance-hint done-ok";
        }
      } else {
        const fl = state.failLocus;
        els.status.textContent =
          "Fail at (" +
          fl.cell.r +
          "," +
          fl.cell.c +
          ") — " +
          fl.reason +
          " Edit and re-run free.";
        els.overlay.className = "overlay-msg fail";
        els.overlay.textContent = fl.reason;
        if (els.glanceHint) {
          els.glanceHint.textContent = "Broke here — fix the gap, then Play";
          els.glanceHint.className = "glance-hint done-fail";
        }
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
    game.resetGrid();
    persistGrid();
  });

  els.btnSkinA.addEventListener("click", function () {
    setSkin("a");
  });
  els.btnSkinB.addEventListener("click", function () {
    setSkin("b");
  });

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
})();
