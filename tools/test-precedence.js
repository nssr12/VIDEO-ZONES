// Audit #48: the most specific layer must win — zone binding > site rule >
// global rule — and when it wins the general rule must not run AT ALL.
//
// It used to run BOTH on one middle press: the generic path acts on mousedown
// while the zone path acts on auxclick, so the global rule was dispatched first
// by timing alone and the zone action landed on top of it. Measured in Chrome
// before the fix, one press produced:
//   ACTION:TOGGLE_FULLSCREEN via mousedown  +  ACTION:TOGGLE_PLAY via auxclick
//
// So these tests replay the browser's real event SEQUENCE (mousedown → mouseup →
// auxclick / click) and count every runAction call. Counting is the point:
// asserting "the right action ran" would pass even while a second one also ran.
const fs = require("fs");
const vm = require("vm");

function slice(file, from, to) {
  const t = fs.readFileSync(file, "utf8");
  const a = t.indexOf(from), b = t.indexOf(to, a);
  if (a === -1 || b === -1) throw new Error(`تعذّر استخراج ${from}`);
  return t.slice(a, b);
}
const SRC = "content.js";
const PARTS = [
  slice(SRC, "function lookupRemap", "function remappingEnabled"),
  slice(SRC, "function normalizeMappedActions", 'window.addEventListener("mousemove"'),
  slice(SRC, "function normalizeMouseEvent", "function getVideoUnderPointerStrict"),
  // one slice: ZONE_TRIGGER_BY_BUTTON + zoneClickBinding + zoneKeyBinding +
  // handleZoneClick + suppressMiddleClickDefault, always tested together
  slice(SRC, "const ZONE_TRIGGER_BY_BUTTON", 'window.addEventListener("click", handleZoneClick'),
  slice(SRC, "function handleMouse", 'window.addEventListener("click", handleMouse')
].join("\n");

const VIDEO = { tagName: "VIDEO" };

function makeWorld({ zone = 5, zoneClick = null, zoneKey = null, site = null, global: glob = null,
                     zonesOn = true, video = VIDEO } = {}) {
  const ran = [];
  const ctx = {
    // --- stubs for everything outside the precedence logic ---
    zonesActive: () => zonesOn,
    getZoneAtEvent: () => (video ? { video, zone } : null),
    getVideoUnderPointerStrict: () => video,
    getZoneNumber: () => (video ? zone : null),
    zoneRectForVideo: () => ({ left: 0, top: 0, width: 640, height: 360 }),
    shouldLetNativeLinkHandlingRun: () => false,
    updatePointerFromEvent: () => {},
    wakeIfVideoPresent: () => {}, // إطار نائم — لا شأن له بالأولوية (#13ب)
    ensureVideoOverlay: () => {},
    isBlockedHost: () => false,
    remappingEnabled: () => true,
    zoneLabel: (z) => "B" + z,
    showOverlay: () => {},
    nowMs: () => 1000,
    lastPointer: { x: 100, y: 100 },
    lastMouse2At: 0,
    suppressContextMenuUntil: 0,
    runAction: (a, e) => { ran.push({ action: a, via: e && e.type }); return true; },
    zoneSettings: {
      click: { map: zoneClick ? { [String(zone)]: zoneClick } : {} },
      key: { map: zoneKey ? { [String(zone)]: zoneKey } : {} }
    },
    // lookupRemap reads these two by name: site profile first, then global
    siteMap: new Map(site ? Object.entries(site) : []),
    map: new Map(glob ? Object.entries(glob) : []),
    console
  };
  vm.createContext(ctx);
  vm.runInContext(PARTS, ctx);
  ctx.ran = ran;
  return ctx;
}

const mouseEvent = (type, button) => ({
  type, button, clientX: 100, clientY: 100,
  preventDefault() { this.__prevented = true; },
  stopPropagation() {},
  stopImmediatePropagation() { this.__stopped = true; }
});

