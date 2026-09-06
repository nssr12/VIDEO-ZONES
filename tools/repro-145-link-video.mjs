// البند #145 — أزرارُ الفأرة فوق فيديو داخل رابط (خلاصةُ إنستقرام).
//
// ⭐ **السؤال الذي يجيبه (بلغة المستخدم):** *«إن ربطتُ الزرَّ الأوسط أو الأيمن
// بأمر، أيقع أمري على فيديو الخلاصة — أم يفتح المتصفّحُ تبويباً وقائمةً؟»*
//
// ⛔ **خارج البوّابة — وسببُ تأجيله هو (لا سببُ مجموعته):** ستُّ حالاتٍ وستُّ
// تشغيلاتٍ لكرومَ كاملٍ بإضافةٍ محمَّلة، وكلُّ حالةٍ تنتظر فيديو يستقرّ ثمّ
// 1.5 ثانيةٍ بعد النقرة — دقائقُ في بوّابةٍ تُشغَّل قبل كلّ كومِت. ⛔ **ولا شبكةَ
// فيه ولا مضيفٌ حيّ**: الصفحاتُ محلّيّةٌ كلُّها، فتأجيلُه ثمنُ زمنٍ لا هشاشة.
//
// ⭐⭐ **والمتغيّرُ واحدٌ لا غير: موضعُ الرابط من الفيديو.** الصفحاتُ الثلاث
// متطابقةٌ حرفاً بحرف إلا موضعَ `<a href>`: غائبٌ · **يلفّ** · **مرسومٌ فوقه**.
// **والثالثةُ ليست تخيّلاً**: هي شكلُ بطاقةِ نهايةِ يوتيوب، مقيسٌ في لقطة
// `tools/snapshots` — **19 رابطاً داخل `#movie_player` وصفرٌ منها يلفّ الفيديو**
// ⇒ فامتناعُنا فيها **شرطُ قبولٍ لا أثرٌ جانبيّ**، وهو ما يحفظ يوتيوب.
//
// ⚠️ **والأمرُ المقيس `ACTION:VOLUME:+10` لا `TOGGLE_FULLSCREEN`** — عمداً:
// أمرٌ **ينجح دائماً** فتُنفَّذ `preventDefault` بعده، **فيُعزل السؤال**: أوصل
// الحدثُ إلينا فأمسكناه، أم تركناه للمتصفّح؟ وملءُ الشاشة يخلط سؤالَ الإيماءة.
import { launch, openPage, evalIn, configure, serveTestPage, killChrome, refuseUnknownFlags } from "./ext-harness.mjs";

refuseUnknownFlags([]);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ثلاثُ هيئاتٍ للصفحة، والفرقُ بينها بنيويٌّ لا شكليّ:
//   plain — لا رابطَ إطلاقاً
//   wrap  — رابطٌ **يلفّ** الفيديو (غلافُ منشورٍ في خلاصة إنستقرام)
//   over  — رابطٌ **مرسومٌ فوقه** ولا يلفّه (شكلُ بطاقةِ نهايةِ يوتيوب،
//           `ytp-ce-covering-overlay` و`ytp-modern-videowall-still` —
//           **مقيسٌ في لقطة `tools/snapshots`: 19 رابطاً وصفرٌ يلفّ**)
const page = (shape) => `<!doctype html><meta charset="utf-8">
<body style="margin:0;background:#111;height:2200px">
<div style="position:relative;width:640px;height:360px">
${shape === "wrap" ? '<a id="lnk" href="/opened-by-mouse" style="display:block">' : ""}
<video id="v" width="640" height="360" src="/tone.wav" loop muted playsinline style="display:block"></video>
${shape === "wrap" ? "</a>" : ""}
${shape === "over" ? '<a id="lnk" href="/opened-by-mouse" style="position:absolute;inset:0;display:block"></a>' : ""}
</div>
<script>
window.__r = { ctx: null, aux: null };
// مستمعان في طور **الفقاعة** على المستند: إن حجبنا الحدث لم يصلا أصلاً،
// وإن وصلا قالا أَأُلغي الافتراضيُّ أم لا. والغيابُ نفسُه خبر.
addEventListener("contextmenu", (e) => { window.__r.ctx = { fired: true, prevented: e.defaultPrevented }; });
addEventListener("auxclick",    (e) => { window.__r.aux = { fired: true, prevented: e.defaultPrevented }; });
<\/script></body>`;

const READ = `(() => { const v = document.querySelector("video");
  const a = document.querySelector("a[href]");
  return { vol: Math.round(v.volume * 100) / 100, ctx: window.__r.ctx, aux: window.__r.aux,
           wraps: !!(a && a.contains(v)) }; })()`;

const cfg = (from, to) => ({
  globalSiteRules: { enabled: true, mappings: [{ from, to }] },
  settings: { enabled: true, blockedHosts: [], zones: { enabled: false } },
});

async function targets(port) {
  try { return (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).filter((t) => t.type === "page").length; }
  catch { return null; }
}

