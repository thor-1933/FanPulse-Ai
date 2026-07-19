/**
 * fanpulse-core.test.js
 * ---------------------------------------------------------------------------
 * Zero-dependency unit tests for FanPulse AI's pure logic layer.
 *
 * Why this approach: the app ships as a single, dependency-free HTML file
 * (see index.html) so it can run directly as a Claude Artifact with no
 * build step. All non-DOM, non-network logic lives in one isolated
 * <script id="core-logic"> block and is exposed as `window.FanPulseCore`.
 * This test file extracts that exact block from the shipped HTML and runs it
 * in a sandboxed Node `vm` context, so tests always exercise the real
 * production code — never a hand-copied duplicate that could drift out of sync.
 *
 * Run with:  node fanpulse-core.test.js
 * Exits with status 0 on success, 1 on any failure (CI-friendly).
 * ---------------------------------------------------------------------------
 */

"use strict";

const fs     = require("fs");
const path   = require("path");
const vm     = require("vm");
const assert = require("assert");

/* ─────────────────────────── Performance tracking ──────────────────────────── */
const suiteStart = process.hrtime.bigint();

/* ─────────────────────────── Core-logic loader ─────────────────────────────── */

/**
 * Extract the <script id="core-logic"> block from index.html and evaluate it
 * inside a sandboxed vm context. Returns the `window.FanPulseCore` object.
 * Throws a descriptive error if the block cannot be found.
 *
 * @returns {object} FanPulseCore public API
 */
function loadCore() {
  const htmlPath = path.join(__dirname, "index.html");
  const html     = fs.readFileSync(htmlPath, "utf8");

  // Split on the literal opening tag so we always find the actual <script> element,
  // not any mention of it inside HTML comments above the script block.
  const OPEN_TAG  = '<script id="core-logic">';
  const CLOSE_TAG = '</script>';
  const openIdx   = html.lastIndexOf(OPEN_TAG);
  if (openIdx === -1) {
    throw new Error(
      'Could not find <script id="core-logic"> block in index.html. ' +
      "Ensure the block exists and has not been renamed or split."
    );
  }
  const contentStart = openIdx + OPEN_TAG.length;
  const closeIdx     = html.indexOf(CLOSE_TAG, contentStart);
  if (closeIdx === -1) {
    throw new Error('Found opening <script id="core-logic"> but no matching </script> closing tag.');
  }
  const scriptSrc = html.slice(contentStart, closeIdx);

  const sandbox = { window: {}, module: { exports: {} } };
  vm.createContext(sandbox);
  vm.runInContext(scriptSrc, sandbox, { filename: "core-logic.js" });
  return sandbox.window.FanPulseCore;
}

/* ─────────────────────────── Test runner ───────────────────────────────────── */

let passed   = 0;
let failed   = 0;
const failures = [];

/**
 * Run a synchronous test case and record the result.
 *
 * @param {string}   name - Human-readable test description.
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
    process.stdout.write("      " + err.message + "\n");
  }
}

/* ─────────────────────────── Load the module ───────────────────────────────── */
console.log("FanPulse AI — core-logic test suite\n");
const Core = loadCore();

/* ══════════════════════════════════════════════════════════════════════════════
   clampNumber
══════════════════════════════════════════════════════════════════════════════ */
console.log("clampNumber");
test("clamps value below minimum to min",    () => assert.strictEqual(Core.clampNumber(-5,   0, 100), 0));
test("clamps value above maximum to max",    () => assert.strictEqual(Core.clampNumber(500,  0, 100), 100));
test("passes through in-range values",       () => assert.strictEqual(Core.clampNumber(42,   0, 100), 42));
test("passes through value equal to min",    () => assert.strictEqual(Core.clampNumber(0,    0, 100), 0));
test("passes through value equal to max",    () => assert.strictEqual(Core.clampNumber(100,  0, 100), 100));
test("falls back to min for NaN input",      () => assert.strictEqual(Core.clampNumber(NaN,  5,  10), 5));
test("falls back to min for string input",   () => assert.strictEqual(Core.clampNumber("abc", 5, 10), 5));
test("falls back to min for undefined",      () => assert.strictEqual(Core.clampNumber(undefined, 5, 10), 5));
test("falls back to min for null",           () => assert.strictEqual(Core.clampNumber(null, 5, 10), 5));
test("clamps Infinity to max",               () => assert.strictEqual(Core.clampNumber(Infinity, 0, 100), 100));
test("clamps -Infinity to min",              () => assert.strictEqual(Core.clampNumber(-Infinity, 0, 100), 0));
test("handles float values correctly",       () => assert.strictEqual(Core.clampNumber(3.7, 0, 10), 3.7));