// Replays a real press the way Chrome dispatches it, in listener-registration
// order, honouring stopImmediatePropagation between the two handlers.
function press(ctx, button) {
  const fire = (type) => {
    const e = mouseEvent(type, button);
    if (type === "mousedown") {
      ctx.suppressMiddleClickDefault(e);      // registered first (line 1383)
      ctx.handleMouse(e);                     // registered later (line 2329)
      return e;
    }
    ctx.handleZoneClick(e);                   // registered first (1380-1382)
    if (!e.__stopped) ctx.handleMouse(e);     // blocked when the zone path won
    return e;
  };
  const down = fire("mousedown");
  const up = fire(button === 0 ? "click" : button === 2 ? "contextmenu" : "auxclick");
  return { down, up };
}

let pass = 0, fail = 0;
const check = (name, cond, extra) => cond
  ? (pass++, console.log("  ✅ " + name))
  : (fail++, console.log("  ❌ " + name, JSON.stringify(extra ?? "")));

console.log("\n[1] ربط المربع يهزم القاعدة العامة على نفس الزر — الزر الأوسط");
{
  const ctx = makeWorld({
    zoneClick: { middle: ["ACTION:TOGGLE_PLAY"] },
    global: { Mouse2: "ACTION:TOGGLE_FULLSCREEN" }
  });
  const { down } = press(ctx, 1);
  check("نُفِّذ أمر واحد فقط — لا تنفيذ مزدوج", ctx.ran.length === 1, ctx.ran);
  check("والفائز هو ربط المربع", ctx.ran[0]?.action === "ACTION:TOGGLE_PLAY", ctx.ran);
  check("لم يُنفَّذ ملء الشاشة إطلاقاً",
    !ctx.ran.some(r => r.action === "ACTION:TOGGLE_FULLSCREEN"), ctx.ran);
  check("ولا حتى قبله على mousedown", !ctx.ran.some(r => r.via === "mousedown"), ctx.ran);
  check("ومؤشر التمرير التلقائي ما زال ممنوعاً (البند 12)", down.__prevented === true);
}

console.log("\n[2] ربط المربع يهزم قاعدة الموقع أيضاً");
{
  const ctx = makeWorld({
    zoneClick: { middle: ["ACTION:TOGGLE_PLAY"] },
    site: { Mouse2: "ACTION:TOGGLE_PIP" },
    global: { Mouse2: "ACTION:TOGGLE_FULLSCREEN" }
  });
  press(ctx, 1);
  check("أمر واحد", ctx.ran.length === 1, ctx.ran);
  check("والفائز ربط المربع", ctx.ran[0]?.action === "ACTION:TOGGLE_PLAY", ctx.ran);
}

console.log("\n[3] قاعدة الموقع تهزم القاعدة العامة حين لا ربط للمربع");
{
  const ctx = makeWorld({
    site: { Mouse2: "ACTION:TOGGLE_PIP" },
    global: { Mouse2: "ACTION:TOGGLE_FULLSCREEN" }
  });
  press(ctx, 1);
  check("أمر واحد", ctx.ran.length === 1, ctx.ran);
  check("والفائز قاعدة الموقع", ctx.ran[0]?.action === "ACTION:TOGGLE_PIP", ctx.ran);
}

