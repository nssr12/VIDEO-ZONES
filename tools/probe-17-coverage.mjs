// مِجَسّ تغطية §17 — **أيَّ خطوةٍ يستطيع الرِكاز قياسها؟ يُجرَّب ولا يُقدَّر.**
//
// ⚠️ **تشخيصيّ لا حارس** — لا يدخل التحقّق الأربعة. غايته **قسمة §17**: ما
// يُشغَّل آلياً وما يبقى لحكم إنسان.
// ⚠️ **ولا تُنقل خطوةٌ إلى الرِكاز لأنها تعذّرت على المالك** (قرار المالك):
// ما يقيسه الرِكاز يُقاس **لأنه يقيسه**، وما يحكم فيه إنسان يبقى له —
// **والخلط يُنتج «أخضر» عن شيءٍ لم يُحكم فيه.**
import { launch, openPage, configure, serveTestPage, evalIn, waitPortFree, killChrome } from "./ext-harness.mjs";

const PORT = 9771, HTTP = 8871;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const IDLE = 1000;
const R = [];
const rec = (id, what, state, note) => R.push({ id, what, state, note: note || "" });
// ⚠️ **كل خطوةٍ معزولة وتُعلن فشلَها في موضعها** — درس #80: رميةٌ في قسمٍ لا
// تقتل القسم كلَّه، **والعزل لا يبتلع** (قرار 46): السبب يُطبع مع الخطوة.
async function step(id, what, fn) {
  try { await fn(); }
  catch (e) { rec(id, what, "تعذّر", "استثناء في المِجَسّ: " + String(e?.message || e).slice(0, 70)); }
}

const S = (over = {}) => ({
  settings: {
    enabled: true, idle: { ms: IDLE },
    overlay: { autoHideMs: 900, volumeAutoHideMs: 900, enabled: true, hintEnabled: true,
      speedBadge: true, hideProgressBar: false, speedButton: true, speedButtonPreset: 2, ...over },
    zones: { enabled: true, fullscreenOnly: false,
      wheel: { map: { "4": { up: ["ACTION:SPEED:+0.25"], down: ["ACTION:SPEED:-0.25"] } } } }
  },
  globalSiteRules: { enabled: true, mappings: [] }
});

const mv = (c, x, y) => c.send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y, buttons: 0 });
async function wig(c, x, y, n = 3) { for (let i = 0; i < n; i++) { await mv(c, x + i % 2, y + (i + 1) % 2); await sleep(110); } }
async function clickAt(c, x, y, button = "left") {
  const b = button === "right" ? 2 : 1;
  await c.send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button, buttons: b, clickCount: 1 });
  await sleep(30);
  await c.send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button, buttons: 0, clickCount: 1 });
}
const wheelAt = (c, x, y, d) => c.send("Input.dispatchMouseEvent", { type: "mouseWheel", x, y, deltaX: 0, deltaY: d });
// ⚠️ **`rawKeyDown` لا يُنتج فعل الزرّ الافتراضيّ** — فـ`Enter` على زرٍّ مركَّز
// **لا يُنقره**، فيُطبع «الشرح لا يفتح» وهو يفتح. **عمى أداةٍ يُقرأ عطبَ منتَج**
// (قرار 49، الوجه الثاني). ⇒ `keyDown` مع `text` للمفاتيح ذات الأثر.
async function key(c, k, code, keyCode, text) {
  await c.send("Input.dispatchKeyEvent", {
    type: "keyDown", key: k, code, windowsVirtualKeyCode: keyCode,
    nativeVirtualKeyCode: keyCode, ...(text ? { text } : {}) });
  // ⚠️ **`char` للمطبوع وحده** — إرسالُه لـ`Tab` يكتب النصّ «Tab» ويُعلّق الحلقة
  if (text) await c.send("Input.dispatchKeyEvent", { type: "char", text, key: k });
  await c.send("Input.dispatchKeyEvent", { type: "keyUp", key: k, code, windowsVirtualKeyCode: keyCode });
}
const TAB = (c) => key(c, "Tab", "Tab", 9);
const SPACE = (c) => key(c, " ", "Space", 32, " ");
const ENTER = (c) => key(c, "Enter", "Enter", 13, "\r");
const ESC = (c) => key(c, "Escape", "Escape", 27);