/* ══════════════════════════════════════════════════════════════════════════════
   classifyCrowd
══════════════════════════════════════════════════════════════════════════════ */
console.log("\nclassifyCrowd");
test("0 is Low",                             () => assert.strictEqual(Core.classifyCrowd(0).key,   "low"));
test("34 is Low (just below boundary)",      () => assert.strictEqual(Core.classifyCrowd(34).key,  "low"));
test("35 is Moderate (exact boundary)",      () => assert.strictEqual(Core.classifyCrowd(35).key,  "moderate"));
test("64 is Moderate",                       () => assert.strictEqual(Core.classifyCrowd(64).key,  "moderate"));
test("65 is High (exact boundary)",          () => assert.strictEqual(Core.classifyCrowd(65).key,  "high"));
test("87 is High",                           () => assert.strictEqual(Core.classifyCrowd(87).key,  "high"));
test("88 is Critical (exact boundary)",      () => assert.strictEqual(Core.classifyCrowd(88).key,  "critical"));
test("100 is Critical",                      () => assert.strictEqual(Core.classifyCrowd(100).key, "critical"));
test("out-of-range 999 is clamped → Critical", () => assert.strictEqual(Core.classifyCrowd(999).key, "critical"));
test("negative value -10 is clamped → Low", () => assert.strictEqual(Core.classifyCrowd(-10).key, "low"));
test("every level has non-empty advice text", () => {
  [0, 40, 70, 95].forEach(function (density) {
    const result = Core.classifyCrowd(density);
    assert.ok(typeof result.advice === "string" && result.advice.length > 0,
      "Expected non-empty advice for density " + density);
  });
});
test("every level has a non-empty display string", () => {
  [0, 40, 70, 95].forEach(function (density) {
    const result = Core.classifyCrowd(density);
    assert.ok(typeof result.level === "string" && result.level.length > 0,
      "Expected non-empty level for density " + density);
  });
});

/* ══════════════════════════════════════════════════════════════════════════════
   sanitizeText
══════════════════════════════════════════════════════════════════════════════ */
console.log("\nsanitizeText");
test("escapes <script> tags", () => {
  const out = Core.sanitizeText("<script>alert(1)</script>");
  assert.ok(!out.includes("<script>"),     "Output must not contain <script>");
  assert.ok(out.includes("&lt;script&gt;"), "Output must contain escaped form");
});
test("escapes ampersands",          () => assert.ok(Core.sanitizeText("A & B").includes("&amp;")));
test("escapes double quotes",       () => assert.ok(Core.sanitizeText('say "hi"').includes("&quot;")));
test("escapes single quotes",       () => assert.ok(Core.sanitizeText("it's").includes("&#39;")));
test("escapes > characters",        () => assert.ok(Core.sanitizeText("a > b").includes("&gt;")));
test("full compound escape",        () => {
  const out = Core.sanitizeText(`Tom & Jerry's "show"`);
  assert.strictEqual(out, "Tom &amp; Jerry&#39;s &quot;show&quot;");
});
test("truncates to maxLen before escaping", () => {
  const out = Core.sanitizeText("a".repeat(50), 10);
  assert.strictEqual(out.length, 10);
});
test("handles null input without throwing",      () => assert.strictEqual(Core.sanitizeText(null),      ""));
test("handles undefined input without throwing", () => assert.strictEqual(Core.sanitizeText(undefined), ""));
test("handles empty string input",               () => assert.strictEqual(Core.sanitizeText(""),         ""));
test("handles numeric input via coercion",       () => assert.strictEqual(Core.sanitizeText(42),        "42"));
test("default maxLen is 400 characters", () => {
  const long = "x".repeat(500);
  assert.strictEqual(Core.sanitizeText(long).length, 400);
});
test("exact boundary: string of exactly maxLen is not truncated", () => {
  const exactly = "y".repeat(400);
  assert.strictEqual(Core.sanitizeText(exactly, 400).length, 400);
});
test("string shorter than maxLen is not padded", () => {
  assert.strictEqual(Core.sanitizeText("hello", 400).length, 5);
});

/* ══════════════════════════════════════════════════════════════════════════════
   estimateWalkTime
══════════════════════════════════════════════════════════════════════════════ */
console.log("\nestimateWalkTime");
test("standard route returns base minutes as-is",  () => assert.strictEqual(Core.estimateWalkTime(10, false), 10));
test("accessible route adds 25% overhead",         () => assert.strictEqual(Core.estimateWalkTime(10, true),  13));
test("clamps 0 base minutes to minimum of 1",      () => assert.strictEqual(Core.estimateWalkTime(0,  false), 1));
test("clamps negative base minutes to 1",          () => assert.strictEqual(Core.estimateWalkTime(-5, false), 1));
test("clamps above 60 minutes to max of 60",       () => assert.strictEqual(Core.estimateWalkTime(100, false), 60));
test("accessible clamp: 1 min base → 1 min result (rounds down)", () => {
  assert.strictEqual(Core.estimateWalkTime(1, true), 1); // Math.round(1.25) = 1
});
test("result is always a whole number",            () => {
  const result = Core.estimateWalkTime(7, true); // 7 * 1.25 = 8.75 → 9
  assert.strictEqual(result, Math.round(result));
});

