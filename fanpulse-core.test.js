/**
 * fanpulse-core.test.js
 * ---------------------------------------------------------------------------
 * Zero-dependency unit test suite for FanPulse AI's pure logic layer.
 *
 * Architecture note:
 * The application ships as a single HTML file (index.html) with all
 * non-DOM business logic isolated in a <script id="core-logic"> block,
 * exposed as `window.FanPulseCore`. This file extracts that exact block
 * using `lastIndexOf` (to skip HTML comment references) and evaluates it
 * inside a Node `vm` sandbox. Tests therefore always exercise real
 * production code — never a hand-copied duplicate that could drift.
 *
 * Run with:  node fanpulse-core.test.js
 * Exit code: 0 on full pass, 1 on any failure (CI-friendly).
 * ---------------------------------------------------------------------------
 */

"use strict";

const fs     = require("fs");
const path   = require("path");
const vm     = require("vm");
const assert = require("assert");

/* ══════════════════════════════════════════════════════════════════════════
   PERFORMANCE TRACKING
   Uses high-resolution timer (nanosecond precision) to report suite duration.
══════════════════════════════════════════════════════════════════════════ */
const suiteStartNs = process.hrtime.bigint();

/* ══════════════════════════════════════════════════════════════════════════
   CORE-LOGIC LOADER
══════════════════════════════════════════════════════════════════════════ */

/**
 * Extract the <script id="core-logic"> block from index.html and evaluate it
 * inside an isolated Node vm context. Uses `lastIndexOf` to find the REAL
 * script element, skipping any occurrences of the tag inside HTML comments.
 *
 * @returns {object} The `window.FanPulseCore` public API object.
 * @throws  {Error}  If the script block cannot be located or parsed.
 */
function loadCore() {
  const htmlPath = path.join(__dirname, "index.html");
  const html     = fs.readFileSync(htmlPath, "utf8");

  // Use lastIndexOf so HTML comment references above the element are skipped.
  const OPEN_TAG  = '<script id="core-logic">';
  const CLOSE_TAG = '</script>';

  const openIdx = html.lastIndexOf(OPEN_TAG);
  if (openIdx === -1) {
    throw new Error(
      'Could not find <script id="core-logic"> in index.html. ' +
      "Ensure the block exists and has not been renamed or removed."
    );
  }

  const contentStart = openIdx + OPEN_TAG.length;
  const closeIdx     = html.indexOf(CLOSE_TAG, contentStart);
  if (closeIdx === -1) {
    throw new Error(
      'Found <script id="core-logic"> but no matching </script> closing tag.'
    );
  }

  const scriptSrc = html.slice(contentStart, closeIdx);
  const sandbox   = { window: {}, module: { exports: {} } };
  vm.createContext(sandbox);
  vm.runInContext(scriptSrc, sandbox, { filename: "core-logic.js" });
  return sandbox.window.FanPulseCore;
}

/* ══════════════════════════════════════════════════════════════════════════
   TEST RUNNER
══════════════════════════════════════════════════════════════════════════ */

let   passed   = 0;
let   failed   = 0;
const failures = [];

/**
 * Run a single synchronous test case. Records pass/fail and prints a symbol.
 *
 * @param {string}   name - Human-readable description of the assertion.
 * @param {Function} fn   - Test body; should throw (or use assert) on failure.
 */
function test(name, fn) {
  try {
    fn();
    passed += 1;
    process.stdout.write("  \u2713 " + name + "\n");
  } catch (err) {
    failed += 1;
    failures.push({ name, error: err });
    process.stdout.write("  \u2717 " + name + "\n");
    process.stdout.write("    \u2514 " + err.message + "\n");
  }
}

/**
 * Run a suite of related tests, grouping output under a heading.
 *
 * @param {string}   suiteName - Section heading.
 * @param {Function} suiteFn   - Function that calls `test()` multiple times.
 */
function describe(suiteName, suiteFn) {
  console.log("\n" + suiteName);
  suiteFn();
}

/* ══════════════════════════════════════════════════════════════════════════
   LOAD MODULE
══════════════════════════════════════════════════════════════════════════ */
console.log("FanPulse AI — core-logic test suite");
console.log("─".repeat(50));

