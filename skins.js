/**
 * Design Fail Watch — skin render hooks
 * Skin A: abstract shapes / blocks
 * Skin B: unfinished drawing / sketchbook; agent = plain DOT (failure = never drawn)
 */

(function (global) {
  "use strict";

  function cellRect(size, canvasW, canvasH, r, c, pad) {
    const p = pad == null ? 0 : pad;
    const cell = Math.min(canvasW, canvasH) / size;
    const ox = (canvasW - cell * size) / 2;
    const oy = (canvasH - cell * size) / 2;
    return {
      x: ox + c * cell + p,
      y: oy + r * cell + p,
      w: cell - p * 2,
      h: cell - p * 2,
      cell: cell,
      ox: ox,
      oy: oy,
    };
  }

  /* ——— Skin A: Abstract ——— */
  const skinA = {
    id: "a",
    name: "Abstract",
    tagline: "Broken design on the board. Press Play. Watch where it breaks.",
    footer:
      "Shapes through structure. Fail marker = exact cell where the path was never finished.",
    legend: [
      { color: "#4ecdc4", label: "Start" },
      { color: "#ffe66d", label: "Goal" },
      { color: "#5c6370", label: "Built tile" },
      { color: "#6ea8fe", label: "Agent" },
      { color: "#ff6b6b", label: "Fail locus" },
    ],
    draw: function (ctx, state, w, h) {
      const size = state.size;
      const cell = Math.min(w, h) / size;
      const ox = (w - cell * size) / 2;
      const oy = (h - cell * size) / 2;

      // background
      ctx.fillStyle = "#1a1b1e";
      ctx.fillRect(0, 0, w, h);

      // grid empties + built
      for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
          const x = ox + c * cell;
          const y = oy + r * cell;
          if (state.built[r][c]) {
            ctx.fillStyle = "#3d4149";
            ctx.fillRect(x + 2, y + 2, cell - 4, cell - 4);
            ctx.strokeStyle = "#6a7180";
            ctx.lineWidth = 1.5;
            ctx.strokeRect(x + 2.5, y + 2.5, cell - 5, cell - 5);
          } else {
            ctx.fillStyle = "#25272c";
            ctx.fillRect(x + 1, y + 1, cell - 2, cell - 2);
            ctx.strokeStyle = "#30333a";
            ctx.lineWidth = 1;
            ctx.strokeRect(x + 0.5, y + 0.5, cell - 1, cell - 1);
          }
        }
      }

      // walk trail (subtle)
      if (state.walkPath && state.walkPath.length && state.mode !== "build") {
        ctx.strokeStyle = "rgba(110,168,254,0.35)";
        ctx.lineWidth = 3;
        ctx.lineJoin = "round";
        ctx.beginPath();
        for (let i = 0; i <= state.walkIndex && i < state.walkPath.length; i++) {
          const p = state.walkPath[i];
          const cx = ox + (p.c + 0.5) * cell;
          const cy = oy + (p.r + 0.5) * cell;
          if (i === 0) ctx.moveTo(cx, cy);
          else ctx.lineTo(cx, cy);
        }
        ctx.stroke();
      }

      // Start / Goal markers
      drawLabel(ctx, ox, oy, cell, state.start, "S", "#4ecdc4");
      drawLabel(ctx, ox, oy, cell, state.goal, "G", "#ffe66d");

      // Agent token
      if (state.mode === "play" || state.mode === "done") {
        const ax = ox + (state.agent.c + 0.5) * cell;
        const ay = oy + (state.agent.r + 0.5) * cell;
        ctx.beginPath();
        ctx.fillStyle = state.success ? "#6bcb77" : "#6ea8fe";
        if (state.failLocus) ctx.fillStyle = "#ff8e8e";
        ctx.arc(ax, ay, cell * 0.22, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#0d1117";
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      // Fail locus — punchy at ~390px: last + missing + arrow/pulse (D2)
      if (state.failLocus) {
        const fc = state.failLocus.cell;
        const fx = ox + fc.c * cell;
        const fy = oy + fc.r * cell;
        const t = state.failPulseT != null ? state.failPulseT : 0;
        const pulse = 0.55 + 0.45 * Math.sin(t / 180);
        const pulse2 = 0.55 + 0.45 * Math.sin(t / 180 + Math.PI);

        // dim board so locus pops
        ctx.fillStyle = "rgba(0,0,0,0.34)";
        ctx.fillRect(ox, oy, cell * size, cell * size);

        // re-draw fail cell + S/G above the dim
        if (state.built[fc.r][fc.c]) {
          ctx.fillStyle = "#3d4149";
          ctx.fillRect(fx + 2, fy + 2, cell - 4, cell - 4);
          ctx.strokeStyle = "#6a7180";
          ctx.lineWidth = 1.5;
          ctx.strokeRect(fx + 2.5, fy + 2.5, cell - 5, cell - 5);
        }
        drawLabel(ctx, ox, oy, cell, state.start, "S", "#4ecdc4");
        drawLabel(ctx, ox, oy, cell, state.goal, "G", "#ffe66d");

        // expected empty — thicker gap + "?" + pulse wash
        if (state.failLocus.expected) {
          const e = state.failLocus.expected;
          const ex = ox + e.c * cell;
          const ey = oy + e.r * cell;
          ctx.fillStyle = "rgba(255,107,107," + (0.18 + 0.22 * pulse2).toFixed(3) + ")";
          ctx.fillRect(ex + 1, ey + 1, cell - 2, cell - 2);
          ctx.setLineDash([5, 4]);
          ctx.strokeStyle = "#ff6b6b";
          ctx.lineWidth = Math.max(3.5, cell * 0.09);
          ctx.strokeRect(ex + 3, ey + 3, cell - 6, cell - 6);
          ctx.setLineDash([]);
          // outer pulse ring on missing cell
          ctx.save();
          ctx.globalAlpha = 0.35 + 0.45 * pulse2;
          ctx.strokeStyle = "#ffc9c9";
          ctx.lineWidth = Math.max(2, cell * 0.045);
          const grow = 2 + pulse2 * 4;
          ctx.strokeRect(ex + 3 - grow, ey + 3 - grow, cell - 6 + grow * 2, cell - 6 + grow * 2);
          ctx.restore();
          ctx.fillStyle = "#ffb0b0";
          ctx.font = "bold " + Math.floor(cell * 0.38) + "px system-ui,sans-serif";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText("?", ex + cell / 2, ey + cell / 2);

          // connector arrow: last → missing (pulsed width/alpha)
          const x0 = fx + cell / 2;
          const y0 = fy + cell / 2;
          const x1 = ex + cell / 2;
          const y1 = ey + cell / 2;
          const dx = x1 - x0;
          const dy = y1 - y0;
          const len = Math.sqrt(dx * dx + dy * dy) || 1;
          const ux = dx / len;
          const uy = dy / len;
          const inset = cell * 0.26;
          const ax0 = x0 + ux * inset;
          const ay0 = y0 + uy * inset;
          const ax1 = x1 - ux * inset;
          const ay1 = y1 - uy * inset;
          ctx.save();
          ctx.globalAlpha = 0.75 + 0.25 * pulse;
          ctx.strokeStyle = "#ff6b6b";
          ctx.lineWidth = Math.max(3.5, cell * 0.08) * (0.85 + 0.3 * pulse);
          ctx.lineCap = "round";
          ctx.beginPath();
          ctx.moveTo(ax0, ay0);
          ctx.lineTo(ax1, ay1);
          ctx.stroke();
          const ah = cell * 0.2;
          ctx.beginPath();
          ctx.moveTo(ax1, ay1);
          ctx.lineTo(ax1 - ux * ah - uy * ah * 0.7, ay1 - uy * ah + ux * ah * 0.7);
          ctx.lineTo(ax1 - ux * ah + uy * ah * 0.7, ay1 - uy * ah - ux * ah * 0.7);
          ctx.closePath();
          ctx.fillStyle = "#ff6b6b";
          ctx.fill();
          ctx.restore();
        }

        // last occupied — thick glow ring + X (pulsed)
        ctx.save();
        ctx.shadowColor = "#ff6b6b";
        ctx.shadowBlur = Math.max(18, cell * 0.4) * (0.7 + 0.5 * pulse);
        ctx.strokeStyle = "#ff6b6b";
        ctx.lineWidth = Math.max(4.5, cell * 0.1);
        ctx.strokeRect(fx + 2, fy + 2, cell - 4, cell - 4);
        ctx.restore();
        ctx.fillStyle = "rgba(255,107,107," + (0.22 + 0.18 * pulse).toFixed(3) + ")";
        ctx.fillRect(fx + 2, fy + 2, cell - 4, cell - 4);

        ctx.strokeStyle = "#ffe0e0";
        ctx.lineWidth = Math.max(3, cell * 0.065);
        const m = cell * 0.28;
        const cx = fx + cell / 2;
        const cy = fy + cell / 2;
        ctx.beginPath();
        ctx.moveTo(cx - m, cy - m);
        ctx.lineTo(cx + m, cy + m);
        ctx.moveTo(cx + m, cy - m);
        ctx.lineTo(cx - m, cy + m);
        ctx.stroke();

        // tiny "HERE" under last cell when cell is large enough
        if (cell >= 36) {
          ctx.fillStyle = "#ffc9c9";
          ctx.font = "bold " + Math.floor(cell * 0.16) + "px system-ui,sans-serif";
          ctx.textAlign = "center";
          ctx.textBaseline = "top";
          ctx.fillText("HERE", cx, fy + cell - Math.max(10, cell * 0.2));
        }
      }

    },
  };

  function drawLabel(ctx, ox, oy, cell, pos, letter, color) {
    const x = ox + pos.c * cell;
    const y = oy + pos.r * cell;
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.25;
    ctx.fillRect(x + 3, y + 3, cell - 6, cell - 6);
    ctx.globalAlpha = 1;
    ctx.fillStyle = color;
    ctx.font = "bold " + Math.floor(cell * 0.35) + "px system-ui,sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(letter, x + cell / 2, y + cell / 2);
  }

  /* ——— Skin B: Embodied unfinished drawing ——— */
  const skinB = {
    id: "b",
    name: "Unfinished drawing",
    tagline: "Draw the path. Press Play. See where the page was never finished.",
    footer:
      "A plain dot moves across unfinished paper. Fail = blank / torn “never drawn” locus — drama is the page, not a character.",
    legend: [
      { color: "#2a6b6b", label: "Start (ink)" },
      { color: "#8a7020", label: "Goal" },
      { color: "#c4a882", label: "Drawn strokes" },
      { color: "#5c4033", label: "Dot (agent)" },
      { color: "#a63d3d", label: "Torn / never drawn" },
    ],
    draw: function (ctx, state, w, h) {
      const size = state.size;
      const cell = Math.min(w, h) / size;
      const ox = (w - cell * size) / 2;
      const oy = (h - cell * size) / 2;

      // paper
      ctx.fillStyle = "#faf6ef";
      ctx.fillRect(0, 0, w, h);

      // subtle paper grain lines
      ctx.strokeStyle = "rgba(196,184,165,0.35)";
      ctx.lineWidth = 1;
      for (let i = 0; i < 12; i++) {
        const yy = ((i + 1) * h) / 13;
        ctx.beginPath();
        ctx.moveTo(8, yy);
        ctx.lineTo(w - 8, yy);
        ctx.stroke();
      }

      // empty cells = blank paper; built = ink strokes (sketchy rects)
      for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
          const x = ox + c * cell;
          const y = oy + r * cell;
          // light grid guide
          ctx.strokeStyle = "rgba(180,168,150,0.4)";
          ctx.lineWidth = 0.75;
          ctx.strokeRect(x + 0.5, y + 0.5, cell - 1, cell - 1);

          if (state.built[r][c]) {
            sketchStroke(ctx, x, y, cell);
          }
        }
      }

      // trail of footsteps (dashed)
      if (state.walkPath && state.walkPath.length && state.mode !== "build") {
        ctx.strokeStyle = "rgba(92,64,51,0.35)";
        ctx.lineWidth = 2;
        ctx.setLineDash([3, 5]);
        ctx.beginPath();
        for (let i = 0; i <= state.walkIndex && i < state.walkPath.length; i++) {
          const p = state.walkPath[i];
          const cx = ox + (p.c + 0.5) * cell;
          const cy = oy + (p.r + 0.5) * cell;
          if (i === 0) ctx.moveTo(cx, cy);
          else ctx.lineTo(cx, cy);
        }
        ctx.stroke();
        ctx.setLineDash([]);
      }

      drawInkLabel(ctx, ox, oy, cell, state.start, "S", "#2a6b6b");
      drawInkLabel(ctx, ox, oy, cell, state.goal, "G", "#8a7020");

      // Fail: dot at edge of unfinished drawing
      if (state.failLocus) {
        const fc = state.failLocus.cell;
        const fx = ox + fc.c * cell;
        const fy = oy + fc.r * cell;

        // torn / blank paper beyond
        if (state.failLocus.expected) {
          const e = state.failLocus.expected;
          const ex = ox + e.c * cell;
          const ey = oy + e.r * cell;
          // white-out / missing strokes
          ctx.fillStyle = "#fffef9";
          ctx.fillRect(ex + 2, ey + 2, cell - 4, cell - 4);
          // torn edge zig-zag toward fail cell
          drawTornEdge(ctx, fx, fy, cell, e, fc);
          ctx.setLineDash([4, 3]);
          ctx.strokeStyle = "#a63d3d";
          ctx.lineWidth = 1.5;
          ctx.strokeRect(ex + 5, ey + 5, cell - 10, cell - 10);
          ctx.setLineDash([]);
          ctx.fillStyle = "rgba(166,61,61,0.08)";
          ctx.fillRect(ex + 5, ey + 5, cell - 10, cell - 10);

          // caption hint
          ctx.fillStyle = "#a63d3d";
          ctx.font = "italic " + Math.max(9, Math.floor(cell * 0.18)) + "px Georgia,serif";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText("never", ex + cell / 2, ey + cell / 2 - 5);
          ctx.fillText("drawn", ex + cell / 2, ey + cell / 2 + 7);
        }

        // glow on last drawn cell
        ctx.save();
        ctx.shadowColor = "#a63d3d";
        ctx.shadowBlur = 14;
        ctx.strokeStyle = "#a63d3d";
        ctx.lineWidth = 2.5;
        ctx.strokeRect(fx + 5, fy + 5, cell - 10, cell - 10);
        ctx.restore();
      }

      // Shared agent = minimal dot (taste lock: complexity from unfinished world, not character)
      if (state.mode === "play" || state.mode === "done") {
        drawAgentDot(
          ctx,
          ox + (state.agent.c + 0.5) * cell,
          oy + (state.agent.r + 0.5) * cell,
          cell,
          state.failLocus ? "fail" : state.success ? "ok" : "walk"
        );
      }
    },
  };

  function sketchStroke(ctx, x, y, cell) {
    const inset = cell * 0.12;
    ctx.save();
    ctx.translate(x + cell / 2, y + cell / 2);
    // slight wobble seed from position — deterministic visual only (not sim RNG)
    const wobble = ((x * 13 + y * 7) % 5) - 2;
    ctx.rotate((wobble * Math.PI) / 180);
    ctx.fillStyle = "#e8dcc8";
    ctx.fillRect(-cell / 2 + inset, -cell / 2 + inset, cell - inset * 2, cell - inset * 2);
    ctx.strokeStyle = "#5c4033";
    ctx.lineWidth = 1.8;
    ctx.strokeRect(
      -cell / 2 + inset + 1,
      -cell / 2 + inset + 1,
      cell - inset * 2 - 2,
      cell - inset * 2 - 2
    );
    // cross-hatch hint
    ctx.strokeStyle = "rgba(92,64,51,0.35)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-cell / 2 + inset + 4, cell / 2 - inset - 4);
    ctx.lineTo(cell / 2 - inset - 4, -cell / 2 + inset + 4);
    ctx.stroke();
    ctx.restore();
  }

  function drawInkLabel(ctx, ox, oy, cell, pos, letter, color) {
    const x = ox + pos.c * cell + cell / 2;
    const y = oy + pos.r * cell + cell / 2;
    ctx.fillStyle = color;
    ctx.font = "bold " + Math.floor(cell * 0.32) + "px Georgia,serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(letter, x, y);
  }

  function drawTornEdge(ctx, fx, fy, cell, expected, fail) {
    // jagged line on the shared edge between fail and expected
    const dr = expected.r - fail.r;
    const dc = expected.c - fail.c;
    ctx.strokeStyle = "#a63d3d";
    ctx.lineWidth = 2;
    ctx.beginPath();
    if (dc === 1) {
      // expected to the east — tear on right edge of fail
      const x = fx + cell;
      ctx.moveTo(x, fy + 4);
      for (let i = 0; i < 6; i++) {
        ctx.lineTo(x + (i % 2 === 0 ? 4 : -2), fy + 4 + ((i + 1) * (cell - 8)) / 6);
      }
    } else if (dc === -1) {
      const x = fx;
      ctx.moveTo(x, fy + 4);
      for (let i = 0; i < 6; i++) {
        ctx.lineTo(x + (i % 2 === 0 ? -4 : 2), fy + 4 + ((i + 1) * (cell - 8)) / 6);
      }
    } else if (dr === 1) {
      const y = fy + cell;
      ctx.moveTo(fx + 4, y);
      for (let i = 0; i < 6; i++) {
        ctx.lineTo(fx + 4 + ((i + 1) * (cell - 8)) / 6, y + (i % 2 === 0 ? 4 : -2));
      }
    } else if (dr === -1) {
      const y = fy;
      ctx.moveTo(fx + 4, y);
      for (let i = 0; i < 6; i++) {
        ctx.lineTo(fx + 4 + ((i + 1) * (cell - 8)) / 6, y + (i % 2 === 0 ? -4 : 2));
      }
    }
    ctx.stroke();
  }

  function drawAgentDot(ctx, cx, cy, cell, mood) {
    const r = cell * 0.2;
    const fill =
      mood === "fail" ? "#a63d3d" : mood === "ok" ? "#3d7a4a" : "#5c4033";
    ctx.beginPath();
    ctx.fillStyle = fill;
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = mood === "fail" ? "#6b2020" : "rgba(0,0,0,0.35)";
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  global.DFWSkins = {
    a: skinA,
    b: skinB,
    get: function (id) {
      return id === "b" ? skinB : skinA;
    },
  };
})(typeof window !== "undefined" ? window : globalThis);
