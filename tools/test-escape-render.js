// البند #32 — قيمة قادمة من التخزين لا تُبنى قالباً نصّياً.
//
// ⭐ **السؤال الذي يجيبه (بلغة المستخدم):** *«هل يظهر اسمُ موقعٍ فيه «<» كما كتبتُه، أم يكسر صفحة الإعدادات؟»*
//
// حارسان لا واحد:
// **[أ] بنيويّ** — كل تعيين `innerHTML` في `popup.js` و`options.js` يجب أن يكون
// **نصّاً ثابتاً** بلا `${` وبلا ضمّ متغيّر. فالخطأ يصير **مستحيلاً بموضع واحد**
// بدل أن يُحصى في قائمة مواضع تُفلت ما يُضاف بعدها (قرار 16ج).
// **[ب] سلوكيّ** — تُشغَّل دوالّ العرض الحقيقية على DOM مزيّف بقيم عدائية،
// ويُشترط أن تصل القيمة **كما هي** إلى `value`/`textContent` بلا هروب وبلا عنصر
// وُلد منها. والحارس البنيويّ وحده لا يكفي: ملفّ بلا `innerHTML` إطلاقاً يمرّ به
// وهو لا يعرض شيئاً.
const fs = require("fs");
const vm = require("vm");

function slice(file, from, to) {
  const t = fs.readFileSync(file, "utf8");
  const a = t.indexOf(from), b = t.indexOf(to, a);
  if (a === -1 || b === -1) throw new Error(`تعذّر استخراج ${from} من ${file}`);
  return t.slice(a, b);
}

let pass = 0, fail = 0;
const check = (n, c, x) => c ? (pass++, console.log("  ✅ " + n))
                             : (fail++, console.log("  ❌ " + n, x ?? ""));

// ── [أ] الحارس البنيويّ ──────────────────────────────────────────────────────
// يُرجع كل تعيين innerHTML في ملف: { ok, raw } — و ok=false لكل ما ليس نصّاً ثابتاً.
function innerHtmlAssignments(file) {
  const src = fs.readFileSync(file, "utf8");
  const out = [];
  const marker = ".innerHTML";
  let at = 0;
  while ((at = src.indexOf(marker, at)) !== -1) {
    const head = at;
    at += marker.length;
    let i = at;
    while (i < src.length && /\s/.test(src[i])) i++;
    if (src[i] !== "=" || src[i + 1] === "=") continue;      // قراءة لا كتابة
    i++;
    while (i < src.length && /\s/.test(src[i])) i++;

    const quote = src[i];
    const line = src.slice(0, head).split("\n").length;
    if (quote !== '"' && quote !== "'" && quote !== "`") {
      out.push({ ok: false, line, raw: src.slice(head, head + 60), why: "ليس نصّاً حرفياً" });
      continue;
    }

    let interpolated = false, j = i + 1;
    for (; j < src.length; j++) {
      if (src[j] === "\\") { j++; continue; }
      if (src[j] === quote) break;
      if (quote === "`" && src[j] === "$" && src[j + 1] === "{") interpolated = true;
    }
    const literal = src.slice(i, j + 1);

    // ضمّ بعد النصّ الثابت (`"x" + v`) خطر كالإقحام
    let k = j + 1;
    while (k < src.length && /\s/.test(src[k])) k++;
    const concatenated = src[k] === "+";

    out.push({
      ok: !interpolated && !concatenated,
      line, raw: literal.slice(0, 60),
      why: interpolated ? "فيه ${…}" : concatenated ? "مضموم بمتغيّر" : ""
    });
    at = j + 1;
  }
  return out;
}

// ── DOM مزيّف ────────────────────────────────────────────────────────────────
// `innerHTML` فيه يقبل التفريغ بـ"" ويرمي على أي بناء بنصّ: فحتى لو أفلت موضعٌ
// من الحارس البنيويّ، **الرِكاز يراه** بدل أن يمرّ صامتاً.
function makeDoc() {
  const node = (tag) => ({
    tagName: String(tag).toUpperCase(),
    className: "", title: "", type: "", value: "",
    dataset: {}, kids: [], own: "",
    style: {},
    set innerHTML(v) {
      if (String(v) !== "") throw new Error(`innerHTML ببناء نصّي: ${v}`);
      this.kids.length = 0; this.own = "";
    },
    get innerHTML() { return ""; },
    set textContent(v) { this.own = String(v); this.kids.length = 0; },
    get textContent() {
      return this.own + this.kids.map((k) => (typeof k === "string" ? k : k.textContent)).join("");
    },
    appendChild(c) { this.kids.push(c); return c; },
    append(...cs) { this.kids.push(...cs); },
    addEventListener() {},
    querySelectorAll() { return []; },
    remove() {}
  });
  return { createElement: node, createTextNode: (t) => String(t) };
}