// `want` هو الحكمُ المنتظَر: أيقع أمرُنا أم نمتنع عمداً؟
const CASES = [
  { key: "m2_plain", label: "Mouse2 · لا رابطَ (شاهد موجب)",              shape: "plain", from: "Mouse2", button: "middle", want: true },
  { key: "m2_wrap",  label: "Mouse2 · رابطٌ **يلفّ** الفيديو (إنستقرام)",  shape: "wrap",  from: "Mouse2", button: "middle", want: true },
  { key: "m2_over",  label: "Mouse2 · رابطٌ **فوق** الفيديو (يوتيوب) ⇒ نمتنع", shape: "over", from: "Mouse2", button: "middle", want: false },
  { key: "m3_plain", label: "Mouse3 · لا رابطَ (شاهد موجب)",              shape: "plain", from: "Mouse3", button: "right",  want: true },
  { key: "m3_wrap",  label: "Mouse3 · رابطٌ **يلفّ** الفيديو (إنستقرام)",  shape: "wrap",  from: "Mouse3", button: "right",  want: true },
  { key: "m3_over",  label: "Mouse3 · رابطٌ **فوق** الفيديو (يوتيوب) ⇒ نمتنع", shape: "over", from: "Mouse3", button: "right",  want: false },
];

async function run(c, port) {
  const out = { key: c.key, label: c.label, want: c.want };
  let h = null, p = null, srv = null;
  try {
    h = await launch(port, { extra: ["--window-size=1400,900"] });
    const w = await configure(port, h.extensionId, cfg(c.from, "ACTION:VOLUME:+10"));
    if (!w.ok) { out.skipped = "تعذّر الضبط: " + (w.why || w.error); return out; }
    const s = await serveTestPage(port + 900, page(c.shape)); srv = s.srv;
    p = await openPage(port, s.url);
    let ready = null;
    for (let i = 0; i < 40 && !ready; i++) {
      ready = await evalIn(p, `(() => { const v = document.querySelector("video");
        if (!v) return null; const b = v.getBoundingClientRect();
        if (!(b.width > 0 && b.height > 0)) return null;
        if (v.paused) { v.play().catch(()=>{}); return null; }
        if (v.readyState < 2) return null;
        v.volume = 0.5; v.muted = false;
        return { x: Math.round(b.left + b.width/2), y: Math.round(b.top + b.height/2) }; })()`);
      if (!ready) await sleep(400);
    }
    if (!ready) { out.skipped = "لم يستقرّ فيديو شغّال — لا يُقرأ منه حكم (قرار 22)"; return out; }
    out.before = await evalIn(p, READ);
    out.tabsBefore = await targets(port);
    await p.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: ready.x, y: ready.y, button: "none" });
    await sleep(180);
    await p.send("Input.dispatchMouseEvent", { type: "mousePressed", x: ready.x, y: ready.y, button: c.button, clickCount: 1 });
    await p.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: ready.x, y: ready.y, button: c.button, clickCount: 1 });
    await sleep(1500);
    out.after = await evalIn(p, READ);
    out.tabsAfter = await targets(port);
  } catch (e) { out.skipped = String(e?.message || e).slice(0, 90); }
  finally { try { p?.ws?.close(); } catch {} try { h?.browser?.ws?.close(); } catch {} killChrome(h); try { srv?.close(); } catch {} }
  return out;
}

const rows = [];
for (const [i, c] of CASES.entries()) rows.push(await run(c, 9440 + i * 3));

console.log("\n# #145 — أزرارُ الفأرة فوق فيديو داخل رابط\n");
let bad = 0;
for (const r of rows) {
  if (r.skipped) { console.log(`⏭️  ${r.label} — ${r.skipped}`); bad++; continue; }
  const acted = r.after.vol !== r.before.vol;
  const newTab = r.tabsAfter > r.tabsBefore;
  const ev = r.key.startsWith("m3") ? r.after.ctx : r.after.aux;
  const evTxt = !ev ? "**لم يصل** (حُجب)" : ev.prevented ? "وصل و**أُلغي** افتراضيُّه" : "وصل و**لم يُلغَ**";
  // الحكمُ مطابقةُ المنتظَر لا «وقع الأمر»: **الامتناعُ في شكل يوتيوب نجاحٌ لا فشل**
  const ok = acted === r.want;
  // وفي الحالِ الموجبة يُشترط ألّا يُفتح تبويب: أمرٌ وقع وتبويبٌ فُتح معه = نصفُ إصلاح
  const ok2 = !r.want || !newTab;
  console.log(`${ok && ok2 ? "✅" : "❌"} ${r.label}`);
  console.log(`     أمرُنا: ${r.before.vol} ⇒ ${r.after.vol} ${acted ? "(وقع)" : "(لم يقع)"} · المنتظَر: ${r.want ? "يقع" : "**نمتنع**"} · ` +
              `تبويب: ${r.tabsBefore}⇒${r.tabsAfter}${newTab ? " **فُتح**" : ""} · ` +
              `الحدث: ${evTxt} · الرابطُ يلفّ: ${r.after.wraps}`);
  if (!(ok && ok2)) bad++;
}
console.log(`\n⇒ **حالاتٌ خالفت المنتظَر: ${bad}**\n`);
process.exit(bad ? 1 : 0);
