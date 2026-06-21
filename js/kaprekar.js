/*
 * kaprekar.js — core math for Kaprekar's Routine in any base / digit-count.
 *
 * The Kaprekar Routine on an L-digit number n (base b):
 *   1. Write n with exactly L digits (leading zeros allowed).
 *   2. Sort the digits descending  -> high
 *   3. Sort the digits ascending   -> low
 *   4. K(n) = high - low   (kept as an L-digit number, leading zeros allowed)
 *   5. Repeat.
 *
 * A "Kaprekar Constant" is a fixed point K(n) = n that every non-trivial
 * starting number (i.e. not a repdigit) eventually reaches. Some base/digit
 * combinations have no constant and instead settle into cycles.
 *
 * Works in both the browser (attaches to window.Kaprekar) and Node (module.exports).
 */
(function (root) {
  "use strict";

  // --- digit helpers -------------------------------------------------------

  function digitsOf(n, base, len) {
    const d = new Array(len);
    for (let i = len - 1; i >= 0; i--) {
      d[i] = n % base;
      n = Math.floor(n / base);
    }
    return d; // most-significant first
  }

  function valueOf(digits, base) {
    let v = 0;
    for (let i = 0; i < digits.length; i++) v = v * base + digits[i];
    return v;
  }

  function isRepdigit(digits) {
    for (let i = 1; i < digits.length; i++) if (digits[i] !== digits[0]) return false;
    return true;
  }

  // Render a value as a fixed-width digit string in the given base.
  const GLYPHS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  function format(n, base, len) {
    const d = digitsOf(n, base, len);
    return d.map((x) => (base <= 36 ? GLYPHS[x] : "[" + x + "]")).join("");
  }

  // --- one Kaprekar step ---------------------------------------------------

  function step(n, base, len) {
    const digits = digitsOf(n, base, len);
    const desc = digits.slice().sort((a, b) => b - a);
    const asc = digits.slice().sort((a, b) => a - b);
    const high = valueOf(desc, base);
    const low = valueOf(asc, base);
    return { n, digits, desc, asc, high, low, next: high - low };
  }

  // --- full trajectory from a single starting number -----------------------
  //
  // Returns { steps, outcome, iterations, constant?, cycle? }
  //   outcome: "fixed"  -> reached a fixed point (steps end at the constant)
  //            "cycle"  -> entered a repeating loop of length > 1
  //            "zero"   -> collapsed to 0 (repdigit input)
  function path(n, base, len, maxSteps) {
    maxSteps = maxSteps || 1000;
    const steps = [];
    const seen = new Map(); // value -> index in steps
    let cur = n;
    seen.set(cur, 0);

    for (let i = 0; i < maxSteps; i++) {
      const s = step(cur, base, len);
      steps.push(s);

      if (s.next === cur) {
        return {
          steps,
          outcome: cur === 0 ? "zero" : "fixed",
          iterations: i, // a fixed point reached in i transitions
          constant: cur,
        };
      }
      if (s.next === 0) {
        steps.push(step(0, base, len));
        return { steps, outcome: "zero", iterations: i + 1, constant: 0 };
      }
      if (seen.has(s.next)) {
        const start = seen.get(s.next);
        const cycle = steps.slice(start).map((x) => x.n);
        return { steps, outcome: "cycle", iterations: i + 1, cycle };
      }
      seen.set(s.next, steps.length);
      cur = s.next;
    }
    return { steps, outcome: "cutoff", iterations: maxSteps };
  }

  // --- analysis over an entire (base, len) space ---------------------------
  //
  // Enumerates digit-multisets (non-decreasing tuples) so it scales to large
  // bases. For each it computes distance-to-attractor, then aggregates:
  //   - fixedPoints: values v with K(v) = v (excluding 0)
  //   - cycles: non-trivial loops
  //   - constant: the unique Kaprekar constant, if one governs everything
  //   - distribution: iterations -> count of proper L-digit integers
  //   - flow: nodes/edges of the convergence graph (when not too large)

  function permutationCount(counts, len) {
    // total distinct permutations = len! / prod(counts!)
    let num = 1;
    for (let i = 2; i <= len; i++) num *= i;
    let den = 1;
    for (const c of counts) for (let i = 2; i <= c; i++) den *= i;
    return num / den;
  }

  // proper L-digit integers (no leading zero) realizable from a digit multiset
  function properCount(counts, len) {
    const total = permutationCount(counts, len);
    if (counts[0] === 0) return total; // no zeros in multiset
    // subtract permutations that start with 0
    const reduced = counts.slice();
    reduced[0] -= 1;
    const leading = permutationCount(reduced, len - 1);
    return total - leading;
  }

  function analyze(base, len, opts) {
    opts = opts || {};
    const nodeCap = opts.nodeCap || 1500;

    // memo: value -> { dist, attractor }  (attractor is a string key)
    const memo = new Map();
    const fixedSet = new Set();
    const cycles = []; // array of arrays of values
    const cycleKeyOf = new Map(); // value -> cycle key

    function attractorOf(start) {
      const walk = [];
      const localIndex = new Map();
      let cur = start;
      while (true) {
        if (memo.has(cur)) {
          // back-fill the walk using the resolved tail
          let tail = memo.get(cur);
          for (let i = walk.length - 1; i >= 0; i--) {
            tail = { dist: tail.dist + 1, attractor: tail.attractor };
            memo.set(walk[i], tail);
          }
          return memo.get(start);
        }
        if (localIndex.has(cur)) {
          // found a brand-new cycle within this walk
          const startIdx = localIndex.get(cur);
          const loop = walk.slice(startIdx);
          const key = "cycle:" + Math.min.apply(null, loop);
          if (!cycleKeyOf.has(loop[0])) {
            cycles.push(loop);
            for (const v of loop) cycleKeyOf.set(v, key);
          }
          for (const v of loop) memo.set(v, { dist: 0, attractor: key });
          let tail = { dist: 0, attractor: key };
          for (let i = startIdx - 1; i >= 0; i--) {
            tail = { dist: tail.dist + 1, attractor: key };
            memo.set(walk[i], tail);
          }
          return memo.get(start);
        }
        const nxt = step(cur, base, len).next;
        if (nxt === cur) {
          // fixed point
          const key = "fixed:" + cur;
          if (cur !== 0) fixedSet.add(cur);
          memo.set(cur, { dist: 0, attractor: key });
          let tail = { dist: 0, attractor: key };
          for (let i = walk.length - 1; i >= 0; i--) {
            tail = { dist: tail.dist + 1, attractor: key };
            memo.set(walk[i], tail);
          }
          return memo.get(start);
        }
        localIndex.set(cur, walk.length);
        walk.push(cur);
        cur = nxt;
      }
    }

    // enumerate non-decreasing digit tuples (multisets) of length len
    const distribution = new Map(); // iterations -> count (toward the constant)
    let cycleBound = 0; // count of integers that fall into non-trivial cycles
    let totalIntegers = 0;
    let maxIter = 0;
    const reps = []; // {value, counts, weight, dist, attractor}

    const tuple = new Array(len).fill(0);
    function enumerate(pos, minDigit) {
      if (pos === len) {
        const digits = tuple.slice();
        if (isRepdigit(digits)) return; // trivial -> 0
        const counts = new Array(base).fill(0);
        for (const d of digits) counts[d]++;
        const compact = counts.filter((c) => c > 0);
        const weight = properCount(counts.filter((c) => c > 0).length ? counts : counts, len);
        // value of this exact (sorted ascending) arrangement is fine as a representative
        const value = valueOf(digits.slice().sort((a, b) => b - a), base);
        const res = attractorOf(value);
        reps.push({ value, weight, dist: res.dist, attractor: res.attractor });
        return;
      }
      for (let d = minDigit; d < base; d++) {
        tuple[pos] = d;
        enumerate(pos + 1, d);
      }
    }
    enumerate(0, 0);

    // Decide the governing constant: a single fixed point that everyone reaches.
    const fixedPoints = Array.from(fixedSet).sort((a, b) => a - b);
    let constant = null;
    if (fixedPoints.length === 1 && cycles.length === 0) constant = fixedPoints[0];

    const constKey = constant != null ? "fixed:" + constant : null;
    for (const r of reps) {
      totalIntegers += r.weight;
      if (constKey && r.attractor === constKey) {
        const k = r.dist;
        distribution.set(k, (distribution.get(k) || 0) + r.weight);
        if (k > maxIter) maxIter = k;
      } else {
        cycleBound += r.weight;
      }
    }

    // The constant's own multiset is enumerated via its descending-sorted
    // representative (distance 1), so the constant integer itself got counted
    // one step too far. Move that single integer to distance 0.
    if (constant != null) {
      const cdesc = valueOf(digitsOf(constant, base, len).sort((a, b) => b - a), base);
      const m = memo.get(cdesc);
      if (m) {
        distribution.set(m.dist, (distribution.get(m.dist) || 0) - 1);
        distribution.set(0, (distribution.get(0) || 0) + 1);
      }
    }

    // Build the flow graph (distinct values -> K(value)) if small enough.
    let flow = null;
    if (constant != null) {
      const nodes = new Map(); // value -> { value, dist, weight }
      const edges = new Map(); // "a->b" -> weight
      function addNode(v, dist) {
        if (!nodes.has(v)) nodes.set(v, { value: v, dist, weight: 0 });
      }
      // re-walk each representative's path, accumulating edge weights
      let tooBig = false;
      for (const r of reps) {
        if (r.attractor !== constKey) continue;
        let cur = r.value;
        let guard = 0;
        while (guard++ < 1000) {
          const m = memo.get(cur);
          addNode(cur, m.dist);
          nodes.get(cur).weight += r.weight;
          if (m.dist === 0) break;
          const nxt = step(cur, base, len).next;
          const ek = cur + "->" + nxt;
          edges.set(ek, (edges.get(ek) || 0) + r.weight);
          cur = nxt;
          if (nodes.size > nodeCap) {
            tooBig = true;
            break;
          }
        }
        if (tooBig) break;
      }
      if (!tooBig) {
        flow = {
          nodes: Array.from(nodes.values()),
          edges: Array.from(edges.entries()).map(([k, w]) => {
            const [a, b] = k.split("->").map(Number);
            return { from: a, to: b, weight: w };
          }),
        };
      }
    }

    return {
      base,
      len,
      constant,
      fixedPoints,
      cycles,
      distribution,
      maxIterations: maxIter,
      totalIntegers,
      cycleBound,
      flow,
    };
  }

  // 3-digit Kaprekar constant for an even base b: (b/2 - 1)(b - 1)(b/2)
  // (from the paper). Returns the value, or null for odd bases.
  function threeDigitConstant(base) {
    if (base % 2 !== 0 || base < 4) return null;
    const d0 = base / 2 - 1;
    const d1 = base - 1;
    const d2 = base / 2;
    return valueOf([d0, d1, d2], base);
  }

  const api = {
    digitsOf,
    valueOf,
    isRepdigit,
    format,
    step,
    path,
    analyze,
    threeDigitConstant,
    GLYPHS,
  };

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.Kaprekar = api;
})(typeof window !== "undefined" ? window : globalThis);