// المراسي تُقرأ عند الحاجة لا عند التحميل: مرساةٌ ساقطة تُحمِّر **تأكيداً باسمها**
// ولا تقتل بقية الملف، فيُعرف أسقط الكودُ أم سقطت المرساة (قرار 33). والحارس
// البنيويّ في [1] بلا مرساة أصلاً، فيقيس حتى حين تسقط كلها.
function anchored(name, take) {
  try { return take(); }
  catch (err) { check(`المرساة «${name}» قائمة`, false, err.message); return null; }
}

const POPUP = () => anchored("ruleRow/renderSiteList", () =>
  slice("popup.js", "function ruleRow", "function fillActionPreset")
  + slice("popup.js", "function renderSiteList", "async function loadSiteProfile"));
const GRID = () => anchored("actionLine/renderGrid", () =>
  slice("options.js", "function actionLine", "function renderBlockedSites"));

// قيم عدائية: وسم كامل · كِيان · مُحدِّد سمة · و«&» التي كانت تمرّ من الهروب اليدويّ
const NASTY = '<img src=x onerror="boom()"> & "قوس" \'مفرد\' <b>غامق</b> &amp;';

(() => {
  console.log("\n[1] الحارس البنيويّ: لا innerHTML إلا بنصّ ثابت");
  for (const f of ["popup.js", "options.js"]) {
    const all = innerHtmlAssignments(f);
    const bad = all.filter((a) => !a.ok);
    check(`${f}: وُجدت تعيينات فعلاً (الحارس ليس أعمى)`, all.length > 0, all.length);
    // ⚠️ فشل هذا التأكيد يعني أن قالباً نصّياً عاد إلى مسار عرض — ابنِ عناصر،
    // لا تُهرّب النصّ ولا تُعدّل هذا التأكيد.
    check(`${f}: كلها نصوص ثابتة`, bad.length === 0, bad);
  }

  // شاهد موجب للحارس نفسه: سطر مُفتعَل يجب أن يُرفض، وإلا فالقارئ لا يرى.
  {
    // ⚠️ **البند #74 — الاسم فريدٌ لكل عملية، والحذف في `finally`.** كان المسار
    // ثابتاً (`vz-inner-html-witness.js`)، فتشغيلتان متزامنتان تتصادمان على ملفٍّ
    // واحد: إحداهما تحذفه والأخرى تقرأه ⇒ **انهيارٌ أو تأكيدان كاذبان**، ولا
    // علاقة لأيٍّ منهما بالكود المُختبَر. **وأحمرُ الحظّ يُعلّم القارئ إعادة
    // التشغيل بدل الفحص** (قرار 20، ومن عائلة #73).
    const tmp = `${require("os").tmpdir()}/vz-inner-html-witness-${process.pid}.js`;
    let seen;
    try {
      fs.writeFileSync(tmp, 'const v = "x";\nel.innerHTML = `<b>${v}</b>`;\nother.innerHTML = "ثابت" + v;\n');
      seen = innerHtmlAssignments(tmp);
    } finally {
      try { fs.unlinkSync(tmp); } catch {}
    }
    check("شاهد موجب: يرى الإقحام", seen.some((a) => !a.ok && a.why === "فيه ${…}"), seen);
    check("شاهد موجب: يرى الضمّ", seen.some((a) => !a.ok && a.why === "مضموم بمتغيّر"), seen);
  }

  console.log("\n[2] صفّ القاعدة في الـ popup: القيمة تصل كما هي");
  (() => {
    const list = makeDoc().createElement("div");
    const ctx = {
      document: makeDoc(), console,
      $: (id) => (id === "list" || id === "siteList" ? list : null),
      mappings: [{ from: NASTY, to: "ACTION:SEEK:+5" }],
      siteMappings: [],
      saveGlobalData: () => Promise.resolve(),
      saveSiteProfile: () => Promise.resolve()
    };
    const src = POPUP();
    if (!src) return;
    vm.createContext(ctx);
    vm.runInContext(src, ctx);
    ctx.renderList();

    const row = list.kids[0];
    check("صفّ واحد", list.kids.length === 1, list.kids.length);
    check("ثلاثة عناصر لا أكثر", row?.kids.length === 3, row?.kids.length);
    check("القيمة العدائية وصلت حرفياً", row?.kids[0]?.value === NASTY, row?.kids[0]?.value);
    check("بلا هروب &quot;", !/&quot;/.test(row?.kids[0]?.value || ""), row?.kids[0]?.value);
    check("لم يُولَد عنصر من النصّ",
      row?.kids.every((k) => ["INPUT", "BUTTON"].includes(k.tagName)), row?.kids.map((k) => k.tagName));
    check("زرّ الحذف يحمل فهرسه", row?.kids[2]?.dataset?.del === "0", row?.kids[2]?.dataset);
    check("والحقلان موسومان", row?.kids[0]?.dataset?.k === "from" && row?.kids[1]?.dataset?.k === "to",
      [row?.kids[0]?.dataset, row?.kids[1]?.dataset]);
  })();

  console.log("\n[3] قائمة الموقع: نفس الصفّ ونفس الحرفية، وسِمة حذف خاصّة بها");
  (() => {
    const list = makeDoc().createElement("div");
    const ctx = {
      document: makeDoc(), console,
      $: (id) => (id === "siteList" ? list : null),
      mappings: [], siteMappings: [{ from: "Mouse2", to: NASTY }],
      saveGlobalData: () => Promise.resolve(),
      saveSiteProfile: () => Promise.resolve()
    };
    const src = POPUP();
    if (!src) return;
    vm.createContext(ctx);
    vm.runInContext(src, ctx);
    ctx.renderSiteList();

    const row = list.kids[0];
    check("القيمة العدائية وصلت حرفياً", row?.kids[1]?.value === NASTY, row?.kids[1]?.value);
    check("سِمة الحذف sdel لا del", row?.kids[2]?.dataset?.sdel === "0" && row?.kids[2]?.dataset?.del === undefined,
      row?.kids[2]?.dataset);
  })();

  console.log("\n[4] شبكة المربعات: الشارة والملخّص نصّاً لا بناءً");
  (() => {
    const grid = makeDoc().createElement("div");
    const ctx = {
      document: makeDoc(), console,
      $: () => grid,
      zoneLabel: (i) => `A${i}`,
      keyBadgeLabel: () => NASTY,
      actionSummary: () => `& ${NASTY}`,
      openZoneModal: () => {}
    };
    const src = GRID();
    if (!src) return;
    vm.createContext(ctx);
    vm.runInContext(src, ctx);
    ctx.renderGrid({ "1": [{ key: "up", type: "volume", value: "+4" }] });

    const cell = grid.kids[0];
    const line = cell?.kids[1];
    check("تسعة مربعات", grid.kids.length === 9, grid.kids.length);
    check("الشارة عنصر واحد بنصّها الحرفيّ", line?.kids[0]?.textContent === NASTY, line?.kids[0]?.textContent);
    check("الملخّص نصّ لا عنصر", typeof line?.kids[1] === "string", typeof line?.kids[1]);
    check("و«&» بقيت كما هي بلا &amp;", line?.kids[1] === `& ${NASTY}`, line?.kids[1]);
    check("لا تهريب `&lt;` في السطر", !/&lt;/.test(line?.textContent || ""), line?.textContent);

    const emptyLine = grid.kids[4]?.kids[1];
    check("المربع الفارغ يبقى شارة + دعوة", emptyLine?.kids[0]?.textContent === "—" && emptyLine?.kids[1] === "اضغط للإضافة",
      [emptyLine?.kids[0]?.textContent, emptyLine?.kids[1]]);
  })();

  console.log(`\n${fail === 0 ? "✅" : "❌"} نجح ${pass} / فشل ${fail}\n`);
  process.exit(fail ? 1 : 0);
})();
