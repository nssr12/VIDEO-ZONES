// #112 — **الموضعُ الواحد لاختيار اللقطة وقراءة شروط إعادة تشغيلها.**
//
// ⭐ **السؤال الذي يجيبه (بلغة المستخدم):** *«الرِكازُ الذي يقول «الأزرار سليمة» —
// أيقيس على الحال التي يعنيها، أم على لقطةٍ أخرى وقعت في يده؟»*
//
// ── ⛔⭐⭐ العلّتان اللتان وُلد منهما، وكلتاهما مقيسةٌ 2026-08-07 ─────────────
//
// **(١) الرِكازُ كان يختار لقطتَه بترتيب الأسماء لا بالحال التي يعنيها.**
// `readdirSync(...).sort().pop()` — **ويومَ وُلدت لقطةٌ ثانية انقلب الاختيار في
// ثلاثة رِكازات في لحظةٍ واحدة، بلا أن يُمسّ سطرٌ فيها**: `bench-112-host-snapshot`
// و`bench-112-idle-snapshot` صارا يقرآن شجرةَ ملء الشاشة (**بلا أنماط**)، و
// `snapshot-freshness` صار يقارن حالَ ملء الشاشة بصفحةِ نافذة.
// ⇒ ⭐⭐ **وخمسُ خطواتٍ رُفعت عن المالك (`م1` · `م2` · `م3` · `م4` · `م22`) ومعها
// `م19` صارت تُقاس على شجرةٍ ليست شجرتَها** — **والقائمةُ تقول «انتقلت إلى
// الآليّ»، والآليُّ لا يقيسها.** ⇒ **وهو «شاهدٌ لا يُشغَّل شاهدٌ لا وجود له» في
// صورته الأخبث: الشاهدُ يُشغَّل ويطبع، ويقيس غيرَ ما يدّعي.**
// ⇒ **فالحالُ تُطلَب بالاسم، والملفُّ يُشتقّ منها — ولا يُشتقّ الاسمُ من الملفّ.**
//
// **(٢) وشروطُ إعادة التشغيل لم تكن مسجَّلةً أصلاً، فكان الرِكازُ يخمّنها.**
// **اللقطةُ تُجمّد خرْجَ سكربتِ المضيف** (`style` الفيديو بعينه)، **وذاك الخرْجُ
// صحيحٌ في منظورٍ واحد لا في كلّ منظور.** ⇒ **ومنظورُ اللقطة جزءٌ من الحال
// المُلتقَطة لا ظرفٌ حولها**، **وكذلك أن تكون في ملء الشاشة.**
// ⛔ **ولا يُثبَّت رقمٌ في رِكازٍ ولو كان الصحيح**: العلّةُ نفسُها تُنبئ بما سيقع —
// **لقطةٌ ثالثة بمقاسٍ ثالث تُعيد الصورةَ بحرفها.**
//
// ⇒ ⭐⭐ **فالجامع بينهما واحد: الرِكازُ كان يعرف عن لقطته أقلَّ ممّا يحتاج، فخمّن
// الباقي — مرّةً أيَّ لقطةٍ يقرأ، ومرّةً بأيّ شروطٍ يقرؤها.**
//
// ⚠️ **وحدُّ هذا الملفّ: يختار ويقرأ ويؤلّف — ولا يلمس متصفّحاً.** إنتاجُ الشروط
// في المتصفّح هو `applyReplay` في `ext-harness.mjs`، **ولا نسخةَ منها في رِكاز.**
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const SNAP_DIR = path.join(ROOT, "tools", "snapshots");

// أسماءُ الحالات — **تُطلَب بها اللقطات، ولا يُكتب اسمُ ملفٍّ في رِكاز**
export const STATE_WINDOW = "watch-controls-visible-signed-out-ar";
export const STATE_FULLSCREEN = "watch-fullscreen-controls-visible-signed-out-ar";

function readAll(dir = SNAP_DIR) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => f.endsWith(".meta.json")).map((m) => {
    const meta = JSON.parse(fs.readFileSync(path.join(dir, m), "utf8"));
    return { metaFile: m, file: m.replace(/\.meta\.json$/, ".xhtml"), meta };
  }).filter((s) => fs.existsSync(path.join(dir, s.file)));
}

export function listSnapshots(dir = SNAP_DIR) { return readAll(dir); }

