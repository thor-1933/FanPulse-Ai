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
 * production code — never a hand-copied duplicate that could drift out of
 * sync.
 *
 * Run with:  node fanpulse-core.test.js
 * Exits with status 0 on success, 1 on any failure (CI-friendly).
 * ---------------------------------------------------------------------------
 */

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const assert = require("assert");

function loadCore() {
  const htmlPath = path.join(__dirname, "index.html");
  const html = fs.readFileSync(htmlPath, "utf8");

  const match = html.match(/<script id="core-logic">([\s\S]*?)<\/script>/);
  if (!match) {
    throw new Error("Could not find <script id=\"core-logic\"> block in index.html");
  }
  const scriptSrc = match[1];

  const sandbox = { window: {}, module: { exports: {} } };
  vm.createContext(sandbox);
  vm.runInContext(scriptSrc, sandbox, { filename: "core-logic.js" });
  return sandbox.window.FanPulseCore;
}

let passed = 0;
let failed = 0;
const failures = [];

function test(name, fn) {
  try {
    fn();
    passed += 1;
    console.log("  \u2713 " + name);
  } catch (err) {
    failed += 1;
    failures.push({ name: name, error: err });
    console.log("  \u2717 " + name);
    console.log("      " + err.message);
  }
}

console.log("FanPulse core-logic test suite\n");
const Core = loadCore();

/* ------------------------------- clampNumber ------------------------------- */
console.log("clampNumber");
test("clamps below minimum", () => assert.strictEqual(Core.clampNumber(-5, 0, 100), 0));
test("clamps above maximum", () => assert.strictEqual(Core.clampNumber(500, 0, 100), 100));
test("passes through in-range values", () => assert.strictEqual(Core.clampNumber(42, 0, 100), 42));
test("falls back to min for NaN", () => assert.strictEqual(Core.clampNumber(NaN, 5, 10), 5));
test("falls back to min for non-number input", () => assert.strictEqual(Core.clampNumber("abc", 5, 10), 5));

/* ------------------------------- classifyCrowd ------------------------------- */
console.log("\nclassifyCrowd");
test("0 is Low", () => assert.strictEqual(Core.classifyCrowd(0).key, "low"));
test("34 is Low (just below boundary)", () => assert.strictEqual(Core.classifyCrowd(34).key, "low"));
test("35 is Moderate (boundary)", () => assert.strictEqual(Core.classifyCrowd(35).key, "moderate"));
test("64 is Moderate", () => assert.strictEqual(Core.classifyCrowd(64).key, "moderate"));
test("65 is High (boundary)", () => assert.strictEqual(Core.classifyCrowd(65).key, "high"));
test("87 is High", () => assert.strictEqual(Core.classifyCrowd(87).key, "high"));
test("88 is Critical (boundary)", () => assert.strictEqual(Core.classifyCrowd(88).key, "critical"));
test("100 is Critical", () => assert.strictEqual(Core.classifyCrowd(100).key, "critical"));
test("out-of-range density is clamped, not thrown", () => assert.strictEqual(Core.classifyCrowd(999).key, "critical"));
test("every level includes actionable advice text", () => {
  [0, 40, 70, 95].forEach((d) => {
    const result = Core.classifyCrowd(d);
    assert.ok(typeof result.advice === "string" && result.advice.length > 0);
  });
});

/* ------------------------------- sanitizeText ------------------------------- */
console.log("\nsanitizeText");
test("escapes script tags", () => {
  const out = Core.sanitizeText("<script>alert(1)</script>");
  assert.ok(!out.includes("<script>"));
  assert.ok(out.includes("&lt;script&gt;"));
});
test("escapes quotes and ampersands", () => {
  const out = Core.sanitizeText(`Tom & Jerry's "show"`);
  assert.strictEqual(out, "Tom &amp; Jerry&#39;s &quot;show&quot;");
});
test("truncates to the max length before escaping", () => {
  const out = Core.sanitizeText("a".repeat(50), 10);
  assert.strictEqual(out.length, 10);
});
test("handles null/undefined input without throwing", () => {
  assert.strictEqual(Core.sanitizeText(null), "");
  assert.strictEqual(Core.sanitizeText(undefined), "");
});

/* ------------------------------- estimateWalkTime ------------------------------- */
console.log("\nestimateWalkTime");
test("standard route uses base minutes as-is", () => assert.strictEqual(Core.estimateWalkTime(10, false), 10));
test("accessible route adds 25%", () => assert.strictEqual(Core.estimateWalkTime(10, true), 13));
test("clamps unrealistic base minutes", () => assert.strictEqual(Core.estimateWalkTime(0, false), 1));

/* ------------------------------- estimateCarbonKg ------------------------------- */
console.log("\nestimateCarbonKg");
test("walking produces zero emissions", () => assert.strictEqual(Core.estimateCarbonKg("walk", 10), 0));
test("car produces more emissions than transit over same distance", () => {
  assert.ok(Core.estimateCarbonKg("car", 10) > Core.estimateCarbonKg("transit", 10));
});
test("unknown mode falls back to car factor (conservative estimate)", () => {
  assert.strictEqual(Core.estimateCarbonKg("hoverboard", 10), Core.estimateCarbonKg("car", 10));
});
test("negative distance is clamped to zero emissions", () => assert.strictEqual(Core.estimateCarbonKg("car", -5), 0));

/* ------------------------------- isSupportedLanguage ------------------------------- */
console.log("\nisSupportedLanguage");
test("English is supported", () => assert.strictEqual(Core.isSupportedLanguage("English"), true));
test("arbitrary string is rejected", () => assert.strictEqual(Core.isSupportedLanguage("Klingon"), false));
test("supported list is non-empty", () => assert.ok(Core.SUPPORTED_LANGUAGES.length > 0));

/* ------------------------------- rankAlertsBySeverity ------------------------------- */
console.log("\nrankAlertsBySeverity");
test("sorts critical before high before medium before low", () => {
  const input = [
    { text: "a", severity: "low" },
    { text: "b", severity: "critical" },
    { text: "c", severity: "medium" },
    { text: "d", severity: "high" }
  ];
  const ranked = Core.rankAlertsBySeverity(input);
  assert.deepStrictEqual(ranked.map((a) => a.severity), ["critical", "high", "medium", "low"]);
});
test("does not mutate the original array", () => {
  const input = [{ text: "a", severity: "low" }, { text: "b", severity: "critical" }];
  const originalOrder = input.map((a) => a.severity);
  Core.rankAlertsBySeverity(input);
  assert.deepStrictEqual(input.map((a) => a.severity), originalOrder);
});
test("unknown severities sort to the end", () => {
  const input = [{ text: "a", severity: "unknown" }, { text: "b", severity: "critical" }];
  const ranked = Core.rankAlertsBySeverity(input);
  assert.strictEqual(ranked[0].severity, "critical");
});
test("handles empty and non-array input gracefully", () => {
  // Note: Core runs in a separate vm realm, so its Array is a different
  // constructor than this file's Array literals — compare shape, not
  // cross-realm reference/prototype identity.
  assert.strictEqual(Core.rankAlertsBySeverity([]).length, 0);
  assert.strictEqual(Core.rankAlertsBySeverity(undefined).length, 0);
});

/* ------------------------------- summary ------------------------------- */
console.log("\n" + "-".repeat(40));
console.log(passed + " passed, " + failed + " failed");
if (failed > 0) {
  process.exitCode = 1;
}