const Core = loadCore();

/* ══════════════════════════════════════════════════════════════════════════
   SUITE 0: API SURFACE SMOKE TESTS
   Verify that every expected export exists before running functional tests.
   Catching missing exports here makes root-cause analysis much faster.
══════════════════════════════════════════════════════════════════════════ */
describe("API surface — smoke tests", function () {
  const expectedFunctions = [
    "clampNumber", "classifyCrowd", "sanitizeText", "estimateWalkTime",
    "estimateCarbonKg", "isSupportedLanguage", "rankAlertsBySeverity",
    "computeDepartureTime"
  ];
  const expectedConstants = ["SUPPORTED_LANGUAGES", "EMISSION_FACTORS_KG_PER_KM"];

  expectedFunctions.forEach(function (name) {
    test("exports function: " + name, () =>
      assert.strictEqual(typeof Core[name], "function", name + " must be a function")
    );
  });

  expectedConstants.forEach(function (name) {
    test("exports constant: " + name, () =>
      assert.ok(Core[name] !== undefined, name + " must be exported")
    );
  });

  test("SUPPORTED_LANGUAGES is frozen (immutable)",            () => assert.ok(Object.isFrozen(Core.SUPPORTED_LANGUAGES)));
  test("EMISSION_FACTORS_KG_PER_KM is frozen (immutable)",    () => assert.ok(Object.isFrozen(Core.EMISSION_FACTORS_KG_PER_KM)));
  test("module exports an object (not a primitive)",           () => assert.strictEqual(typeof Core, "object"));
});

/* ══════════════════════════════════════════════════════════════════════════
   SUITE 1: clampNumber
══════════════════════════════════════════════════════════════════════════ */
describe("clampNumber", function () {
  // Normal ranges
  test("clamps value below min → returns min",      () => assert.strictEqual(Core.clampNumber(-5,   0, 100), 0));
  test("clamps value above max → returns max",      () => assert.strictEqual(Core.clampNumber(500,  0, 100), 100));
  test("passes through in-range value",             () => assert.strictEqual(Core.clampNumber(42,   0, 100), 42));
  test("passes through value equal to min",         () => assert.strictEqual(Core.clampNumber(0,    0, 100), 0));
  test("passes through value equal to max",         () => assert.strictEqual(Core.clampNumber(100,  0, 100), 100));
  test("handles float values correctly",            () => assert.strictEqual(Core.clampNumber(3.7,  0,  10), 3.7));

  // Invalid / edge inputs
  test("NaN input → falls back to min",             () => assert.strictEqual(Core.clampNumber(NaN,       5, 10), 5));
  test("string input → falls back to min",          () => assert.strictEqual(Core.clampNumber("abc",     5, 10), 5));
  test("undefined input → falls back to min",       () => assert.strictEqual(Core.clampNumber(undefined, 5, 10), 5));
  test("null input → falls back to min",            () => assert.strictEqual(Core.clampNumber(null,      5, 10), 5));
  test("Infinity → clamped to max",                 () => assert.strictEqual(Core.clampNumber(Infinity,  0, 100), 100));
  test("-Infinity → clamped to min",                () => assert.strictEqual(Core.clampNumber(-Infinity, 0, 100), 0));
  test("boolean false → falls back to min",         () => assert.strictEqual(Core.clampNumber(false,     5, 10), 5));
  test("min === max → returns that value",          () => assert.strictEqual(Core.clampNumber(50, 7, 7), 7));
});