// ── أ) صفحة الإعدادات — لا تحتاج فيديو، فأسرع وأثبت ─────────────────────────
async function optionsPart(h) {
  const id = h.extensionId;
  const c = await openPage(PORT, `chrome-extension://${id}/options.html`);
  // ⚠️ **بلا هذا لا تملك الصفحة تركيز النافذة في `--headless`** — فـ`focus()`
  // لا يُنقل و`Enter` لا يُفعّل زرّاً، **فيُطبع «لوحة المفاتيح لا تعمل» وهي تعمل**.
  await c.send("Emulation.setFocusEmulationEnabled", { enabled: true });
  await sleep(2500);

  // 25 — القسمان مرسومان، ولكلّ صفٍّ زرّ (!)
  const drawn = await evalIn(c, `(() => ({
    timing: document.querySelectorAll("#timingList input").length,
    clean: document.querySelectorAll("#cleanPlayerList input").length,
    help: document.querySelectorAll(".vzHelp").length,
    sliders: [...document.querySelectorAll("#timingList input[type=checkbox]")]
      .filter(e => getComputedStyle(e).appearance === "none").length
  }))()`);
  rec("25", "القسمان مرسومان ولكلٍّ زرّ (!)", drawn.timing === 8 && drawn.clean === 38 && drawn.help >= 46 ? "أخضر" : "أحمر",
      `توقيت=${drawn.timing} · تنظيف=${drawn.clean} · تلميح=${drawn.help} · منزلقة=${drawn.sliders}`);

  // 26 — الحالتان بلا لون: نمط الحدّ وموضع المِقبض
  const two = await evalIn(c, `(() => {
    const el = document.getElementById("hideProgressBar");
    const read = () => { const cs = getComputedStyle(el), af = getComputedStyle(el, "::after");
      return { border: cs.borderTopStyle, knob: af.insetInlineStart || af.left }; };
    el.checked = false; const off = read();
    el.checked = true;  const on  = read();
    el.checked = false;
    return { off, on };
  })()`);
  rec("26", "الفرق بلا لون: نمط الحدّ وموضع المِقبض",
      two.off.border !== two.on.border && two.off.knob !== two.on.knob ? "أخضر" : "أحمر",
      `مطفأ ${two.off.border}/${two.off.knob} · مُشغَّل ${two.on.border}/${two.on.knob}`);

  await step("27+27ب", "كتلة 27+27ب", async () => {
    // 27 — Tab يصل مفتاحاً والمسافة تُبدّله
    const t27 = await evalIn(c, `(() => { document.getElementById("timingList")
      .querySelector("input[type=checkbox]").focus();
      const el = document.activeElement; return { id: el.id, was: el.checked }; })()`);
    await SPACE(c); await sleep(250);
    const t27b = (await evalIn(c, `(() => { const el = document.getElementById(${JSON.stringify(t27?.id || "")});
      if (!el) return { err: "لا عنصر بهذا المعرّف: " + ${JSON.stringify(t27?.id || "")} };
      return { now: el.checked, focused: document.activeElement === el, tabIndexOk: el.tagName === "INPUT" }; })()`)) || { err: "لا جواب من التقييم" };
    if (t27b.err) { rec("27", "التركيز يصل مفتاحاً و`المسافة` تُبدّله", "تعذّر", t27b.err); return; }
    rec("27", "التركيز يصل مفتاحاً و`المسافة` تُبدّله",
        t27b.tabIndexOk && t27b.now !== t27.was ? "أخضر" : "أحمر",
        `${t27.id}: ${t27.was} ⇒ ${t27b.now} · عنصره ${t27b.tabIndexOk ? "input" : "ليس input"}`);
    // ⚠️ التنقّل بـTab نفسه: يُجرَّب صراحةً — كم ضغطةً حتى يصل مفتاحاً؟
    await evalIn(c, `document.body.focus()`);
    let hops = 0, reached = false;
    for (; hops < 40; hops++) {
      await TAB(c);
      const cur = await evalIn(c, `(() => { const a = document.activeElement;
        return { id: a?.id || "", inTiming: !!a?.closest?.("#timingList") }; })()`);
      if (cur.inTiming) { reached = true; break; }
    }
    rec("27ب", "و`Tab` نفسه يبلغ القسم", reached ? "أخضر" : "أحمر", reached ? `بعد ${hops + 1} ضغطة` : "لم يصل في 40");

  });

  await step("28", "كتلة 28", async () => {
    // 28 — زرّ (!) بـEnter · وEsc لا يُغلق · وضغطةٌ ثانية تُغلق · والتحويم يُظهر
    const h28 = await evalIn(c, `(() => { const b = document.querySelector("#timingList .vzHelp");
      b.focus(); return { id: b.getAttribute("aria-controls"), open: !document.getElementById(b.getAttribute("aria-controls")).hidden }; })()`);
    await ENTER(c); await sleep(200);
    const afterEnter = await evalIn(c, `!document.getElementById(${JSON.stringify(h28.id)}).hidden`);
    await ESC(c); await sleep(200);
    const afterEsc = await evalIn(c, `!document.getElementById(${JSON.stringify(h28.id)}).hidden`);
    await ENTER(c); await sleep(200);
    const afterAgain = await evalIn(c, `!document.getElementById(${JSON.stringify(h28.id)}).hidden`);
    rec("28", "زرّ (!) يفتح الشرح بـ`Enter`", afterEnter ? "أخضر" : "أحمر", `مفتوح=${afterEnter}`);
    rec("28ب", "و`Esc` لا يُغلقه (حدٌّ معروف)", afterEsc === true ? "أخضر" : "أحمر", `بقي مفتوحاً=${afterEsc}`);
    rec("28ج", "وضغطةٌ ثانية تُغلقه", afterAgain === false ? "أخضر" : "أحمر", `مفتوح=${afterAgain}`);
    const hov = await evalIn(c, `(() => { const b = [...document.querySelectorAll("#cleanPlayerList .vzHelp")][0];
      b.dispatchEvent(new MouseEvent("mouseenter", { bubbles: false }));
      return !document.getElementById(b.getAttribute("aria-controls")).hidden; })()`);
    rec("28د", "والتحويم يُظهره كذلك", hov ? "أخضر" : "أحمر", `ظهر=${hov}`);

  });

  await step("29", "كتلة 29", async () => {
    // 29 — الحالة الثالثة: معطَّل ≠ مطفأ
    const t29 = await evalIn(c, `(async () => {
      const vol = document.getElementById("volumeDuration");
      vol.value = "0"; vol.dispatchEvent(new Event("change", { bubbles: true }));
      await new Promise(r => setTimeout(r, 600));
      const el = document.getElementById("speedBadgeEnabled");
      const cs = getComputedStyle(el), af = getComputedStyle(el, "::after");
      const body = document.getElementById("help_speedBadgeEnabled");
      return { disabled: el.disabled, border: cs.borderTopStyle, knob: af.insetInlineStart || af.left,
               why: (body?.textContent || "").slice(0, 60) };
    })()`);
    rec("29", "الحالة الثالثة: معطَّل بحدٍّ منقّط ومِقبضٍ في الوسط",
        t29.disabled && t29.border === "dotted" ? "أخضر" : "أحمر",
        `معطَّل=${t29.disabled} · حدّ=${t29.border} · مِقبض=${t29.knob}`);
    rec("29ب", "وتلميحه يقول السبب", /صفر|مدّة/.test(t29.why) ? "أخضر" : "أحمر", `«${t29.why}»`);
    const t29c = await evalIn(c, `(async () => {
      const vol = document.getElementById("volumeDuration");
      vol.value = "900"; vol.dispatchEvent(new Event("change", { bubbles: true }));
      await new Promise(r => setTimeout(r, 600));
      return { disabled: document.getElementById("speedBadgeEnabled").disabled };
    })()`);
    rec("29ج", "ورفعُها فوق الصفر يُعيده قابلاً للتبديل", t29c.disabled === false ? "أخضر" : "أحمر",
        `معطَّل=${t29c.disabled}`);

  });

  await step("23", "كتلة 23", async () => {
    // 23/23ب/23ج — ثلاثة مربّعات، الأوسط يُلغى فيختفي من التخزين لا يصير false
    const t23 = await evalIn(c, `(async () => {
      const ids = ["cp_top_titles", "cp_top_share", "cp_top_info"];
      for (const i of ids) { const el = document.getElementById(i);
        if (!el.checked) { el.checked = true; el.dispatchEvent(new Event("change", { bubbles: true })); await new Promise(r=>setTimeout(r,250)); } }
      const mid = document.getElementById(ids[1]);
      mid.checked = false; mid.dispatchEvent(new Event("change", { bubbles: true }));
      await new Promise(r => setTimeout(r, 600));
      const d = await chrome.storage.sync.get({ settings: {} });
      const items = d.settings?.cleanPlayer?.items || {};
      return { keys: Object.keys(items), midPresent: "top_share" in items,
               others: !!items.top_titles && !!items.top_info };
    })()`);
    rec("23ج", "الملغى **يختفي** من التخزين لا يصير `false`",
        t23.others && t23.midPresent === false ? "أخضر" : "أحمر",
        `الآخران=${t23.others} · الملغى حاضر=${t23.midPresent}`);

  });

  await step("24", "كتلة 24", async () => {
    // 24/24ب — إطفاء المفتاح الرئيسي لا يهدم الاختيار
    const t24 = await evalIn(c, `(async () => {
      const m = document.getElementById("cleanPlayerEnabled");
      m.checked = false; m.dispatchEvent(new Event("change", { bubbles: true }));
      await new Promise(r => setTimeout(r, 600));
      const d = await chrome.storage.sync.get({ settings: {} });
      return { enabled: d.settings?.cleanPlayer?.enabled, kept: Object.keys(d.settings?.cleanPlayer?.items || {}).length };
    })()`);
    rec("24ب", "إطفاء المفتاح الرئيسي يُبقي المؤشَّرة مخزَّنة",
        t24.enabled === false && t24.kept >= 2 ? "أخضر" : "أحمر", `مُفعَّل=${t24.enabled} · محفوظة=${t24.kept}`);

  });

  await step("32", "كتلة 32", async () => {
    // 32 — عدّ الصفوف في كل مجموعة مقابل الأرقام المكتوبة
    const t32 = await evalIn(c, `(() => [...document.querySelectorAll("#cleanPlayerList .vzGroup")]
      .map(g => ({ name: g.querySelector("summary span")?.textContent || "?",
                   rows: g.querySelectorAll("input[type=checkbox]").length })))()`);
    const want = [7, 3, 13, 12, 3];
    const got = t32.map((g) => g.rows);
    rec("32", "عدّ الصفوف في كل مجموعة مقابل 7·3·13·12·3",
        JSON.stringify(got) === JSON.stringify(want) ? "أخضر" : "أحمر",
        `المقيس ${JSON.stringify(got)} · المجموع ${got.reduce((a, b) => a + b, 0)}`);

  });

  await step("30", "كتلة 30", async () => {
    // 30 — تبديلٌ ثمّ إعادة تحميل ⇒ الحالة محفوظة
    await evalIn(c, `(async () => { const el = document.getElementById("cp_cards");
      el.checked = true; el.dispatchEvent(new Event("change", { bubbles: true }));
      await new Promise(r => setTimeout(r, 600)); })()`);
    await c.send("Page.reload"); await sleep(2500);
    const t30 = await evalIn(c, `document.getElementById("cp_cards")?.checked`);
    rec("30", "تبديلٌ ثمّ إعادة تحميل ⇒ الحالة محفوظة", t30 === true ? "أخضر" : "أحمر", `مؤشَّر بعد التحميل=${t30}`);

  });

  try { c.ws.close(); } catch {}
}

