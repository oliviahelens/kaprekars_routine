# Kaprekar's Constant — Playground

An interactive playground for **Kaprekar's Routine** in *any* base and digit-count.

![screenshot](docs/hero.png)

> Built around the paper *The Base Dependent Behavior of Kaprekar's Routine: A
> Theoretical and Computational Study Revealing New Regularities* by Daniel
> Hanover ([arXiv:1710.06308](https://arxiv.org/abs/1710.06308)).

## What is the Kaprekar Routine?

Take a number with at least two distinct digits. Sort its digits **descending**
and **ascending**, subtract the two, and repeat:

```
3524  →  5432 − 2345 = 3087
3087  →  8730 − 0378 = 8352
8352  →  8532 − 2358 = 6174
6174  →  7641 − 1467 = 6174   ← fixed point
```

In base 10, every 4-digit number reaches **6174** within 7 steps, and every
3-digit number reaches **495**. These attractors are *Kaprekar's Constants*.
Other bases and digit-counts have their own constants — or none at all, settling
into cycles instead.

## Features

The playground is a single static page with four views:

| Tab | What it does |
| --- | --- |
| **▶ Routine** | Step or animate the routine for any starting number. Digits are shown sorted high/low with the running difference; the constant (or a cycle) is highlighted. |
| **▦ Distribution** | Histogram of how many numbers need *k* iterations to converge. Reproduces Hanover's result that the most common answer is almost always **3**, and can overlay all even bases 4–36 (Fig. 4). |
| **⤳ Flow Graph** | The convergence funnel: every number flowing toward the constant, with edge thickness showing how many integers travel each path (Fig. 1). |
| **∑ Bases & Theory** | The closed-form 3-digit constant `(b/2−1)(b−1)(b/2)` for every even base, plus the key theorems from the paper. |

Change the **base** (2–36) and **digit count** (2–8) at the top; every view
updates, and the "this space" readout tells you the constant or whether the
space only has cycles.

## Run it

It's a zero-dependency static site — just open the file:

```bash
# either open directly…
open index.html

# …or serve it (nicer for some browsers)
python3 -m http.server 8000   # then visit http://localhost:8000
```

## The math (verified in code)

All of these are checked against brute force in `test/`:

- **K(n) is always divisible by b − 1.** Every digit-pair contributes a factor
  `bˣ − bʸ = bʸ(b − 1)(1 + b + …)`.
- **3-digit step:** for a digit-gap `D`, one step gives `(D−1)(b−1)(b−D)`, and
  each further step shrinks the outer-digit gap by exactly 2.
- **3-digit constant (even base b):** `(b/2 − 1)(b − 1)(b/2)` — e.g. base 10 → `495`.
- **Iteration mode is 3** for 3-digit numbers in every base above 4.
- Some spaces (e.g. base 10, 5 digits) have **no single constant** and exhibit
  cycles — the playground detects and reports these.

## Project structure

```
index.html          markup + tab shell
css/styles.css      styling
js/kaprekar.js      core engine (pure, runs in browser or Node)
js/viz.js           SVG renderers: histogram, base overlay, flow graph
js/app.js           UI controller
test/kaprekar.test.js   unit tests (brute-forces every 3- & 4-digit base-10 case)
test/smoke.mjs          end-to-end browser test (Playwright)
```

## Tests

```bash
# math engine — pure Node, no dependencies
node test/kaprekar.test.js

# full UI smoke test — needs Playwright + Chromium
node test/smoke.mjs
```

The unit test verifies, among other things, that all 8,991 non-repdigit 4-digit
numbers reach 6174 within 7 iterations, that the multiset-weighted distribution
matches a per-integer brute force exactly, and that the even-base formula yields
genuine fixed points.

## Credits

Mathematics and the experimental observations are from D. Hanover's paper
(arXiv:1710.06308), itself building on work by Kaprekar, Prichett, Eldridge &
Sagong, Walden, and others. This playground is an independent interactive
re-implementation of those ideas.