/* ══════════════════════════════════════════════════════════════════════════
   SUITE 2: classifyCrowd
══════════════════════════════════════════════════════════════════════════ */
describe("classifyCrowd", function () {
  // Boundary values (critical for correctness)
  test("0  → Low",                                  () => assert.strictEqual(Core.classifyCrowd(0).key,   "low"));
  test("34 → Low (just below Moderate boundary)",   () => assert.strictEqual(Core.classifyCrowd(34).key,  "low"));
  test("35 → Moderate (exact lower boundary)",      () => assert.strictEqual(Core.classifyCrowd(35).key,  "moderate"));
  test("64 → Moderate",                             () => assert.strictEqual(Core.classifyCrowd(64).key,  "moderate"));
  test("65 → High (exact lower boundary)",          () => assert.strictEqual(Core.classifyCrowd(65).key,  "high"));
  test("87 → High",                                 () => assert.strictEqual(Core.classifyCrowd(87).key,  "high"));
  test("88 → Critical (exact lower boundary)",      () => assert.strictEqual(Core.classifyCrowd(88).key,  "critical"));
  test("100 → Critical",                            () => assert.strictEqual(Core.classifyCrowd(100).key, "critical"));

  // Out-of-range (clamped, not thrown)
  test("999 → clamped to Critical",                 () => assert.strictEqual(Core.classifyCrowd(999).key, "critical"));
  test("-10 → clamped to Low",                      () => assert.strictEqual(Core.classifyCrowd(-10).key, "low"));

  // Structure of returned object
  test("returns non-empty level string for all tiers", () => {
    [0, 40, 70, 95].forEach(function (d) {
      const r = Core.classifyCrowd(d);
      assert.ok(typeof r.level  === "string" && r.level.length  > 0, "level missing for " + d);
      assert.ok(typeof r.key    === "string" && r.key.length    > 0, "key missing for "   + d);
      assert.ok(typeof r.advice === "string" && r.advice.length > 0, "advice missing for " + d);
    });
  });

  // key → CSS class values (guards against typos)
  test("low key is exactly 'low'",          () => assert.strictEqual(Core.classifyCrowd(10).key,  "low"));
  test("moderate key is exactly 'moderate'",() => assert.strictEqual(Core.classifyCrowd(50).key,  "moderate"));
  test("high key is exactly 'high'",        () => assert.strictEqual(Core.classifyCrowd(75).key,  "high"));
  test("critical key is exactly 'critical'",() => assert.strictEqual(Core.classifyCrowd(95).key,  "critical"));
});

/* ══════════════════════════════════════════════════════════════════════════
   SUITE 3: sanitizeText
══════════════════════════════════════════════════════════════════════════ */
describe("sanitizeText", function () {
  // HTML escaping
  test("escapes <script> open tag",              () => assert.ok(!Core.sanitizeText("<script>").includes("<script>")));
  test("escapes to &lt;script&gt;",             () => assert.ok( Core.sanitizeText("<script>").includes("&lt;script&gt;")));
  test("escapes ampersand & → &amp;",           () => assert.ok( Core.sanitizeText("A & B").includes("&amp;")));
  test("escapes double quote → &quot;",         () => assert.ok( Core.sanitizeText('"hi"').includes("&quot;")));
  test("escapes single quote → &#39;",          () => assert.ok( Core.sanitizeText("it's").includes("&#39;")));
  test("escapes > → &gt;",                      () => assert.ok( Core.sanitizeText("a > b").includes("&gt;")));
  test("full compound escape is correct",       () => {
    assert.strictEqual(
      Core.sanitizeText(`Tom & Jerry's "show"`),
      "Tom &amp; Jerry&#39;s &quot;show&quot;"
    );
  });

  // Length clamping
  test("truncates to maxLen before escaping",   () => assert.strictEqual(Core.sanitizeText("a".repeat(50), 10).length, 10));
  test("default maxLen is 400 characters",      () => assert.strictEqual(Core.sanitizeText("x".repeat(500)).length,   400));
  test("string of exactly maxLen is not truncated", () => assert.strictEqual(Core.sanitizeText("y".repeat(400), 400).length, 400));
  test("string shorter than maxLen is not padded",  () => assert.strictEqual(Core.sanitizeText("hello", 400).length, 5));

  // Edge inputs
  test("null → empty string",                   () => assert.strictEqual(Core.sanitizeText(null),      ""));
  test("undefined → empty string",              () => assert.strictEqual(Core.sanitizeText(undefined), ""));
  test("empty string → empty string",           () => assert.strictEqual(Core.sanitizeText(""),        ""));
  test("number 42 → '42' (coercion)",           () => assert.strictEqual(Core.sanitizeText(42),       "42"));
  test("boolean true → 'true' (coercion)",      () => assert.strictEqual(Core.sanitizeText(true),     "true"));
});