// ── ب) الطبقة على صفحةٍ محلية — ما لم يغطّه `bench-overlay-layer` بعد ────────
async function layerPart(h, url) {
  const c = await openPage(PORT, url);
  await sleep(2800);
  const st = `(() => { const b = document.querySelector(".vzSpeedBtn"); const v = document.querySelector("video");
    const sp = document.querySelector(".vzSpeed");
    const r = b?.getBoundingClientRect();
    return { has: !!b, hidden: b?.classList.contains("vzHidden"),
      x: r ? Math.round(r.left + r.width/2) : 0, y: r ? Math.round(r.top + r.height/2) : 0,
      text: b?.textContent, rate: v?.playbackRate,
      badge: sp ? !sp.classList.contains("vzHidden") : null,
      vr: (() => { const q = v.getBoundingClientRect();
        return { x: Math.round(q.left), y: Math.round(q.top), w: Math.round(q.width), h: Math.round(q.height) }; })() }; })()`;
  const v0 = await evalIn(c, st);
  await wig(c, Math.round(v0.vr.x + v0.vr.w / 2), Math.round(v0.vr.y + v0.vr.h * 0.8));
  await sleep(400);
  let s1 = await evalIn(c, st);

  // 12 — حركةٌ صغيرة فوق الزرّ لا تُخفيه
  await wig(c, s1.x, s1.y, 4);
  await sleep(300);
  const s12 = await evalIn(c, st);
  rec("12", "حركةٌ فوق الزرّ لا تُخفيه", s12.hidden === false ? "أخضر" : "أحمر", `مخفيّ=${s12.hidden}`);

  // ⭐ 12ب — السؤال المفتوح: فأرةٌ ساكنة تماماً فوق الزرّ
  await sleep(IDLE * 3);
  const s12b = await evalIn(c, st);
  rec("12ب", "⭐ فأرةٌ ساكنة تماماً فوق الزرّ — **السؤال المفتوح**",
      "قِيس", `الزرّ ${s12b.hidden ? "**اختفى**" : "بقي ظاهراً"} بعد ${IDLE * 3}ms سكونٍ تامّ فوقه`);

  // 15ب — نقرتان: المفضّلة ثمّ العودة إلى 1x
  await wig(c, s1.x, s1.y, 2); await sleep(200);
  await clickAt(c, s1.x, s1.y); await sleep(400);
  const a1 = await evalIn(c, st);
  await clickAt(c, s1.x, s1.y); await sleep(400);
  const a2 = await evalIn(c, st);
  rec("15ب", "نقرةٌ ثانية تُعيد `1x`", a1.rate === 2 && a2.rate === 1 ? "أخضر" : "أحمر", `${v0.rate} ⇒ ${a1.rate} ⇒ ${a2.rate}`);

  // 16 / 16ب — القصّ عند 4x و0.25x
  await evalIn(c, `document.querySelector("video").playbackRate = 4`);
  await wig(c, s1.x, s1.y, 2);
  await wheelAt(c, s1.x, s1.y, -120); await sleep(400);
  const up = await evalIn(c, `document.querySelector("video").playbackRate`);
  await evalIn(c, `document.querySelector("video").playbackRate = 0.25`);
  await wig(c, s1.x, s1.y, 2);
  await wheelAt(c, s1.x, s1.y, 120); await sleep(400);
  const dn = await evalIn(c, `document.querySelector("video").playbackRate`);
  rec("16", "عند `4x` عجلةٌ لأعلى ⇒ يبقى `4x`", up === 4 ? "أخضر" : "أحمر", `⇒ ${up}`);
  rec("16ب", "وعند `0.25x` لأسفل ⇒ يبقى `0.25x`", dn === 0.25 ? "أخضر" : "أحمر", `⇒ ${dn}`);

  // 17 — الزرّ الثانويّ: لا شيء
  await evalIn(c, `document.querySelector("video").playbackRate = 1`);
  await wig(c, s1.x, s1.y, 2);
  const before17 = await evalIn(c, `document.querySelector("video").playbackRate`);
  await clickAt(c, s1.x, s1.y, "right"); await sleep(500);
  const after17 = await evalIn(c, `document.querySelector("video").playbackRate`);
  rec("17", "نقرة الزرّ الثانويّ: لا شيء يقع", before17 === after17 ? "أخضر" : "أحمر", `${before17} ⇒ ${after17}`);

  // 18 — شارة السرعة تظهر مع تغييرها بالزرّ
  await wig(c, s1.x, s1.y, 2);
  await clickAt(c, s1.x, s1.y); await sleep(250);
  const b18 = await evalIn(c, `(() => { const sp = document.querySelector(".vzSpeed");
    return sp ? { shown: !sp.classList.contains("vzHidden"), text: sp.textContent } : null; })()`);
  rec("18", "شارة السرعة تظهر مع تغييرها بالزرّ",
      b18?.shown ? "أخضر" : "أحمر", b18 ? `ظاهرة=${b18.shown} · «${b18.text}»` : "لا عنصر");

  // 9/19ب — ملء الشاشة: يُجرَّب صراحةً ولا يُقدَّر
  const fs = await evalIn(c, `(async () => {
    try { await document.querySelector("video").parentElement.requestFullscreen(); }
    catch (e) { return { ok: false, why: String(e?.message || e).slice(0, 60) }; }
    await new Promise(r => setTimeout(r, 600));
    return { ok: !!document.fullscreenElement, el: document.fullscreenElement?.tagName || null };
  })()`);
  rec("9/19ب", "ملء الشاشة داخل الرِكاز", fs?.ok ? "أخضر" : "تعذّر",
      fs?.ok ? `العنصر ${fs.el}` : `طلبُ ملء الشاشة يحتاج إيماءةَ مستخدمٍ موثوقة — ${fs?.why || "لم يدخل"}`);

  try { c.ws.close(); } catch {}
}