console.log("\n[4] غياب ربط المربع يُسقط الأمر للقاعدة الأدنى");
{
  const ctx = makeWorld({ global: { Mouse2: "ACTION:TOGGLE_FULLSCREEN" } });
  press(ctx, 1);
  check("نُفِّذت القاعدة العامة", ctx.ran.length === 1 &&
    ctx.ran[0].action === "ACTION:TOGGLE_FULLSCREEN", ctx.ran);
  // مسار المربعات لا يمنع شيئاً هنا؛ المنع الذي يحدث هو من مسار الريماب العام
  // نفسه لأنه نفّذ أمره — وهو سلوكه الأصلي الذي يوقف التمرير التلقائي أيضاً
  check("مسار المربعات لم يمنع الافتراضي",
    ctx.suppressMiddleClickDefault(mouseEvent("mousedown", 1)) === false);
}
{
  // لا ربط مربع ولا قاعدة على الزر الأوسط ⇒ لا أحد يلمس الافتراضي
  const ctx = makeWorld({ global: { Mouse1: "ACTION:TOGGLE_MUTE" } });
  const { down } = press(ctx, 1);
  check("بلا أي ربط للأوسط: لا تنفيذ ولا منع — التمرير التلقائي للصفحة",
    ctx.ran.length === 0 && down.__prevented !== true, ctx.ran);
}
{
  // ربط لزر آخر لا يحجب هذا الزر
  const ctx = makeWorld({
    zoneClick: { left: ["ACTION:TOGGLE_PLAY"] },
    global: { Mouse2: "ACTION:TOGGLE_FULLSCREEN" }
  });
  press(ctx, 1);
  check("ربط أيسر لا يحجب القاعدة العامة للأوسط",
    ctx.ran.length === 1 && ctx.ran[0].action === "ACTION:TOGGLE_FULLSCREEN", ctx.ran);
}
{
  const ctx = makeWorld({ zoneClick: { middle: ["ACTION:TOGGLE_PLAY"] }, zonesOn: false,
                          global: { Mouse2: "ACTION:TOGGLE_FULLSCREEN" } });
  press(ctx, 1);
  check("المربعات معطّلة ⇒ تسقط للقاعدة العامة",
    ctx.ran.length === 1 && ctx.ran[0].action === "ACTION:TOGGLE_FULLSCREEN", ctx.ran);
}
{
  const ctx = makeWorld({ zoneClick: { middle: ["ACTION:TOGGLE_PLAY"] }, video: null,
                          global: { Mouse2: "ACTION:TOGGLE_FULLSCREEN" } });
  press(ctx, 1);
  check("لا فيديو تحت المؤشر ⇒ لا شيء من مسار المربعات", !ctx.ran.some(r => r.action === "ACTION:TOGGLE_PLAY"), ctx.ran);
}

console.log("\n[5] الزر الأيسر والأيمن — نفس الترتيب، بلا تنفيذ مزدوج");
{
  const left = makeWorld({ zoneClick: { left: ["ACTION:TOGGLE_PLAY"] },
                           global: { Mouse1: "ACTION:TOGGLE_MUTE" } });
  press(left, 0);
  check("الأيسر: أمر واحد وهو ربط المربع",
    left.ran.length === 1 && left.ran[0].action === "ACTION:TOGGLE_PLAY", left.ran);

  const right = makeWorld({ zoneClick: { right: ["ACTION:TOGGLE_PLAY"] },
                            global: { Mouse3: "ACTION:TOGGLE_MUTE" } });
  press(right, 2);
  check("الأيمن: أمر واحد وهو ربط المربع",
    right.ran.length === 1 && right.ran[0].action === "ACTION:TOGGLE_PLAY", right.ran);
}

console.log("\n[6] لوحة المفاتيح — نفس الترتيب بالضبط");
{
  const ctx = makeWorld({ zoneKey: { Space: ["ACTION:TOGGLE_PLAY"] } });
  const bind = ctx.zoneKeyBinding(VIDEO, "Space");
  check("ربط المربع يُحلّ للمفتاح", bind?.actions[0] === "ACTION:TOGGLE_PLAY", bind);
  check("مفتاح بلا ربط يُرجع null — فيسقط لـ lookupRemap",
    ctx.zoneKeyBinding(VIDEO, "ArrowRight") === null);

  const off = makeWorld({ zoneKey: { Space: ["ACTION:TOGGLE_PLAY"] }, zonesOn: false });
  check("المربعات معطّلة ⇒ null", off.zoneKeyBinding(VIDEO, "Space") === null);
}

console.log("\n[7] lookupRemap نفسه: الموقع قبل العام");
{
  const ctx = makeWorld({ site: { Mouse2: "ACTION:TOGGLE_PIP" }, global: { Mouse2: "ACTION:TOGGLE_FULLSCREEN" } });
  check("قاعدة الموقع تفوز", ctx.lookupRemap("Mouse2") === "ACTION:TOGGLE_PIP");
  check("والعام يبقى للبقية", ctx.lookupRemap("Mouse4") === undefined);
}

console.log(`\nالنتيجة: ${pass} ناجحة · ${fail} فاشلة`);
process.exit(fail ? 1 : 0);
