/* Minimal test runner for the Kaprekar engine. Run: node test/kaprekar.test.js */
const K = require("../js/kaprekar.js");

let pass = 0,
  fail = 0;
function eq(actual, expected, msg) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) {
    pass++;
  } else {
    fail++;
    console.error(`FAIL: ${msg}\n   expected ${e}\n   got      ${a}`);
  }
}
function ok(cond, msg) {
  if (cond) pass++;
  else {
    fail++;
    console.error(`FAIL: ${msg}`);
  }
}

// --- digit helpers ---
eq(K.digitsOf(6174, 10, 4), [6, 1, 7, 4], "digitsOf 6174");
eq(K.valueOf([6, 1, 7, 4], 10), 6174, "valueOf 6174");
eq(K.format(495, 10, 3), "495", "format 495");
eq(K.format(255, 16, 2), "FF", "format FF base16");

// --- single step ---
const s = K.step(6174, 10, 4);
eq(s.high, 7641, "6174 high");
eq(s.low, 1467, "6174 low");
eq(s.next, 6174, "6174 is a fixed point");

const s2 = K.step(495, 10, 3);
eq(s2.high, 954, "495 high");
eq(s2.low, 459, "495 low");
eq(s2.next, 495, "495 is a fixed point");

// --- famous convergence: every 4-digit base-10 number -> 6174 within 7 ---
const p = K.path(3524, 10, 4);
eq(p.outcome, "fixed", "3524 converges");
eq(p.constant, 6174, "3524 -> 6174");
ok(p.iterations <= 7, "3524 within 7 iterations");

// brute force the famous 7-iteration bound
let worst = 0;
for (let n = 1000; n <= 9999; n++) {
  const d = K.digitsOf(n, 10, 4);
  if (K.isRepdigit(d)) continue;
  const r = K.path(n, 10, 4);
  ok(r.constant === 6174, `4-digit ${n} reaches 6174`);
  if (r.iterations > worst) worst = r.iterations;
}
eq(worst, 7, "max iterations for 4-digit base 10 is 7");

// --- 3-digit base 10 -> 495 ---
let worst3 = 0;
for (let n = 100; n <= 999; n++) {
  const d = K.digitsOf(n, 10, 3);
  if (K.isRepdigit(d)) continue;
  const r = K.path(n, 10, 3);
  ok(r.constant === 495, `3-digit ${n} reaches 495`);
  if (r.iterations > worst3) worst3 = r.iterations;
}
eq(worst3, 6, "max iterations for 3-digit base 10 is 6");

// --- even-base 3-digit constant formula ---
eq(K.threeDigitConstant(10), 495, "3-digit constant base 10 = 495");
eq(K.format(K.threeDigitConstant(10), 10, 3), "495", "495 digits");
// base 6: (2)(5)(3) -> verify it is a true fixed point
const c6 = K.threeDigitConstant(6);
eq(K.step(c6, 6, 3).next, c6, "base-6 3-digit constant is a fixed point");
const c16 = K.threeDigitConstant(16);
eq(K.step(c16, 16, 3).next, c16, "base-16 3-digit constant is a fixed point");

// --- analyze() agrees with the constant + distribution sums ---
const a10 = K.analyze(10, 3);
eq(a10.constant, 495, "analyze base10/3 constant");
let distSum = 0;
for (const v of a10.distribution.values()) distSum += v;
// proper 3-digit integers 100..999 minus repdigits 111..999 (9 of them)
eq(distSum, 900 - 9, "analyze base10/3 covers all non-repdigit 3-digit ints");
eq(a10.maxIterations, 6, "analyze base10/3 max iterations");
// paper's claim: the most common iteration count is small; 0 is the constant itself
ok(a10.flow && a10.flow.nodes.length > 0, "flow graph built for base10/3");

const a10_4 = K.analyze(10, 4);
eq(a10_4.constant, 6174, "analyze base10/4 constant");
eq(a10_4.maxIterations, 7, "analyze base10/4 max iterations");

// base 5, 4 digits has constant 3032 per the paper
const a5_4 = K.analyze(5, 4);
eq(K.format(a5_4.constant, 5, 4), "3032", "analyze base5/4 constant = 3032");

// A base/digit combo with NO constant should report cycles (e.g. base 10, 5 digits)
const a10_5 = K.analyze(10, 5);
ok(a10_5.constant === null, "base10/5 has no single Kaprekar constant");
ok(a10_5.cycles.length > 0, "base10/5 exhibits cycles");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