// ⛔ **الرفضُ يقول ماذا طُلب وماذا وُجد** — **«لا لقطة» و«لقطةٌ أخرى» رفضان
// مختلفان، وبلاغٌ واحدٌ لهما يُرسل القارئَ إلى الطريق الخطأ.**
export function loadSnapshot(state, dir = SNAP_DIR) {
  const all = readAll(dir);
  const mine = all.filter((s) => s.meta.state === state);
  if (!mine.length) {
    throw new Error(`لا لقطةَ للحال \`${state}\` — الموجود: ` +
      (all.map((s) => s.meta.state).join(" · ") || "لا شيء") +
      `\n   تُلتقط بـ: node tools/capture-yt-snapshot.mjs` +
      (state === STATE_FULLSCREEN ? " --fullscreen" : ""));
  }
  // **تجديدُ لقطةٍ يكتب ملفّاً بتاريخٍ جديد ولا يحذف السابق** ⇒ فالأحدثُ بتاريخه،
  // ⛔ **وتعادلُ تاريخين يُرفض ولا يُحسم بالاسم**: «أيُّهما أحدث؟» بلا جوابٍ لا
  // يُجاب بترتيبٍ أبجديّ — **وذاك أصلُ العلّة (١) بعينه.**
  const sorted = mine.slice().sort((a, b) => String(a.meta.capturedAt).localeCompare(String(b.meta.capturedAt)));
  const top = sorted[sorted.length - 1];
  if (sorted.length > 1 && sorted[sorted.length - 2].meta.capturedAt === top.meta.capturedAt) {
    throw new Error(`لقطتان للحال \`${state}\` بتاريخٍ واحد (${top.meta.capturedAt}) — ` +
      `احذف القديمة: ${sorted.map((s) => s.file).join(" · ")}`);
  }
  const html = fs.readFileSync(path.join(dir, top.file), "utf8");
  return { ...top, html, replay: replayOf(top.meta, top.file) };
}

// ── شروطُ إعادة التشغيل — **تُقرأ ولا تُخمَّن، والغيابُ رفضٌ لا افتراض** ──────
export function replayOf(meta, file = "") {
  const r = meta && meta.replay;
  const v = r && r.viewport;
  if (!v || !(v.w > 0) || !(v.h > 0)) {
    throw new Error(`لا منظورَ في ترويسة \`${file}\` — **ولا يُقاس على لقطةٍ لا تقول ` +
      `بأيّ مقاسٍ التُقطت**: خرْجُ سكربت المضيف مُجمَّدٌ فيها، وهو صحيحٌ في منظورها وحدَه.\n` +
      `   يُسجَّل عند الالتقاط (\`meta.replay\`) — أعِد الالتقاط أو أضِفه بقياس.`);
  }
  return { viewport: { w: v.w, h: v.h },
           fullscreenSelector: r.fullscreenSelector || null,
           سند: r.سند || "(بلا سند)" };
}

// ── تأليفُ شجرةٍ من لقطةٍ وأنماطٍ من أخرى ────────────────────────────────────
// ⭐ **وشرطُ الدمج قِيس ولم يُفترض** (2026-08-07): **بصمةُ الأنماط في الحالين
// واحدة** — `18f59329260261f8` · **4,400,548 بايت** — من الصفحة والبناء نفسِهما.
// ⇒ **فشجرةُ ملء الشاشة تُحفظ بلا أنماط: 653KB لا 5MB.** ⛔ **ولو اختلفت لَوقف البناء.**
export function cssBlockOf(html) {
  const a = html.indexOf("<style data-vz-snapshot-css");
  if (a < 0) throw new Error("لا كتلةَ أنماطٍ في اللقطة المانحة");
  const open = html.indexOf(">", a) + 1, close = html.indexOf("</style>", open);
  if (close < 0) throw new Error("كتلةُ الأنماط غيرُ مغلقة في اللقطة المانحة");
  return { text: html.slice(open, close), sheets: /data-vz-snapshot-css="(\d+)"/.exec(html)?.[1] || "0" };
}

