/* viz.js — SVG renderers for the Kaprekar playground (histogram, overlay, flow graph). */
(function (root) {
  "use strict";
  const K = root.Kaprekar;
  const NS = "http://www.w3.org/2000/svg";

  function el(name, attrs, parent) {
    const e = document.createElementNS(NS, name);
    if (attrs) for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }

  // shared tooltip
  let tip;
  function tooltip() {
    if (!tip) {
      tip = document.createElement("div");
      tip.className = "tooltip";
      document.body.appendChild(tip);
    }
    return tip;
  }
  function showTip(html, x, y) {
    const t = tooltip();
    t.innerHTML = html;
    t.style.opacity = "1";
    t.style.left = x + 14 + "px";
    t.style.top = y + 14 + "px";
  }
  function hideTip() {
    if (tip) tip.style.opacity = "0";
  }

  // ---------------------------------------------------------------- histogram
  function histogram(container, analysis) {
    container.innerHTML = "";
    const dist = analysis.distribution;
    const keys = [...dist.keys()].filter((k) => k >= 1).sort((a, b) => a - b);
    if (!keys.length) {
      container.innerHTML =
        '<p style="color:var(--text-dim);padding:24px;text-align:center">No convergence data — this space has no single Kaprekar constant. See the space summary above.</p>';
      return;
    }
    const maxK = keys[keys.length - 1];
    const counts = keys.map((k) => dist.get(k));
    const maxCount = Math.max(...counts);
    let mode = keys[0],
      modeC = -1;
    for (const k of keys) if (dist.get(k) > modeC) (modeC = dist.get(k)), (mode = k);

    const W = Math.max(560, 70 + keys.length * 78);
    const H = 360;
    const pad = { l: 64, r: 20, t: 24, b: 54 };
    const plotW = W - pad.l - pad.r;
    const plotH = H - pad.t - pad.b;
    const svg = el("svg", { viewBox: `0 0 ${W} ${H}`, width: W, height: H }, container);

    // y gridlines
    const ticks = 5;
    for (let i = 0; i <= ticks; i++) {
      const y = pad.t + (plotH * i) / ticks;
      const val = Math.round((maxCount * (ticks - i)) / ticks);
      el("line", { class: "grid-line", x1: pad.l, y1: y, x2: W - pad.r, y2: y }, svg);
      el("text", { class: "axis-label", x: pad.l - 10, y: y + 4, "text-anchor": "end" }, svg).textContent =
        val.toLocaleString();
    }

    const bw = plotW / keys.length;
    keys.forEach((k, i) => {
      const c = dist.get(k);
      const h = maxCount ? (c / maxCount) * plotH : 0;
      const x = pad.l + i * bw + bw * 0.16;
      const y = pad.t + plotH - h;
      const w = bw * 0.68;
      const isMode = k === mode;
      const rect = el(
        "rect",
        {
          class: "bar",
          x,
          y,
          width: w,
          height: h,
          rx: 5,
          fill: isMode ? "var(--accent)" : "var(--accent-2)",
          "fill-opacity": isMode ? 0.95 : 0.55,
        },
        svg
      );
      rect.addEventListener("mousemove", (e) =>
        showTip(`<b>${c.toLocaleString()}</b> numbers<br>need <b>${k}</b> step${k === 1 ? "" : "s"}`, e.clientX, e.clientY)
      );
      rect.addEventListener("mouseleave", hideTip);
      // value on top
      el("text", { class: "bar-label", x: x + w / 2, y: y - 7, "text-anchor": "middle" }, svg).textContent =
        c.toLocaleString();
      // x label
      el(
        "text",
        { class: "bar-label", x: x + w / 2, y: pad.t + plotH + 20, "text-anchor": "middle" },
        svg
      ).textContent = k;
    });

    // axis titles
    el("text", { class: "axis-title", x: pad.l + plotW / 2, y: H - 8, "text-anchor": "middle" }, svg).textContent =
      "Kaprekar iterations to reach the constant";
    const yt = el(
      "text",
      { class: "axis-title", x: 16, y: pad.t + plotH / 2, "text-anchor": "middle" },
      svg
    );
    yt.setAttribute("transform", `rotate(-90 16 ${pad.t + plotH / 2})`);
    yt.textContent = "count of numbers";

    // mode callout
    el(
      "text",
      { x: W - pad.r, y: pad.t + 4, "text-anchor": "end", fill: "var(--accent)", "font-size": 12, "font-family": "var(--mono)" },
      svg
    ).textContent = `mode = ${mode}`;
  }

  // ------------------------------------------------------------- base overlay
  // Each curve normalized to its own peak so the shared mode-at-3 stands out.
  function overlay(container, series) {
    container.innerHTML = "";
    if (!series.length) return;
    const maxK = Math.max(...series.map((s) => Math.max(...s.keys)));
    const W = Math.max(560, 70 + maxK * 60);
    const H = 340;
    const pad = { l: 56, r: 90, t: 20, b: 48 };
    const plotW = W - pad.l - pad.r;
    const plotH = H - pad.t - pad.b;
    const svg = el("svg", { viewBox: `0 0 ${W} ${H}`, width: W, height: H }, container);

    for (let i = 0; i <= 4; i++) {
      const y = pad.t + (plotH * i) / 4;
      el("line", { class: "grid-line", x1: pad.l, y1: y, x2: W - pad.r, y2: y }, svg);
      el("text", { class: "axis-label", x: pad.l - 10, y: y + 4, "text-anchor": "end" }, svg).textContent =
        (1 - i / 4).toFixed(2);
    }
    for (let k = 1; k <= maxK; k++) {
      const x = pad.l + (plotW * (k - 1)) / Math.max(1, maxK - 1);
      el("text", { class: "axis-label", x, y: pad.t + plotH + 20, "text-anchor": "middle" }, svg).textContent = k;
    }

    // medium-tone muted palette that reads on both the light and dark grounds
    const PALETTE = [
      "#b0862f", "#4f6f82", "#7d5f88", "#a3543f", "#5f7a4e", "#3f7c86",
      "#9c6f52", "#7a6ca3", "#a86f8f", "#6a8a6f", "#8f6f3f", "#4f6f9c",
      "#9a5f7a", "#6f8552", "#86766a", "#5f8a86",
    ];
    const hue = (i) => PALETTE[i % PALETTE.length];
    series.forEach((s, idx) => {
      const peak = Math.max(...s.counts);
      let d = "";
      s.keys.forEach((k, i) => {
        const x = pad.l + (plotW * (k - 1)) / Math.max(1, maxK - 1);
        const y = pad.t + plotH - (s.counts[i] / peak) * plotH;
        d += (i ? "L" : "M") + x.toFixed(1) + " " + y.toFixed(1) + " ";
      });
      el("path", { d, fill: "none", stroke: hue(idx), "stroke-width": 2, "stroke-opacity": 0.85 }, svg);
      // base label at the right end
      const lastK = s.keys[s.keys.length - 1];
      const lx = pad.l + (plotW * (lastK - 1)) / Math.max(1, maxK - 1);
      const ly = pad.t + plotH - (s.counts[s.counts.length - 1] / peak) * plotH;
      el("text", { x: lx + 6, y: ly + 4, fill: hue(idx), "font-size": 11, "font-family": "var(--mono)" }, svg).textContent =
        "b" + s.base;
    });

    // mark x=3
    const x3 = pad.l + (plotW * 2) / Math.max(1, maxK - 1);
    el("line", { x1: x3, y1: pad.t, x2: x3, y2: pad.t + plotH, stroke: "var(--accent)", "stroke-dasharray": "4 4", "stroke-opacity": 0.6 }, svg);
    el("text", { x: x3, y: pad.t - 6, "text-anchor": "middle", fill: "var(--accent)", "font-size": 11 }, svg).textContent =
      "shared peak at 3";

    el("text", { class: "axis-title", x: pad.l + plotW / 2, y: H - 6, "text-anchor": "middle" }, svg).textContent =
      "iterations  ·  each base scaled to its own peak";
    const oyt = el("text", { class: "axis-title", x: 15, y: pad.t + plotH / 2, "text-anchor": "middle" }, svg);
    oyt.setAttribute("transform", `rotate(-90 15 ${pad.t + plotH / 2})`);
    oyt.textContent = "count ÷ that base's peak";
  }

  // ---------------------------------------------------------------- flow graph
  function flow(container, analysis) {
    container.innerHTML = "";
    const f = analysis.flow;
    if (!f) {
      container.innerHTML =
        '<p style="color:var(--text-dim);padding:28px;text-align:center">The flow graph is available when this space has a single Kaprekar constant and isn\'t too large.<br>Try base 10 with 3 digits, or base 5 with 4 digits.</p>';
      return;
    }
    const base = analysis.base,
      len = analysis.len;
    const maxDist = Math.max(...f.nodes.map((n) => n.dist));

    // Group by distance, then keep the heaviest nodes per column (the funnel
    // "spine") and fold the long tail of individual starting numbers into one
    // aggregate bucket per column — keeps any base legible.
    const PER_COL = 9;
    const cols = [];
    for (let d = 0; d <= maxDist; d++) cols[d] = [];
    f.nodes.forEach((n) => cols[n.dist].push(n));

    const kept = new Set(); // values rendered individually
    const display = []; // per column: array of {value?, weight, dist, bucket?, count?}
    cols.forEach((c, d) => {
      c.sort((a, b) => b.weight - a.weight || a.value - b.value);
      if (c.length <= PER_COL) {
        c.forEach((n) => kept.add(n.value));
        display[d] = c.slice();
      } else {
        const head = c.slice(0, PER_COL - 1);
        head.forEach((n) => kept.add(n.value));
        const tail = c.slice(PER_COL - 1);
        const bucket = {
          bucket: true,
          dist: d,
          count: tail.length,
          weight: tail.reduce((s, n) => s + n.weight, 0),
        };
        display[d] = head.concat([bucket]);
      }
    });

    const colW = 156;
    const W = (maxDist + 1) * colW + 60;
    const rowH = 50;
    const maxRows = Math.max(...display.map((c) => c.length), 1);
    const H = Math.max(260, maxRows * rowH + 80);
    const svg = el("svg", { viewBox: `0 0 ${W} ${H}`, width: W, height: H }, container);

    // column 0 (constant) on the RIGHT, far columns on the LEFT
    const colX = (d) => 60 + (maxDist - d) * colW;
    const pos = new Map();
    display.forEach((c, d) => {
      const x = colX(d);
      const gap = (H - 50) / (c.length + 1);
      c.forEach((n, i) => {
        const key = n.bucket ? "bucket:" + d : n.value;
        pos.set(key, { x, y: 50 + gap * (i + 1), node: n });
      });
      el(
        "text",
        { class: "flow-col-label", x, y: 26, "text-anchor": "middle" },
        svg
      ).textContent = d === 0 ? "constant" : d + (d === 1 ? " step" : " steps");
    });

    // edges between kept nodes only (their targets are always heavier, so kept)
    const maxW = Math.max(...f.edges.map((e) => e.weight), 1);
    f.edges.forEach((e) => {
      if (!kept.has(e.from) || !kept.has(e.to)) return;
      const a = pos.get(e.from),
        b = pos.get(e.to);
      if (!a || !b) return;
      const mx = (a.x + b.x) / 2;
      const sw = 1.2 + (e.weight / maxW) * 9;
      el(
        "path",
        {
          d: `M${a.x} ${a.y} C ${mx} ${a.y}, ${mx} ${b.y}, ${b.x} ${b.y}`,
          fill: "none",
          stroke: "var(--accent-2)",
          "stroke-width": sw,
          "stroke-opacity": 0.32,
          "stroke-linecap": "round",
        },
        svg
      );
    });

    const maxNodeW = Math.max(...f.nodes.map((n) => n.weight), 1);
    const showLabels = maxRows * (maxDist + 1) <= 120;
    display.forEach((c) => {
      c.forEach((n) => {
        const key = n.bucket ? "bucket:" + n.dist : n.value;
        const p = pos.get(key);
        const g = el("g", { class: "flow-node" }, svg);
        if (n.bucket) {
          const w = 96,
            h = 30;
          el(
            "rect",
            { x: p.x - w / 2, y: p.y - h / 2, width: w, height: h, rx: 7, fill: "var(--bg-elev)", stroke: "var(--line)", "stroke-dasharray": "3 3" },
            g
          );
          el(
            "text",
            { x: p.x, y: p.y + 4, "text-anchor": "middle", fill: "var(--text-dim)", "font-size": 11 },
            g
          ).textContent = "+" + n.count + " more";
          g.addEventListener("mousemove", (e) =>
            showTip(`${n.count} more values<br><b>${n.weight.toLocaleString()}</b> numbers total`, e.clientX, e.clientY)
          );
        } else {
          const isConst = n.dist === 0;
          const r = 9 + Math.sqrt(n.weight / maxNodeW) * 14;
          el(
            "circle",
            {
              cx: p.x,
              cy: p.y,
              r,
              fill: isConst ? "var(--accent)" : "var(--bg-elev)",
              stroke: isConst ? "var(--accent)" : "var(--accent-2)",
              "stroke-width": 2,
              "fill-opacity": 1,
            },
            g
          );
          if (showLabels || isConst) {
            el(
              "text",
              { x: p.x, y: p.y + 4, "text-anchor": "middle", fill: isConst ? "var(--accent-ink)" : "var(--text)" },
              g
            ).textContent = K.format(n.value, base, len);
          }
          g.addEventListener("mousemove", (e) =>
            showTip(
              `<b>${K.format(n.value, base, len)}</b> (= ${n.value})<br>${n.weight.toLocaleString()} numbers pass here<br>${n.dist} step${n.dist === 1 ? "" : "s"} from constant`,
              e.clientX,
              e.clientY
            )
          );
        }
        g.addEventListener("mouseleave", hideTip);
      });
    });
  }

  root.Viz = { histogram, overlay, flow };
})(typeof window !== "undefined" ? window : globalThis);