/* ══════════════════════════════════════════════════════════════════════════
   SUITE 4: estimateWalkTime
══════════════════════════════════════════════════════════════════════════ */
describe("estimateWalkTime", function () {
  test("standard route returns base minutes as-is",          () => assert.strictEqual(Core.estimateWalkTime(10, false), 10));
  test("accessible route adds 25% overhead",                 () => assert.strictEqual(Core.estimateWalkTime(10, true),  13));
  test("clamps 0 base minutes → minimum of 1",              () => assert.strictEqual(Core.estimateWalkTime(0,  false),  1));
  test("clamps negative base minutes → minimum of 1",       () => assert.strictEqual(Core.estimateWalkTime(-5, false),  1));
  test("clamps base > 60 → maximum of 60",                  () => assert.strictEqual(Core.estimateWalkTime(100, false), 60));
  test("accessible: 1 min base → 1 (Math.round(1.25)=1)",  () => assert.strictEqual(Core.estimateWalkTime(1, true),    1));
  test("accessible: 7 min base → 9 (7×1.25=8.75→9)",       () => assert.strictEqual(Core.estimateWalkTime(7, true),    9));
  test("result is always an integer",                        () => {
    [1, 5, 10, 30, 60].forEach(function (b) {
      var r = Core.estimateWalkTime(b, true);
      assert.strictEqual(r, Math.round(r), "Non-integer for base=" + b);
    });
  });
  test("accessible always >= standard for same input",       () => {
    [5, 10, 15, 20].forEach(function (b) {
      assert.ok(Core.estimateWalkTime(b, true) >= Core.estimateWalkTime(b, false));
    });
  });
});

/* ══════════════════════════════════════════════════════════════════════════
   SUITE 5: estimateCarbonKg
══════════════════════════════════════════════════════════════════════════ */
describe("estimateCarbonKg", function () {
  // Known emission values
  test("walk  → 0 kg (zero emissions)",                      () => assert.strictEqual(Core.estimateCarbonKg("walk",      10), 0));
  test("bike  → 0 kg (zero emissions)",                      () => assert.strictEqual(Core.estimateCarbonKg("bike",      10), 0));
  test("transit   10 km → 0.4 kg (0.04 × 10)",             () => assert.strictEqual(Core.estimateCarbonKg("transit",   10), 0.4));
  test("rideshare 10 km → 1.7 kg (0.17 × 10)",             () => assert.strictEqual(Core.estimateCarbonKg("rideshare", 10), 1.7));
  test("car       10 km → 1.9 kg (0.19 × 10)",             () => assert.strictEqual(Core.estimateCarbonKg("car",       10), 1.9));
  test("transit   3 km  → 0.12 kg (rounded)",               () => assert.strictEqual(Core.estimateCarbonKg("transit",    3), 0.12));

  // Relative ordering
  test("car > rideshare > transit for same distance",        () => {
    const d = 20;
    assert.ok(Core.estimateCarbonKg("car", d) > Core.estimateCarbonKg("rideshare", d));
    assert.ok(Core.estimateCarbonKg("rideshare", d) > Core.estimateCarbonKg("transit", d));
  });

  // Fallback & edge cases
  test("unknown mode falls back to car factor",              () => assert.strictEqual(Core.estimateCarbonKg("hoverboard", 10), Core.estimateCarbonKg("car", 10)));
  test("negative distance → 0 kg (clamped)",                () => assert.strictEqual(Core.estimateCarbonKg("car", -5),  0));
  test("zero distance → 0 kg",                              () => assert.strictEqual(Core.estimateCarbonKg("car",  0),  0));
  test("result has at most 2 decimal places",               () => {
    const result = Core.estimateCarbonKg("transit", 3);
    assert.strictEqual(result, parseFloat(result.toFixed(2)));
  });
});

