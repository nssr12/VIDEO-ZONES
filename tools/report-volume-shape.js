// مِجَسّ شكل عنصر المستوى عند المضيف — **يُلصق في كونسول الصفحة، ولا يُشحن.**
//
// السؤال الذي يقرّر شكل «عائلة المنزلق» (#60 · قرار 25): هل منزلق المضيف
// **`<input type=range>` كتويتش** أم **`div` بـ`role=slider` كيوتيوب** أم شيء ثالث؟
// إن تشابه كِك وتويتش فمصنع واحد بمعاملين، وإن اختلفا فمحوّلان.
//
// **الاستعمال:**
//   ١. افتح `kick.com/<قناة حيّة>` أو `twitch.tv/<قناة حيّة>` وانتظر بدء التشغيل.
//   ٢. **مرّر مؤشّر الفأرة فوق المشغّل** — كِك لا يُركّب شريط تحكّمه إلا بتفاعل،
//      وقياسنا في headless خرج «لا عنصر مستوى» لهذا السبب بالضبط.
//   ٣. الصق السطر في الكونسول. يطبع **سطرين**: واحداً فوراً (قبل التمرير)
//      وواحداً بعد ست ثوانٍ — **مرّر المؤشّر على المشغّل خلالها**.
//   ٤. انسخ السطرين كما هما.
//
// ⚠️ تشخيصيّ محض: **لا يكتب شيئاً ولا يغيّر مستوى ولا كتماً.** قراءة فقط.
(() => {
  const SELECTORS = [
    'input[type=range]',
    '[role=slider]',
    '[data-a-target*="volume" i]',
    '[data-testid*="volume" i]',
    '[aria-label*="volume" i]',
    '[aria-label*="صوت" i]',
    '[class*="volume" i]'
  ];
  const q = (s) => { try { return [...document.querySelectorAll(s)]; } catch { return []; } };
  const desc = (el) => {
    const tag = el.tagName.toLowerCase();
    const cls = typeof el.className === "string" && el.className.trim()
      ? "." + el.className.trim().split(/\s+/).slice(0, 2).join(".")
      : "";
    const r = el.getBoundingClientRect();
    const val = el.getAttribute("aria-valuenow") ?? (el.value !== undefined ? el.value : null);
    const min = el.getAttribute("aria-valuemin") ?? (el.min !== undefined && el.min !== "" ? el.min : null);
    const max = el.getAttribute("aria-valuemax") ?? (el.max !== undefined && el.max !== "" ? el.max : null);
    return `<${tag}${el.type ? " type=" + el.type : ""}>${el.id ? "#" + el.id : ""}${cls}` +
      ` role=${el.getAttribute("role") || "—"}` +
      ` val=${val === null || val === "" ? "—" : val}` +
      ` مدى=${min === null ? "—" : min}..${max === null ? "—" : max}` +
      ` مرئي=${r.width > 0 && r.height > 0 ? "نعم" : "لا"}`;
  };
  const scan = (tag) => {
    const seen = new Set();
    const out = [];
    for (const sel of SELECTORS) {
      for (const el of q(sel)) {
        if (seen.has(el) || out.length >= 6) continue;
        seen.add(el);
        out.push(desc(el));
      }
    }
    const v = document.querySelector("video");
    console.log(`VZSHAPE ${location.host} [${tag}] عدد=${out.length}` +
      ` | فيديو=${v ? "نعم rs=" + v.readyState + " vol=" + Math.round((v.volume ?? 0) * 100) + "%" + (v.muted ? " مكتوم" : "") : "لا"}` +
      ` | ${out.length ? out.join("  ||  ") : "لا عنصر مستوى"}`);
  };
  scan("قبل");
  console.log("… مرّر المؤشّر فوق المشغّل الآن — السطر الثاني بعد 6 ثوانٍ …");
  setTimeout(() => scan("بعد التمرير"), 6000);
})();
