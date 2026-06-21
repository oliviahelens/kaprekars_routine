/* app.js — UI controller for the Kaprekar playground. */
(function () {
  "use strict";
  const K = window.Kaprekar;
  const Viz = window.Viz;
  const $ = (id) => document.getElementById(id);

  const state = { base: 10, len: 4, activeTab: "routine" };
  const analysisCache = new Map();
  let runToken = 0; // cancels in-flight animations

  // ---- helpers -------------------------------------------------------------
  function parseValue(str, base) {
    str = (str || "").trim().toUpperCase();
    if (!str) return null;
    let v = 0;
    for (const ch of str) {
      const d = K.GLYPHS.indexOf(ch);
      if (d < 0 || d >= base) return null;
      v = v * base + d;
    }
    return v;
  }

  function combosWithRep(n, k) {
    // C(n + k - 1, k)
    let num = 1,
      den = 1;
    for (let i = 0; i < k; i++) {
      num *= n + k - 1 - i;
      den *= i + 1;
    }
    return num / den;
  }

  const ANALYSIS_CAP = 500000;
  function getAnalysis() {
    const key = state.base + "_" + state.len;
    if (analysisCache.has(key)) return analysisCache.get(key);
    const size = combosWithRep(state.base, state.len);
    let res;
    if (size > ANALYSIS_CAP) res = { tooLarge: true, base: state.base, len: state.len };
    else res = K.analyze(state.base, state.len);
    analysisCache.set(key, res);
    return res;
  }

  // ---- space summary -------------------------------------------------------
  function renderSpaceSummary() {
    const a = getAnalysis();
    const box = $("space-info");
    if (a.tooLarge) {
      box.innerHTML = `space too large to map fully — the <i>Routine</i> still works`;
      return;
    }
    if (a.constant != null) {
      const f = K.format(a.constant, a.base, a.len);
      box.innerHTML = `converges to <b>${f}</b>${
        a.base !== 10 ? ` <span style="color:var(--text-faint)">(=${a.constant})</span>` : ""
      } · ≤ ${a.maxIterations} steps`;
    } else if (a.fixedPoints.length || a.cycles.length) {
      const parts = [];
      if (a.fixedPoints.length)
        parts.push(`${a.fixedPoints.length} fixed point${a.fixedPoints.length === 1 ? "" : "s"}`);
      if (a.cycles.length) parts.push(`<span class="cyc">${a.cycles.length} cycle${a.cycles.length === 1 ? "" : "s"}</span>`);
      box.innerHTML = `no single constant · ${parts.join(" + ")}`;
    } else {
      box.innerHTML = `every number collapses to 0`;
    }
  }

  // ---- routine stepper -----------------------------------------------------
  let routine = { path: null, shown: 0 };

  function numBlock(label, digits, cls) {
    const block = document.createElement("div");
    block.className = "num-block";
    const lab = document.createElement("div");
    lab.className = "num-label";
    lab.textContent = label;
    const num = document.createElement("div");
    num.className = "num";
    digits.forEach((d) => {
      const cell = document.createElement("div");
      cell.className = "digit " + cls;
      cell.textContent = K.GLYPHS[d];
      num.appendChild(cell);
    });
    block.appendChild(lab);
    block.appendChild(num);
    return block;
  }

  function stepRow(s, idx, kind) {
    const row = document.createElement("div");
    row.className = "step-row" + (kind === "constant" ? " is-constant" : kind === "cycle" ? " is-cycle" : "");
    const ix = document.createElement("div");
    ix.className = "step-index";
    ix.textContent = idx;
    const math = document.createElement("div");
    math.className = "step-math";

    math.appendChild(numBlock("descending", s.desc, "hi"));
    const minus = document.createElement("div");
    minus.className = "op";
    minus.textContent = "−";
    math.appendChild(minus);
    math.appendChild(numBlock("ascending", s.asc, "lo"));
    const eq = document.createElement("div");
    eq.className = "op";
    eq.textContent = "=";
    math.appendChild(eq);
    const res = numBlock("result", K.digitsOf(s.next, state.base, state.len), "res");
    res.classList.add("result-block");
    math.appendChild(res);

    row.appendChild(ix);
    row.appendChild(math);
    return row;
  }

  function buildPath() {
    const v = parseValue($("start").value, state.base);
    if (v == null) {
      setStatus(`<span class="err">Not a valid base-${state.base} number.</span>`);
      return null;
    }
    if (v >= Math.pow(state.base, state.len)) {
      // grow the digit count just enough to hold this number
      let len = state.len;
      while (v >= Math.pow(state.base, len) && len < 8) len++;
      setDigits(len);
    }
    const d = K.digitsOf(v, state.base, state.len);
    if (K.isRepdigit(d)) {
      setStatus(`<span class="err">All digits equal → collapses straight to 0. Pick a number with at least two distinct digits.</span>`);
      return null;
    }
    return K.path(v, state.base, state.len);
  }

  function setStatus(html) {
    $("routine-status").innerHTML = html;
  }

  function outcomeMessage(p) {
    if (p.outcome === "fixed") {
      return `<span class="win">Reached the Kaprekar constant ${K.format(p.constant, state.base, state.len)} in ${p.iterations} step${
        p.iterations === 1 ? "" : "s"
      }.</span>`;
    }
    if (p.outcome === "cycle") {
      const c = p.cycle.map((v) => K.format(v, state.base, state.len)).join(" → ");
      return `<span class="cyc">Entered a ${p.cycle.length}-cycle: ${c} → …</span>`;
    }
    if (p.outcome === "zero") return `<span class="cyc">Collapsed to 0.</span>`;
    return "";
  }

  function rowKind(p, i) {
    if (i === p.steps.length - 1) {
      if (p.outcome === "fixed" || p.outcome === "zero") return "constant";
      if (p.outcome === "cycle") return "cycle";
    }
    return "";
  }

  async function runRoutine() {
    const p = buildPath();
    if (!p) return;
    routine = { path: p, shown: 0 };
    const container = $("routine-steps");
    container.innerHTML = "";
    const token = ++runToken;
    setBtns(true);
    for (let i = 0; i < p.steps.length; i++) {
      if (token !== runToken) return; // cancelled
      container.appendChild(stepRow(p.steps[i], i + 1, rowKind(p, i)));
      setStatus(`${i + 1} step${i ? "s" : ""}…`);
      await sleep(p.steps.length > 12 ? 90 : 230);
    }
    routine.shown = p.steps.length;
    setStatus(outcomeMessage(p));
    setBtns(false);
  }

  function stepRoutine() {
    if (!routine.path || routine.shown >= routine.path.steps.length) {
      const p = buildPath();
      if (!p) return;
      routine = { path: p, shown: 0 };
      $("routine-steps").innerHTML = "";
    }
    const p = routine.path;
    const i = routine.shown;
    $("routine-steps").appendChild(stepRow(p.steps[i], i + 1, rowKind(p, i)));
    routine.shown++;
    if (routine.shown >= p.steps.length) setStatus(outcomeMessage(p));
    else setStatus(`${routine.shown} step${routine.shown === 1 ? "" : "s"} shown — keep going…`);
  }

  function randomStart() {
    const span = Math.pow(state.base, state.len);
    let v,
      tries = 0;
    do {
      v = Math.floor(Math.random() * span);
      tries++;
    } while (K.isRepdigit(K.digitsOf(v, state.base, state.len)) && tries < 50);
    $("start").value = K.format(v, state.base, state.len).replace(/^0+(?=.)/, "");
    runRoutine();
  }

  function resetRoutine() {
    runToken++;
    routine = { path: null, shown: 0 };
    $("routine-steps").innerHTML = "";
    setStatus("");
    setBtns(false);
  }

  function setBtns(running) {
    $("btn-run").disabled = running;
    $("btn-random").disabled = running;
  }
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  // ---- distribution --------------------------------------------------------
  function renderDistribution() {
    $("dist-base").textContent = state.base;
    $("dist-len").textContent = state.len;
    const a = getAnalysis();
    if (a.tooLarge) {
      $("dist-chart").innerHTML =
        '<p style="color:var(--text-dim);padding:24px;text-align:center">This base/digit combination is too large to map fully. Try fewer digits or a smaller base.</p>';
    } else {
      Viz.histogram($("dist-chart"), a);
    }
    if ($("overlay-bases").checked) renderOverlay();
  }

  function renderOverlay() {
    const box = $("dist-overlay");
    box.classList.remove("hidden");
    const series = [];
    for (let b = 4; b <= 36; b += 2) {
      if (combosWithRep(b, 3) > ANALYSIS_CAP) continue;
      const key = b + "_3";
      let a = analysisCache.get(key);
      if (!a) {
        a = K.analyze(b, 3);
        analysisCache.set(key, a);
      }
      if (a.constant == null) continue;
      const keys = [...a.distribution.keys()].filter((k) => k >= 1).sort((x, y) => x - y);
      series.push({ base: b, keys, counts: keys.map((k) => a.distribution.get(k)) });
    }
    Viz.overlay(box, series);
  }

  // ---- flow ----------------------------------------------------------------
  function renderFlow() {
    const a = getAnalysis();
    if (a.tooLarge) {
      $("flow-chart").innerHTML =
        '<p style="color:var(--text-dim);padding:28px;text-align:center">Too large to draw. Try base 10 with 3 digits for the classic 495 funnel.</p>';
      return;
    }
    Viz.flow($("flow-chart"), a);
  }

  // ---- bases table ---------------------------------------------------------
  function renderBasesTable() {
    const box = $("bases-table");
    box.innerHTML = "";
    for (let b = 4; b <= 36; b += 2) {
      const c = K.threeDigitConstant(b);
      const cell = document.createElement("div");
      cell.className = "base-cell";
      cell.innerHTML = `<div class="b">base ${b}</div><div class="k">${K.format(c, b, 3)}</div><div class="dec">= ${c} in base 10</div>`;
      cell.addEventListener("click", () => {
        setBase(b);
        setDigits(3);
        switchTab("flow");
      });
      box.appendChild(cell);
    }
  }

  // ---- parameter setters ---------------------------------------------------
  function setBase(b) {
    b = Math.max(2, Math.min(36, b | 0));
    state.base = b;
    $("base").value = b;
    $("start-hint").textContent = `(base ${b})`;
    onParamsChanged();
  }
  function setDigits(l) {
    l = Math.max(2, Math.min(8, l | 0));
    state.len = l;
    $("digits").value = l;
    onParamsChanged();
  }
  function onParamsChanged() {
    resetRoutine();
    renderSpaceSummary();
    if (state.activeTab === "distribution") renderDistribution();
    if (state.activeTab === "flow") renderFlow();
  }

  // ---- tabs ----------------------------------------------------------------
  function switchTab(name) {
    state.activeTab = name;
    document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("active", t.dataset.tab === name));
    document.querySelectorAll(".panel").forEach((p) => p.classList.toggle("active", p.id === "panel-" + name));
    if (name === "distribution") renderDistribution();
    if (name === "flow") renderFlow();
    if (name === "bases") renderBasesTable();
  }

  // ---- wiring --------------------------------------------------------------
  function init() {
    $("base").addEventListener("change", (e) => setBase(parseInt(e.target.value, 10) || 10));
    $("digits").addEventListener("change", (e) => setDigits(parseInt(e.target.value, 10) || 4));
    document.querySelectorAll("[data-nudge]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const delta = parseInt(btn.dataset.delta, 10);
        if (btn.dataset.nudge === "base") setBase(state.base + delta);
        else setDigits(state.len + delta);
      });
    });
    document.querySelectorAll(".tab").forEach((t) => t.addEventListener("click", () => switchTab(t.dataset.tab)));

    $("btn-run").addEventListener("click", runRoutine);
    $("btn-step").addEventListener("click", stepRoutine);
    $("btn-random").addEventListener("click", randomStart);
    $("btn-reset").addEventListener("click", resetRoutine);
    $("start").addEventListener("keydown", (e) => {
      if (e.key === "Enter") runRoutine();
    });
    $("overlay-bases").addEventListener("change", (e) => {
      if (e.target.checked) renderOverlay();
      else $("dist-overlay").classList.add("hidden");
    });

    renderSpaceSummary();
    runRoutine(); // kick off with the default 3524
  }

  document.addEventListener("DOMContentLoaded", init);
})();