/* ══════════════════════════════════════════════════════════════════════════
   SUITE 6: isSupportedLanguage
══════════════════════════════════════════════════════════════════════════ */
describe("isSupportedLanguage", function () {
  // All 9 supported languages
  const supported = ["English", "Spanish", "French", "Portuguese", "Arabic", "Japanese", "Hindi", "German", "Mandarin"];
  supported.forEach(function (lang) {
    test(lang + " is supported", () => assert.strictEqual(Core.isSupportedLanguage(lang), true));
  });

  // Rejected values
  test("'Klingon' is rejected",          () => assert.strictEqual(Core.isSupportedLanguage("Klingon"),  false));
  test("empty string is rejected",       () => assert.strictEqual(Core.isSupportedLanguage(""),         false));
  test("'english' rejected (lowercase)", () => assert.strictEqual(Core.isSupportedLanguage("english"),  false));
  test("'ENGLISH' rejected (uppercase)", () => assert.strictEqual(Core.isSupportedLanguage("ENGLISH"),  false));
  test("'SPANISH' rejected (uppercase)", () => assert.strictEqual(Core.isSupportedLanguage("SPANISH"),  false));

  // SUPPORTED_LANGUAGES constant
  test("SUPPORTED_LANGUAGES has exactly 9 entries",     () => assert.strictEqual(Core.SUPPORTED_LANGUAGES.length, 9));
  test("SUPPORTED_LANGUAGES contains 'German'",         () => assert.ok(Core.SUPPORTED_LANGUAGES.indexOf("German")   !== -1));
  test("SUPPORTED_LANGUAGES contains 'Mandarin'",       () => assert.ok(Core.SUPPORTED_LANGUAGES.indexOf("Mandarin") !== -1));
  test("SUPPORTED_LANGUAGES is frozen",                 () => assert.ok(Object.isFrozen(Core.SUPPORTED_LANGUAGES)));
  test("SUPPORTED_LANGUAGES contains no duplicates",    () => {
    const unique = new Set(Core.SUPPORTED_LANGUAGES);
    // Note: Set and SUPPORTED_LANGUAGES live in different vm realms, compare by length
    assert.strictEqual(Core.SUPPORTED_LANGUAGES.length, unique.size);
  });
});

/* ══════════════════════════════════════════════════════════════════════════
   SUITE 7: rankAlertsBySeverity
══════════════════════════════════════════════════════════════════════════ */
describe("rankAlertsBySeverity", function () {
  test("sorts critical → high → medium → low", () => {
    const input  = [
      { text: "a", severity: "low"      },
      { text: "b", severity: "critical" },
      { text: "c", severity: "medium"   },
      { text: "d", severity: "high"     }
    ];
    const result = Core.rankAlertsBySeverity(input);
    assert.deepStrictEqual(
      result.map(function (a) { return a.severity; }),
      ["critical", "high", "medium", "low"]
    );
  });

  test("does not mutate the original input array", () => {
    const input  = [{ text: "x", severity: "low" }, { text: "y", severity: "critical" }];
    const before = input.map(function (a) { return a.severity; });
    Core.rankAlertsBySeverity(input);
    assert.deepStrictEqual(input.map(function (a) { return a.severity; }), before);
  });

  test("returns a new array reference (not the same object)", () => {
    const input = [{ text: "z", severity: "low" }];
    assert.notStrictEqual(Core.rankAlertsBySeverity(input), input);
  });

  test("unknown severities sort to the end", () => {
    const ranked = Core.rankAlertsBySeverity([
      { text: "a", severity: "unknown"  },
      { text: "b", severity: "critical" }
    ]);
    assert.strictEqual(ranked[0].severity, "critical");
    assert.strictEqual(ranked[1].severity, "unknown");
  });

  test("handles empty array",         () => assert.strictEqual(Core.rankAlertsBySeverity([]).length,         0));
  test("handles undefined input",     () => assert.strictEqual(Core.rankAlertsBySeverity(undefined).length,  0));
  test("handles null input",          () => assert.strictEqual(Core.rankAlertsBySeverity(null).length,       0));
  test("handles non-array string",    () => assert.strictEqual(Core.rankAlertsBySeverity("critical").length, 0));
  test("single element returned as-is",() => {
    const result = Core.rankAlertsBySeverity([{ text: "solo", severity: "high" }]);
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].severity, "high");
  });
  test("all-same-severity preserves length", () => {
    const input = [
      { text: "x", severity: "medium" },
      { text: "y", severity: "medium" },
      { text: "z", severity: "medium" }
    ];
    assert.strictEqual(Core.rankAlertsBySeverity(input).length, 3);
  });
  test("two identical severities — both preserved", () => {
    const result = Core.rankAlertsBySeverity([
      { text: "first",  severity: "high" },
      { text: "second", severity: "high" }
    ]);
    assert.strictEqual(result.length, 2);
  });
});