// ── التشغيل ─────────────────────────────────────────────────────────────────
const srv = await serveTestPage(HTTP);
let h = await launch(PORT);
try {
  await configure(PORT, h.extensionId, S());
  await optionsPart(h);
  await layerPart(h, srv.url);
} catch (e) {
  console.log("⚠️ توقّف المِجَسّ: " + String(e?.message || e).slice(0, 160));
} finally {
  killChrome(h); await waitPortFree(PORT); try { srv.srv.close(); } catch {}
}

console.log("\n=== تغطية §17 بالرِكاز — جُرّبت ولم تُقدَّر ===\n");
const pad = (s, n) => String(s) + " ".repeat(Math.max(0, n - String(s).length));
for (const r of R) {
  const mark = r.state === "أخضر" ? "✅" : r.state === "أحمر" ? "❌" : r.state === "قِيس" ? "🔵" : "⚪";
  console.log(`${mark} ${pad(r.id, 7)} ${pad(r.what, 52)} ${r.note}`);
}
const g = R.filter((x) => x.state === "أخضر").length;
const b = R.filter((x) => x.state === "أحمر").length;
const n = R.filter((x) => x.state === "تعذّر").length;
console.log(`\n⇒ أخضر ${g} · أحمر ${b} · تعذّر ${n} · مقيسٌ بلا حكم ${R.length - g - b - n}\n`);