/* ══════════════════════════════════════════════════════════════════════════════
   estimateCarbonKg
══════════════════════════════════════════════════════════════════════════════ */
console.log("\nestimateCarbonKg");
test("walking produces zero emissions",                    () => assert.strictEqual(Core.estimateCarbonKg("walk",      10), 0));
test("biking produces zero emissions",                     () => assert.strictEqual(Core.estimateCarbonKg("bike",      10), 0));
test("transit produces correct value (0.04 * 10 = 0.4)",  () => assert.strictEqual(Core.estimateCarbonKg("transit",   10), 0.4));
test("rideshare produces correct value (0.17 * 10 = 1.7)",() => assert.strictEqual(Core.estimateCarbonKg("rideshare", 10), 1.7));
test("car produces correct value (0.19 * 10 = 1.9)",      () => assert.strictEqual(Core.estimateCarbonKg("car",       10), 1.9));
test("car emits more than transit over same distance",     () => {
  assert.ok(Core.estimateCarbonKg("car", 10) > Core.estimateCarbonKg("transit", 10));
});
test("unknown mode falls back to car factor",              () => {
  assert.strictEqual(Core.estimateCarbonKg("hoverboard", 10), Core.estimateCarbonKg("car", 10));
});
test("negative distance is clamped → zero emissions",      () => assert.strictEqual(Core.estimateCarbonKg("car",  -5), 0));
test("zero distance produces zero emissions",              () => assert.strictEqual(Core.estimateCarbonKg("car",   0), 0));
test("result rounded to 2 decimal places",                 () => {
  const result = Core.estimateCarbonKg("transit", 3); // 0.04 * 3 = 0.12
  assert.strictEqual(result, 0.12);
});

/* ══════════════════════════════════════════════════════════════════════════════
   isSupportedLanguage
══════════════════════════════════════════════════════════════════════════════ */
console.log("\nisSupportedLanguage");
test("English is supported",                 () => assert.strictEqual(Core.isSupportedLanguage("English"),    true));
test("Spanish is supported",                 () => assert.strictEqual(Core.isSupportedLanguage("Spanish"),    true));
test("French is supported",                  () => assert.strictEqual(Core.isSupportedLanguage("French"),     true));
test("German is supported",                  () => assert.strictEqual(Core.isSupportedLanguage("German"),     true));
test("Mandarin is supported",                () => assert.strictEqual(Core.isSupportedLanguage("Mandarin"),   true));
test("arbitrary string is rejected",         () => assert.strictEqual(Core.isSupportedLanguage("Klingon"),    false));
test("empty string is rejected",             () => assert.strictEqual(Core.isSupportedLanguage(""),           false));
test("case-sensitive: 'english' rejected",   () => assert.strictEqual(Core.isSupportedLanguage("english"),    false));
test("case-sensitive: 'ENGLISH' rejected",   () => assert.strictEqual(Core.isSupportedLanguage("ENGLISH"),    false));
test("SUPPORTED_LANGUAGES is non-empty",     () => assert.ok(Core.SUPPORTED_LANGUAGES.length > 0));
test("SUPPORTED_LANGUAGES includes 9 entries", () => assert.strictEqual(Core.SUPPORTED_LANGUAGES.length, 9));
test("SUPPORTED_LANGUAGES is frozen (immutable)", () => {
  assert.ok(Object.isFrozen(Core.SUPPORTED_LANGUAGES));
});