// ⚠️ **يُملأ العنصرُ الفارغ ولا يُضاف ثانٍ** — **و`querySelector` تُرجع الأوّل**،
// فعنصرٌ فارغٌ سابقٌ يجعل المِجَسَّ يقرأ صفراً ويقول «لا أنماط» **وهي محقونة**.
export function mergeCss(treeHtml, donorHtml, donorFile) {
  const css = cssBlockOf(donorHtml);
  const text = css.text.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  const tag = `<style data-vz-snapshot-css="${css.sheets}" data-vz-from="${donorFile}">${text}</style>`;
  const EMPTY = /<style data-vz-snapshot-css="0"><\/style>/;
  const out = EMPTY.test(treeHtml) ? treeHtml.replace(EMPTY, tag)
                                   : treeHtml.replace("</head>", tag + "</head>");
  if (out === treeHtml) throw new Error("لم تُحقَن الأنماطُ — ولا يُقاس على شجرةٍ بلا أنماط");
  return out;
}

// ── ⭐⭐ خرْجُ المضيف مُجمَّداً: `style` الفيديو الذي كتبه سكربتُه لحظةَ الالتقاط ──
// **وهو المرجعُ الذي يُحكم به على إعادة التشغيل**: إن وافقه المستطيلُ الحيّ فقد
// أُعيدت الحالُ، **وإن خالفه فنحن نقيس تخطيطاً آخر ونسمّيه باسمها.**
// ⇒ **ولا يُصدَّق رقمٌ في `replay` بذاته: يُعاد التحقّق منه في كلّ تشغيلة** —
// **فرقمٌ يُكتب بيدٍ ويُحرَس في كلّ تشغيلة لا يتخلّف صامتاً.**
export function frozenVideoBox(html) {
  const tag = /<video[^>]*>/.exec(html);
  if (!tag) return null;
  const style = /style="([^"]*)"/.exec(tag[0]);
  if (!style) return null;
  const num = (k) => { const m = new RegExp(k + ":\\s*(-?[\\d.]+)px").exec(style[1]); return m ? Math.round(parseFloat(m[1])) : null; };
  const box = { w: num("width"), h: num("height"), left: num("left"), top: num("top") };
  return Object.values(box).every((n) => n !== null) ? box : null;
}

// ── المِجَسّ المشترك للمراسي — **يُقرأ قبل أن يُقاس شيء** (شرط المالك) ────────
// ⚠️ **«موجود» ليس «داخل المنظور»**: عنصرٌ خارج المنظور يُبنى ويُقاس ويُقرأ حكمُه
// امتناعاً — **فلا طبقةَ لنا فوقه ولا زرَّ يُحقن**، **وصفرُه «لم أره» لا «لم يقع»**
// (الشاهد الأوّل في قرار 26). ⇒ **فيُشترط المستطيلُ داخل النافذة لا وجودُه.**
// ⚠️ **و`left`/`top` المُجمَّدتان منسوبتان إلى الكتلة الحاوية للفيديو**
// (`.html5-video-container`) **لا إلى المنظور** — **فتُطرح إحداثيّاتُها قبل
// المقارنة.** ⛔ **وأوّلُ صياغةٍ قارنت بالمطلق فاحمرّت على منتَجٍ سليم**
// (`left=464` مقابل `0`): **صادفت الصفرَ في حال ملء الشاشة لأن الحاوية عند
// `0,0` هناك** ⇒ **شرطٌ صحّ في حالٍ واحدة بالمصادفة، وهو ما تكشفه الحالُ الثانية.**
export const REPLAY_ANCHORS = `(() => {
  const v = document.querySelector("video");
  const r = v ? v.getBoundingClientRect() : null;
  const host = document.querySelector(".html5-video-container") || document.querySelector("#movie_player");
  const hr = host ? host.getBoundingClientRect() : null;
  const fe = document.fullscreenElement;
  return { منظور: { w: innerWidth, h: innerHeight },
           ملءُ_الشاشة: fe ? (fe.id ? "#" + fe.id : fe.tagName.toLowerCase()) : null,
           فيديو: r ? { w: Math.round(r.width), h: Math.round(r.height),
                        left: Math.round(r.left - (hr ? hr.left : 0)),
                        top: Math.round(r.top - (hr ? hr.top : 0)) } : null,
           مطلقٌ: r ? { left: Math.round(r.left), top: Math.round(r.top) } : null,
           داخلَ_المنظور: !!(r && r.left >= 0 && r.top >= 0 &&
                             r.right <= innerWidth && r.bottom <= innerHeight &&
                             r.width > 0 && r.height > 0) }; })()`;