/* ══════════════════════════════════════════════════════════════════════════
   SUITE 8: computeDepartureTime
══════════════════════════════════════════════════════════════════════════ */
describe("computeDepartureTime", function () {
  test("returns object with 'depart' string and 'bufferMinutes' number", () => {
    const result = Core.computeDepartureTime(20, 60);
    assert.ok(typeof result.depart        === "string", "depart must be a string");
    assert.ok(typeof result.bufferMinutes === "number", "bufferMinutes must be a number");
  });

  test("depart string matches HH:MM format",        () => {
    const result = Core.computeDepartureTime(20, 60);
    assert.ok(/^\d{2}:\d{2}$/.test(result.depart), "Expected HH:MM, got: " + result.depart);
  });

  test("bufferMinutes is always 15",                () => assert.strictEqual(Core.computeDepartureTime(20, 60).bufferMinutes,  15));
  test("bufferMinutes is always 15 for zero travel",() => assert.strictEqual(Core.computeDepartureTime(0,  60).bufferMinutes,  15));

  test("longer travel time → earlier departure",    () => {
    const shortTrip = new Date("1970-01-01T" + Core.computeDepartureTime(5,  60).depart + ":00").getTime();
    const longTrip  = new Date("1970-01-01T" + Core.computeDepartureTime(40, 60).depart + ":00").getTime();
    // Modulo arithmetic in case of midnight crossover; just verify directionality
    assert.ok(
      longTrip <= shortTrip || (shortTrip - longTrip) > 30 * 60 * 1000,
      "Longer trip should depart earlier"
    );
  });

  test("zero travel returns valid HH:MM",           () => {
    const result = Core.computeDepartureTime(0, 60);
    assert.ok(/^\d{2}:\d{2}$/.test(result.depart));
  });

  test("very large travel time is clamped (no crash)", () => {
    assert.doesNotThrow(function () {
      Core.computeDepartureTime(9999, 30);
    });
  });
});

/* ══════════════════════════════════════════════════════════════════════════
   SUITE 9: EMISSION_FACTORS_KG_PER_KM constant
══════════════════════════════════════════════════════════════════════════ */
describe("EMISSION_FACTORS_KG_PER_KM", function () {
  test("constant is exported",                      () => assert.ok(Core.EMISSION_FACTORS_KG_PER_KM !== undefined));
  test("constant is frozen",                        () => assert.ok(Object.isFrozen(Core.EMISSION_FACTORS_KG_PER_KM)));
  test("walk factor is exactly 0",                  () => assert.strictEqual(Core.EMISSION_FACTORS_KG_PER_KM.walk,      0));
  test("bike factor is exactly 0",                  () => assert.strictEqual(Core.EMISSION_FACTORS_KG_PER_KM.bike,      0));
  test("transit factor is 0.04",                    () => assert.strictEqual(Core.EMISSION_FACTORS_KG_PER_KM.transit,   0.04));
  test("rideshare factor is 0.17",                  () => assert.strictEqual(Core.EMISSION_FACTORS_KG_PER_KM.rideshare, 0.17));
  test("car factor is 0.19",                        () => assert.strictEqual(Core.EMISSION_FACTORS_KG_PER_KM.car,       0.19));
  test("car > rideshare > transit > bike = walk",   () => {
    const f = Core.EMISSION_FACTORS_KG_PER_KM;
    assert.ok(f.car > f.rideshare);
    assert.ok(f.rideshare > f.transit);
    assert.ok(f.transit > f.bike);
    assert.strictEqual(f.bike, f.walk);
  });
  test("has exactly 5 mode entries",                () => {
    assert.strictEqual(Object.keys(Core.EMISSION_FACTORS_KG_PER_KM).length, 5);
  });
});