/* ══════════════════════════════════════════════════════════════════════════════
   rankAlertsBySeverity
══════════════════════════════════════════════════════════════════════════════ */
console.log("\nrankAlertsBySeverity");
test("sorts critical → high → medium → low", () => {
  const input  = [
    { text: "a", severity: "low"      },
    { text: "b", severity: "critical" },
    { text: "c", severity: "medium"   },
    { text: "d", severity: "high"     }
  ];
  const ranked = Core.rankAlertsBySeverity(input);
  assert.deepStrictEqual(
    ranked.map(function (a) { return a.severity; }),
    ["critical", "high", "medium", "low"]
  );
});
test("does not mutate the original array", () => {
  const input        = [{ text: "a", severity: "low" }, { text: "b", severity: "critical" }];
  const originalOrder = input.map(function (a) { return a.severity; });
  Core.rankAlertsBySeverity(input);
  assert.deepStrictEqual(input.map(function (a) { return a.severity; }), originalOrder);
});
test("unknown severities sort to the end", () => {
  const input  = [{ text: "a", severity: "unknown" }, { text: "b", severity: "critical" }];
  const ranked = Core.rankAlertsBySeverity(input);
  assert.strictEqual(ranked[0].severity, "critical");
  assert.strictEqual(ranked[1].severity, "unknown");
});
test("handles empty array gracefully",     () => assert.strictEqual(Core.rankAlertsBySeverity([]).length,         0));
test("handles undefined input gracefully", () => assert.strictEqual(Core.rankAlertsBySeverity(undefined).length,  0));
test("handles null input gracefully",      () => assert.strictEqual(Core.rankAlertsBySeverity(null).length,       0));
test("single-element array is returned unchanged", () => {
  const input  = [{ text: "only", severity: "high" }];
  const ranked = Core.rankAlertsBySeverity(input);
  assert.strictEqual(ranked.length, 1);
  assert.strictEqual(ranked[0].severity, "high");
});
test("all-same-severity array preserves length", () => {
  const input  = [
    { text: "x", severity: "medium" },
    { text: "y", severity: "medium" },
    { text: "z", severity: "medium" }
  ];
  assert.strictEqual(Core.rankAlertsBySeverity(input).length, 3);
});
test("returns a new array instance (not a reference)", () => {
  const input  = [{ text: "a", severity: "low" }];
  const ranked = Core.rankAlertsBySeverity(input);
  assert.notStrictEqual(ranked, input);
});

/* ══════════════════════════════════════════════════════════════════════════════
   computeDepartureTime
══════════════════════════════════════════════════════════════════════════════ */
console.log("\ncomputeDepartureTime");
test("returns an object with depart string and bufferMinutes", () => {
  const result = Core.computeDepartureTime(20, 60);
  assert.ok(typeof result.depart        === "string",  "depart should be a string");
  assert.ok(typeof result.bufferMinutes === "number",  "bufferMinutes should be a number");
});
test("depart string is formatted as HH:MM", () => {
  const result = Core.computeDepartureTime(20, 60);
  assert.ok(/^\d{2}:\d{2}$/.test(result.depart), "Expected HH:MM format, got: " + result.depart);
});
test("bufferMinutes is 15 (fixed queue buffer)", () => {
  const result = Core.computeDepartureTime(20, 60);
  assert.strictEqual(result.bufferMinutes, 15);
});
test("earlier departure for longer travel time", () => {
  // A longer travel time should produce an earlier (lower numeric) departure
  const shortTrip = Core.computeDepartureTime(10, 60);
  const longTrip  = Core.computeDepartureTime(40, 60);
  const shortMs   = new Date("1970-01-01T" + shortTrip.depart + ":00").getTime();
  const longMs    = new Date("1970-01-01T" + longTrip.depart  + ":00").getTime();
  assert.ok(longMs <= shortMs, "Longer trip should depart earlier or at same time");
});

/* ══════════════════════════════════════════════════════════════════════════════
   EMISSION_FACTORS_KG_PER_KM (public constant)
══════════════════════════════════════════════════════════════════════════════ */
console.log("\nEMISSION_FACTORS_KG_PER_KM");
test("constant is exposed on the public API",     () => assert.ok(Core.EMISSION_FACTORS_KG_PER_KM !== undefined));
test("constant is frozen (immutable)",            () => assert.ok(Object.isFrozen(Core.EMISSION_FACTORS_KG_PER_KM)));
test("walk factor is 0 (zero emissions)",         () => assert.strictEqual(Core.EMISSION_FACTORS_KG_PER_KM.walk,      0));
test("bike factor is 0 (zero emissions)",         () => assert.strictEqual(Core.EMISSION_FACTORS_KG_PER_KM.bike,      0));
test("car factor is greater than transit factor", () => {
  assert.ok(Core.EMISSION_FACTORS_KG_PER_KM.car > Core.EMISSION_FACTORS_KG_PER_KM.transit);
});

/* ══════════════════════════════════════════════════════════════════════════════
   SUMMARY
══════════════════════════════════════════════════════════════════════════════ */
const suiteEnd    = process.hrtime.bigint();
const durationMs  = Number(suiteEnd - suiteStart) / 1_000_000;

console.log("\n" + "═".repeat(50));
console.log("Results:   " + passed + " passed  |  " + failed + " failed");
console.log("Duration:  " + durationMs.toFixed(2) + " ms");
console.log("═".repeat(50));

if (failures.length > 0) {
  console.log("\nFailed tests:");
  failures.forEach(function (f) {
    console.log("  \u2717 " + f.name);
    console.log("    " + f.error.message);
  });
}

if (failed > 0) {
  process.exitCode = 1;
}
