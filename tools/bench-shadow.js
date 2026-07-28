// Audit #16 cost check: how much does Shadow DOM traversal add to the HOT path?
//
// The hot path is the wheel handler → findVideoAtPoint. elementsFromPoint itself
// is unchanged, so the only new work is (a) the Array#filter that collects shadow
// hosts, and (b) the descent — which only runs when the light-DOM pass found
// nothing. This measures the delta on synthetic hit-stacks shaped like real pages.
const fs = require("fs");
const vm = require("vm");

function slice(file, from, to) {
  const t = fs.readFileSync(file, "utf8");
  const a = t.indexOf(from), b = t.indexOf(to, a);
  return t.slice(a, b);
}
const SRC = slice("content.js", "const SHADOW_MAX_DEPTH", "function getVideoUnderPointer");

const ctx = { zoneRectForVideo: (v) => v.__rect, console };
vm.createContext(ctx);
vm.runInContext(SRC, ctx);
const { videoFromStack, videoFromShadowStack } = ctx;

// عنصر عادي: لا فيديو، لا جذر ظل — أكثر ما يمر عليه معالج العجلة
const plain = () => ({
  tagName: "DIV",
  closest: () => null,
  querySelectorAll: () => [],
  shadowRoot: null
});

function makeVideo() {
  const v = { tagName: "VIDEO", getBoundingClientRect: () => ({ width: 640, height: 360, left: 0, top: 0, right: 640, bottom: 360 }) };
  v.__rect = { left: 0, top: 0, right: 640, bottom: 360 };
  return v;
}

const DEPTH = 14;                      // عمق مكدّس نموذجي لصفحة حقيقية
const noVideo = Array.from({ length: DEPTH }, plain);
const withVideo = [...Array.from({ length: DEPTH - 1 }, plain), makeVideo()];

// صفحة فيها مكوّن ويب: مضيف واحد داخل المكدّس، والفيديو خلف حدّ الظل
const hostStack = (() => {
  const video = makeVideo();
  const host = plain();
  host.shadowRoot = { elementsFromPoint: () => [video] };
  return [...Array.from({ length: DEPTH - 1 }, plain), host];
})();

const N = 200000;
function bench(label, fn) {
  fn(); // إحماء
  const t0 = process.hrtime.bigint();
  for (let i = 0; i < N; i++) fn();
  const ns = Number(process.hrtime.bigint() - t0) / N;
  console.log(`  ${label.padEnd(46)} ${ns.toFixed(3)} ns/نداء`);
  return ns;
}

console.log(`\nمكدّس بعمق ${DEPTH} عنصراً · ${N.toLocaleString("en")} تكرار\n`);

console.log("① الحالة الشائعة — فيديو موجود في الـ DOM العادي:");
const oldHit = bench("قبل: المسح العادي وحده", () => videoFromStack(withVideo, 10, 10));
const newHit = bench("بعد: نفس المسح ثم خروج مبكر", () => {
  const d = videoFromStack(withVideo, 10, 10);
  return d || videoFromShadowStack(withVideo, 10, 10);
});

console.log("\n② أسوأ حالة — لا فيديو إطلاقاً، فيُدفع ثمن البحث في الظل:");
const oldMiss = bench("قبل: المسح العادي وحده", () => videoFromStack(noVideo, 10, 10));
const newMiss = bench("بعد: المسح + جمع مضيفي الظل", () => {
  const d = videoFromStack(noVideo, 10, 10);
  return d || videoFromShadowStack(noVideo, 10, 10);
});

console.log("\n③ القدرة الجديدة — فيديو خلف حدّ الظل:");
const shadowFound = bench("بعد: العثور عليه عبر جذر الظل", () => {
  const d = videoFromStack(hostStack, 10, 10);
  return d || videoFromShadowStack(hostStack, 10, 10);
});
const found = (() => {
  const d = videoFromStack(hostStack, 10, 10);
  return d || videoFromShadowStack(hostStack, 10, 10);
})();
console.log(`  ${found?.tagName === "VIDEO" ? "✅ عُثر على الفيديو" : "❌ لم يُعثر عليه"}`);
console.log(`  ${videoFromStack(hostStack, 10, 10) === null ? "✅ المسح العادي وحده يفشل (كما كان قبل الإصلاح)" : "❌"}`);

console.log("\n── الخلاصة ──");
console.log(`  الحالة الشائعة (فيديو موجود) : ${(newHit - oldHit).toFixed(3)} ns إضافية للنداء`);
console.log(`  أسوأ حالة (لا فيديو)         : ${(newMiss - oldMiss).toFixed(3)} ns إضافية للنداء`);
console.log(`  عند 120 حدث عجلة/ثانية       : ${((newMiss - oldMiss) * 120 / 1e6).toFixed(4)} ms/ثانية في أسوأ حالة`);
console.log("  ملاحظة: هذا الجزء JS فقط. في المتصفح الحقيقي يهيمن");
console.log("  elementsFromPoint و querySelectorAll بميكروثوانٍ، فالنسبة الفعلية أصغر بكثير.\n");