/* ══════════════════════════════════════════════════════════════════════════
   SUITE 10: INTEGRATION TESTS
   Verify that combinations of pure functions produce correct composed results.
   These tests mirror real application workflows.
══════════════════════════════════════════════════════════════════════════ */
describe("Integration — composed function workflows", function () {

  test("high-density zone triggers classifyCrowd and generates advice text", () => {
    // Simulate what renderZones does: clamp density then classify
    var density = 92;
    var clamped = Core.clampNumber(density, 0, 100);
    var result  = Core.classifyCrowd(clamped);
    assert.strictEqual(result.key, "critical");
    assert.ok(result.advice.length > 0);
  });

  test("sanitizeText output fed to isSupportedLanguage stays valid", () => {
    // A user-typed language that happens to be safe
    var userInput = Core.sanitizeText("English", 50);
    assert.strictEqual(Core.isSupportedLanguage(userInput), true);
  });

  test("sanitizeText with XSS attempt produces non-dangerous, non-matching language", () => {
    var xssAttempt = Core.sanitizeText('<script>alert("English")</script>', 50);
    assert.strictEqual(Core.isSupportedLanguage(xssAttempt), false);
  });

  test("rankAlertsBySeverity → first item always has lowest or equal SEVERITY_ORDER value", () => {
    var alerts = [
      { text: "minor",    severity: "low"      },
      { text: "urgent",   severity: "critical" },
      { text: "moderate", severity: "medium"   }
    ];
    var ranked = Core.rankAlertsBySeverity(alerts);
    assert.strictEqual(ranked[0].severity, "critical");
  });

  test("estimateCarbonKg with clamped distance from clampNumber matches direct call", () => {
    var raw     = -50; // invalid negative
    var clamped = Core.clampNumber(raw, 0, 500);
    assert.strictEqual(Core.estimateCarbonKg("car", clamped), Core.estimateCarbonKg("car", 0));
    assert.strictEqual(Core.estimateCarbonKg("car", clamped), 0);
  });

  test("estimateWalkTime and computeDepartureTime compose without error", () => {
    var base          = 8;
    var walkTime      = Core.estimateWalkTime(base, true); // 10 minutes
    var departure     = Core.computeDepartureTime(walkTime, 60);
    assert.ok(typeof departure.depart === "string");
    assert.ok(/^\d{2}:\d{2}$/.test(departure.depart));
  });

  test("clampNumber prevents invalid crowd density from crashing classifyCrowd", () => {
    var badDensities = [NaN, undefined, -999, 99999, "high", null];
    badDensities.forEach(function (d) {
      assert.doesNotThrow(function () {
        // App would clamp first, but classifyCrowd also clamps internally
        Core.classifyCrowd(d);
      }, "classifyCrowd should not throw for: " + d);
    });
  });

  test("all supported languages are accepted by isSupportedLanguage", () => {
    Core.SUPPORTED_LANGUAGES.forEach(function (lang) {
      assert.strictEqual(
        Core.isSupportedLanguage(lang), true,
        lang + " must be accepted by isSupportedLanguage"
      );
    });
  });

  test("transport carbon ranking is consistent with EMISSION_FACTORS ordering", () => {
    var dist = 15;
    var carCo2   = Core.estimateCarbonKg("car",     dist);
    var transCo2 = Core.estimateCarbonKg("transit", dist);
    var walkCo2  = Core.estimateCarbonKg("walk",    dist);
    assert.ok(carCo2 > transCo2, "Car must emit more than transit");
    assert.ok(transCo2 > walkCo2, "Transit must emit more than walking");
    assert.strictEqual(walkCo2, 0, "Walking must be zero emission");
  });
});

/* ══════════════════════════════════════════════════════════════════════════
   RESULTS SUMMARY
══════════════════════════════════════════════════════════════════════════ */
const suiteEndNs   = process.hrtime.bigint();
const durationMs   = Number(suiteEndNs - suiteStartNs) / 1_000_000;
const totalTests   = passed + failed;

console.log("\n" + "═".repeat(50));
console.log("Total:     " + totalTests  + " tests");
console.log("Results:   " + passed + " passed  |  " + failed + " failed");
console.log("Duration:  " + durationMs.toFixed(2) + " ms");
console.log("═".repeat(50));

if (failures.length > 0) {
  console.log("\nFailed tests:");
  failures.forEach(function (f, idx) {
    console.log("  " + (idx + 1) + ". \u2717 " + f.name);
    console.log("     " + f.error.message);
  });
}

process.exitCode = failed > 0 ? 1 : 0;
