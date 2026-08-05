// #77 — **مُولِّد صفحة الإعدادات: سجلّاتُها ورسمُها في موضعٍ واحد.**
//
// ⚠️ **مُولِّدٌ واحد لا اثنان (قرار المالك):** هذا الملفّ **يُشحن**، و`options.html`
// تستهلكه، **ومعاينةُ `tools/preview-77.html` غلافٌ رقيق فوقه بتخزينٍ صوريّ** —
// لا نسخةٌ ثانية تتباعد عنه. **وإلا شحنّا معاينةً تكذب**، وهو «موضعان للحقيقة
// الواحدة» **في أخطر موضع**: الشيء الذي حكم عليه المالك ليس الشيء الذي يستعمله.
//
// ⚠️ **وقاعدة الوسم (قرار المالك):** كل وسمٍ **فعلٌ يبدأ بما يقع عند التأشير**،
// **ووسمٌ يسمّي عنصراً ممنوع** — فيصير ✓ = «فعّل هذا» في الصفحة كلّها **بلا لمس
// مفتاحٍ مخزَّن واحد**. **وصفر هجرة**: عكسُ قيمةٍ مخزَّنة هجرةُ بيانات (درس #75)،
// وعكسُ كلمةٍ تحريرٌ — فالعلاج في الوسم لا في القيمة.
//
// ⚠️ **والصياغة عملٌ مقيس لا تحريرٌ لغويّ:** ثمانيةٌ وثلاثون وسماً = ثمانٍ وثلاثون
// فرصةً لوسمٍ يَعِد بما لا يفعل. و`measured: true` تعني **أن القياس يعقّده**: ما
// يُخفي أكثر ممّا يسمّيه · وما حالُه لا تُنتَج. **وأيّ وسمٍ يناقض قياس `S7`
// يُبلَّغ ولا يُكتب.**
//
// ملفّ كلاسيكيّ لا وحدة (كـ`storage.js`)، ولا يلمس `chrome.*` بحرف: **يبني
// ويملأ**، والتوصيل والتخزين في `options.js` وحدها.
"use strict";

// ── مجموعات Clean Player ────────────────────────────────────────────────────
// ⚠️ **المعايير مكتوبةٌ هنا لا مُضمَرة، وهذا حارسُها** (قرار المالك 2026-08-02):
// **معيارٌ يُوسَّع لاستيعاب يتيمٍ يمكن أن يظلّ يتوسّع حتى يصير سلّةً بمعيارٍ
// موجب.** وما يمنعه أن المعيار **نصٌّ في المُولِّد**: توسيعُه **يظهر في الفرق**
// ولا يقع صامتاً. فمن وسّع معياراً ليستوعب مفتاحاً جديداً **يراه المراجع**.
// (والمجموعة السادسة حُلَّت بهذا: «ما ليس زرّاً ولا طبقةً دائمة» **تعريفٌ
// بالنفي وأوّل خطوةٍ نحو «متفرّقات»**، فوُسِّع معيارٌ موجب بدلها.)
// **الحدّ الأدنى لمهلة السكون — الموضع الواحد لصفحة الإعدادات** (#89).
// ⛔ **العلّة:** كان يعيش في **أربعة مواضع** (`content.js` · هذا الضابط ·
// وقصّان في `options.js`)، **فنُقل ثلاثةٌ ونُسي رابع** — فبقي يقصّ إلى 500
// **في مسار العرض**: التخزين `100` والمُنزلق يُظهر `500`.
// ⇒ **والميزة كانت تعمل، والواجهة هي التي تكذب.**
// ⚠️ **و`tools/test-idle-min.js` يعدّ المواضع ويشترط تطابقها** — فالتفرّق يصير
// مستحيلاً لا مذكوراً (قرار 16ج).
const VZ_IDLE_MIN_MS = 100;

const VZ_UI_GROUPS = [
  { id: "top",      name: "الشريط العلوي",
    rule: "ما يظهر أعلى الصورة داخل المشغّل" },
  { id: "progress", name: "شريط التقدّم والوقت",
    rule: "ما يقع على شريط التقدّم أو يصف الزمن" },
  { id: "controls", name: "أزرار التحكّم",
    rule: "أزرارٌ ثابتة في الشريط السفلي" },
  { id: "overlays", name: "طبقات فوق الصورة وحولها",
    rule: "ما يُرسم فوق الصورة أو حولها ولا يكون زرّاً — دائماً أو في حالٍ بعينها" },
  { id: "bezel",    name: "وميض وسط الشاشة",
    rule: "ما يومض لحظةً وسط الصورة ثمّ يخبو (#62)" }
];

// ── وسوم Clean Player الثمانية والثلاثين ────────────────────────────────────
// ⚠️ **المفاتيح هي مفاتيح `CLEAN_PLAYER_OPTIONS` نفسها** — و`tools/test-settings-ui.js`
// يعدّ الطرفين: **مفتاحٌ بلا ضابط أو ضابطٌ بلا مفتاح يُحمّر المجموعة**. وهذا هو
// الخطر الأول في إعادة كتابة صفحةٍ كاملة: **أن يسقط ضابط بلا أن ينتبه أحد حتى
// يشتكي مستخدم.**
const VZ_UI_CLEAN = {
  top_section: { group: "top", measured: true, label: "إخفاء الشريط العلوي كلّه",
    help: "يشمل العنوان والأزرار والتدرّج معاً. فيُغني عن بقيّة مفاتيح هذه المجموعة: تأشيرها معه لا يزيد شيئاً." },
  top_titles: { group: "top", label: "إخفاء عنوان الفيديو واسم القناة",
    help: "العنوان واسم القناة أعلى الصورة عند التحويم، وفي ملء الشاشة أيضاً. (#91: يوتيوب يرسمه في ملء الشاشة بعنصرٍ آخر، فكان يبقى ظاهراً هناك حتى قِيس وأُضيف.)" },
  top_playlist_menu: { group: "top", label: "إخفاء زرّ قائمة التشغيل",
    help: "الزرّ الذي يفتح قائمة التشغيل الجارية من داخل المشغّل." },
  top_watch_later: { group: "top", measured: true, label: "إخفاء زرّ «المشاهدة لاحقاً»",
    help: "⚠️ قد لا يُخفي شيئاً اليوم: قِيس أن الشريط العلوي في صفحة watch يحمل «نسخ الرابط» و«البطاقات» و«⋮» بدل هذا الزرّ. حالٌ لم تُنتَج لا محدِّدٌ ميّت — فيبقى المفتاح ولا يُوعَد بأثر." },
  top_share: { group: "top", measured: true, label: "إخفاء زرّ المشاركة",
    help: "⚠️ قد لا يُخفي شيئاً اليوم — للسبب نفسه في زرّ «المشاهدة لاحقاً»." },
  top_info: { group: "top", measured: true, label: "إخفاء زرّ (⋮) ولوحته",
    help: "⚠️ الاسم القديم «Info button» مات: قِيس أن ‎.ytp-info-button‎ لا أثر لاسمه فيما يشحنه يوتيوب. والعامل فعلاً هو زرّ (⋮) ولوحته — والوسم يسمّي ما يعمل." },
  top_card_teaser: { group: "top", label: "إخفاء لافتة البطاقة المنبثقة",
    help: "الشريط الصغير الذي يطلّ من حافة الصورة ليعلن بطاقة." },

  heatmap: { group: "progress", measured: true, label: "إخفاء الخريطة الحرارية على شريط التقدّم",
    help: "⚠️ مخفيّةٌ أصلاً في السكون: قِيس أن شفافيتها صفر حتى تُحوّم على الشريط. ومَن فعّل «إخفاء شريط التقدّم بالسكون» يجدها مخفيّةً معه كذلك." },
  time_display: { group: "progress", label: "إخفاء الوقت المنقضي والمدّة",
    help: "الرقمان على يسار الشريط السفلي. لا يُخفيهما إخفاءُ شريط التقدّم بالسكون — ذاك يُخفي الشريط وتوابعه وحدها." },
  chapter_button: { group: "progress", label: "إخفاء اسم الفصل الجاري",
    help: "اسم الفصل بجوار الوقت. لا يظهر إلا في فيديو له فصول." },

  prev_button: { group: "controls", label: "إخفاء زرّ السابق", help: "زرّ الانتقال إلى الفيديو السابق في قائمة التشغيل." },
  play_button: { group: "controls", label: "إخفاء زرّ التشغيل والإيقاف", help: "الزرّ الأيسر في الشريط السفلي. ⚠️ إخفاؤه لا يمنع التشغيل بالنقر على الصورة أو بمفتاح المسافة." },
  next_button: { group: "controls", label: "إخفاء زرّ التالي", help: "زرّ الانتقال إلى الفيديو التالي." },
  mute_button: { group: "controls", label: "إخفاء زرّ الكتم", help: "أيقونة السمّاعة. ⚠️ لا تمنع الكتم بمفتاح m ولا بأوامر الإضافة." },
  volume_slider: { group: "controls", label: "إخفاء منزلق الصوت", help: "الشريط الذي يظهر بجوار أيقونة السمّاعة عند التحويم." },
  subtitles_button: { group: "controls", label: "إخفاء زرّ الترجمة (CC)", help: "⚠️ يُستثنى تلقائياً ما دامت «أتمتة لغة الترجمة» مُفعَّلة، لأن الأتمتة تنقره لتعمل (#18) — فإخفاؤه كان يقتل ميزةً بميزة." },
  settings_button: { group: "controls", label: "إخفاء زرّ الإعدادات (⚙)", help: "⚠️ يُستثنى تلقائياً مع «أتمتة لغة الترجمة» للسبب نفسه." },
  autoplay_toggle: { group: "controls", label: "إخفاء مفتاح التشغيل التلقائي", help: "المفتاح الذي يقرّر تشغيل الفيديو التالي تلقائياً." },
  miniplayer_button: { group: "controls", measured: true, label: "إخفاء زرّ المشغّل المصغّر",
    help: "⚠️ حالُه غير محدَّدة: قِيس أنه غائب عن الحالات الإحدى عشرة كلّها — وقد يتعلّق بتسجيل الدخول. يتحقّق منه المالك قبل أن يُوعَد بأثر." },
  pip_button: { group: "controls", label: "إخفاء زرّ صورة داخل صورة", help: "زرّ فصل الفيديو في نافذة عائمة." },
  size_button: { group: "controls", label: "إخفاء زرّ وضع السينما", help: "الزرّ الذي يوسّع المشغّل داخل الصفحة بلا ملء شاشة." },
  remote_button: { group: "controls", label: "إخفاء زرّ البثّ إلى جهاز", help: "زرّ الإرسال إلى تلفاز أو جهاز متّصل." },
  fullscreen_button: { group: "controls", label: "إخفاء زرّ ملء الشاشة", help: "⚠️ إخفاؤه لا يمنع ملء الشاشة بمفتاح f ولا بأوامر الإضافة." },

  large_play_button: { group: "overlays", label: "إخفاء زرّ التشغيل الكبير وسط الصورة", help: "الزرّ الكبير الذي يظهر قبل التشغيل أو بعد الإيقاف." },
  endscreen: { group: "overlays", label: "إخفاء شاشة النهاية ومقترحاتها", help: "المربّعات التي تغطّي الصورة في آخر الفيديو، وشبكة المقترحات في ملء الشاشة." },
  cards: { group: "overlays", label: "إخفاء البطاقات وزرّها", help: "زرّ (i) واللوحة المنسدلة التي يفتحها." },
  annotations: { group: "overlays", measured: true, label: "إخفاء التعليقات التوضيحية",
    help: "دون علامة القناة — والاستثناء مقيس لا احتياطيّ (#67): علامة القناة عنصرٌ يحمل الصنفين معاً، فكان هذا المفتاح يُخفيها ومفتاحُ العلامة لا يُخفي شيئاً. ⚠️ وحالُ التعليقات نفسها لم تُنتَج: الحاوية قِيست فارغة." },
  watermark: { group: "overlays", measured: true, label: "إخفاء علامة القناة المائية",
    help: "⚠️ قد لا يُخفي شيئاً على صفحة watch: قِيس أن قاعدة يوتيوب تحصره في مشغّل المعاينة الصامتة، وهي حالٌ لم تُنتَج. يبقى المفتاح لأن الحال قائمة لا لأن الأثر مضمون." },
  paid_content: { group: "overlays", label: "إخفاء تنويه المحتوى المدفوع", help: "الشريط الذي يعلن أن الفيديو ترويج مدفوع." },
  suggested_action: { group: "overlays", label: "إخفاء شارة الإجراء المقترح", help: "الشارة التي تدعوك للاشتراك أو لفتح رابط أثناء التشغيل." },
  embed_more_videos: { group: "overlays", measured: true, label: "إخفاء «مزيد من الفيديوهات» عند الإيقاف",
    help: "⚠️ حالُه لم تُنتَج: قاعدته تحصره في وضع Shorts أو في حال aria-hidden. ⚠️ وعلى مشغّل التضمين 2026 لا يُخفي شيئاً — قِيس أن التضمين هجر عائلة ytp- كلّها (#68)، وهذا يسري على كل مفاتيح هذه الصفحة." },
  quick_actions: { group: "overlays", measured: true, label: "إخفاء الإجراءات السريعة",
    help: "⚠️ في ملء الشاشة وحدها، ومقيسةٌ على مشغّل 2025 «دلهي»: عنقود الإعجاب والمشاركة أسفل يمين الصورة. وصفرُها على صفحة watch صفرٌ من غياب لا من سلامة." },
  fullscreen_scroll_arrow: { group: "overlays", measured: true, label: "إخفاء لوحة «مزيد من الفيديوهات» في ملء الشاشة",
    help: "⚠️ الاسم القديم يَعِد بما لا يقع: قِيس أن لوحة التعليم «مرّر للتفاصيل» لم تُنتَج حالُها (تظهر مرّة لمستخدم). والعامل فعلاً هو شبكة «مزيد من الفيديوهات»، مقيسةً مرئيةً 800×600 في ملء الشاشة." },
  ambient_mode: { group: "overlays", label: "إخفاء التوهّج المحيط بالمشغّل",
    help: "الإضاءة الملوّنة التي تتسرّب من حواف الصورة إلى الصفحة (Ambient mode)." },
  spinner: { group: "overlays", label: "إخفاء دوّامة التحميل",
    help: "الدائرة الدوّارة أثناء انتظار المقطع. ⚠️ إخفاؤها لا يسرّع التحميل — تُخفي الإشارة لا السبب." },

  bezel_text: { group: "bezel", measured: true, label: "إخفاء وميض النصّ وسط الشاشة",
    help: "الصوت والسرعة معاً — ولا ينفصلان: قِيس (#62) أن يوتيوب يعرض «0%» و«100%» و«1.25x» و«1x» في العائلة نفسها. فمن أراد كتم وميض السرعة فقد وميض الصوت معه. ⚠️ وشارة السرعة عندنا (#71) لا يومض لها يوتيوب أصلاً." },
  bezel_icon_valued: { group: "bezel", measured: true, label: "إخفاء وميض الأيقونة ذات النصّ",
    help: "الصوت والسرعة — العائلة نفسها في #62: الأيقونة التي يرافقها رقم أو معامل سرعة." },
  bezel_icon_plain: { group: "bezel", measured: true, label: "إخفاء وميض الأيقونة بلا نصّ",
    help: "التشغيل والإيقاف والتقديم والإرجاع — الأربعة معاً، قِيست في العائلة نفسها فلا تنفصل. وتغيير الجودة لا يومض أصلاً — قِيس bezel 0×0." }
};

// ── ضوابط التوقيت والسكون ───────────────────────────────────────────────────
// ⚠️ **الأسماء الثلاثة التي أبهمت صاحب المشروع بنصّه** — «وسمٌ لم يفهمه صاحب
// المشروع لن يفهمه أحد»: «السرعة المفضّلة لزرّ السرعة» · «مهلة السكون قبل
// الإخفاء» · «مدة ظهور رقم الصوت».
const VZ_UI_TIMING = [
  { id: "gridDuration", kind: "range", min: 0, max: 3000, step: 100, unit: "ms",
    label: "كم تبقى شبكة المربّعات ظاهرة بعد الأمر",
    help: "الشبكة التي تومض داخل الفيديو عند تنفيذ أمر مربّع. صفر = لا تظهر أصلاً." },
  { id: "volumeDuration", kind: "range", min: 0, max: 3000, step: 100, unit: "ms",
    label: "كم يبقى رقم الصوت ظاهراً بعد تغييره",
    help: "⚠️ وشارة السرعة تأخذ المدّة نفسها. فالصفر يعني «لا شارة» للاثنتين — ولذلك يُعطَّل مفتاح شارة السرعة عنده بسببٍ مكتوب." },
  { id: "zoneHintEnabled", kind: "toggle",
    label: "إظهار سطر تلميح المربّع",
    help: "سطرٌ صغير أسفل الشبكة يقول أيّ مربّع نُفِّذ وأيّ أمر — مثل «Zone B1 • DOWN → ACTION:VOLUME:-4»." },
  { id: "speedBadgeEnabled", kind: "toggle",
    label: "إظهار شارة سرعة التشغيل عند تغييرها",
    help: "تظهر في الزاوية المقابلة لرقم الصوت، وتأخذ مدّته ولونه وحجمه نفسها. ⚠️ ولا يومض لها يوتيوب — قِيس أن الكتابة المباشرة لا تُنتج وميضاً." },
  { id: "idleDuration", kind: "range", min: VZ_IDLE_MIN_MS, max: 6000, step: 100, unit: "ms",
    label: "كم ينتظر قبل الإخفاء بعد أن تتوقّف الفأرة",
    help: "تُشارَك بين «إخفاء شريط تقدّم يوتيوب» و«زرّ السرعة». ⚠️ وأقلّها عُشر ثانية، ولا تُطفئ شيئاً — الإطفاء بمفتاح الميزة وحده." },
  { id: "speedButtonEnabled", kind: "toggle",
    label: "إظهار زرّ السرعة داخل المشغّل",
    help: "زرٌّ في طبقتنا لا في شريط يوتيوب: عجلةٌ فوقه تغيّر السرعة ±0.25، ونقرةٌ تنقلك إلى سرعة النقرة. ⚠️ ونقرة اليمين مؤجَّلة حتى يُقاس مسارها (S9)." },
  { id: "speedButtonPreset", kind: "range", min: 0.25, max: 4, step: 0.25, unit: "x",
    label: "سرعة نقرة الزرّ",
    help: "نقرةٌ على زرّ السرعة تنقلك إلى هذه السرعة، ونقرةٌ ثانية تُعيد 1x. والعجلة فوقه تتدرّج ±0.25 بلا نقر." }
];

// ── البناء ──────────────────────────────────────────────────────────────────
// ⚠️ **البناء والملء مفصولان عمداً**: `build` **هادمٌ** (يُنشئ العناصر
// ومستمعاتها)، و`apply` **حارس** (يملأ القيم ويختم). فلو دخل البناءُ مسارَ
// الرسم لصار كلُّ رسمٍ يهدم الضابط الذي ينقر عليه المستخدم — وهو ما قِيس في #69.
function vzUiHelpButton(doc, id, label) {
  // ⚠️ **`<button>` لا `<span>`**: يصله `Tab` **بالبناء**، ولا نعيد بناء ما
  // يعطيه المتصفّح مجّاناً. **والتحويم وحده لا يكفي** — لوحة المفاتيح واللمس
  // يجب أن يصلا، وإلا استُبدل الوضوح بإخفاء (شرط المالك).
  const b = doc.createElement("button");
  b.type = "button";
  b.className = "vzHelp";
  b.textContent = "!";
  b.setAttribute("aria-expanded", "false");
  b.setAttribute("aria-controls", id);
  b.setAttribute("aria-label", `شرح: ${label}`);
  return b;
}

function vzUiRow(doc, { inputId, label, help, measured, input }) {
  const row = doc.createElement("label");
  row.className = measured ? "vzRow vzStar" : "vzRow";
  const span = doc.createElement("span");
  span.className = "vzLbl";
  span.textContent = label;
  row.appendChild(input);
  row.appendChild(span);
  const helpId = `help_${inputId}`;
  row.appendChild(vzUiHelpButton(doc, helpId, label));
  const body = doc.createElement("p");
  body.className = "vzHelpBody";
  body.id = helpId;
  body.hidden = true;
  body.textContent = help;
  return { row, body };
}

// يبني قسم Clean Player من السجلّ — ويُرجع خريطة مفتاح ⇒ ضابط
function vzUiBuildClean(doc, root, onChange) {
  root.textContent = "";
  const map = {};
  for (const g of VZ_UI_GROUPS) {
    const box = doc.createElement("details");
    box.className = "vzGroup";
    box.open = true;
    const sum = doc.createElement("summary");
    const nm = doc.createElement("span");
    nm.textContent = g.name;
    const n = doc.createElement("em");
    sum.appendChild(nm);
    sum.appendChild(n);
    box.appendChild(sum);
    const rule = doc.createElement("p");
    rule.className = "vzRule";
    rule.textContent = g.rule;
    box.appendChild(rule);

    let count = 0;
    for (const key of Object.keys(VZ_UI_CLEAN)) {
      const it = VZ_UI_CLEAN[key];
      if (it.group !== g.id) continue;
      count++;
      const input = doc.createElement("input");
      input.type = "checkbox";
      input.id = `cp_${key}`;
      if (onChange) input.addEventListener("change", () => onChange(key));
      const { row, body } = vzUiRow(doc, {
        inputId: input.id, label: it.label, help: it.help, measured: it.measured, input
      });
      box.appendChild(row);
      box.appendChild(body);
      map[key] = input;
    }
    n.textContent = String(count);
    root.appendChild(box);
  }
  return map;
}

// يبني قسم التوقيت والسكون — ويُرجع خريطة مُعرّف ⇒ ضابط
function vzUiBuildTiming(doc, root, onChange) {
  root.textContent = "";
  const map = {};
  for (const c of VZ_UI_TIMING) {
    const input = doc.createElement("input");
    input.id = c.id;
    if (c.kind === "toggle") {
      input.type = "checkbox";
    } else {
      input.type = "range";
      input.min = String(c.min); input.max = String(c.max); input.step = String(c.step);
    }
    if (onChange) input.addEventListener("change", () => onChange(c.id));
    const { row, body } = vzUiRow(doc, {
      inputId: c.id, label: c.label, help: c.help, measured: false, input
    });
    if (c.kind === "range") {
      const v = doc.createElement("span");
      v.className = "vzVal";
      v.id = `${c.id}Value`;
      row.appendChild(v);
      if (onChange) input.addEventListener("input", () => onChange(c.id, true));
    }
    root.appendChild(row);
    root.appendChild(body);
    map[c.id] = input;
  }
  return map;
}

// ── التلميح: **الظهور يُشتقّ ولا يُخزَّن** (البند #84، قرار المالك 2026-08-03) ──
//
//        ظاهر = (المؤشّر فوقه) **أو** (التركيز عليه)
//
// ⛔ **والشكل القديم مسحوب (قرار 21):** ~~`click` يقلب · و`focus`/`mouseenter`
// يفتحان · ولا مخرج~~. **قِيس فتبيّن أن `blur` و`mouseleave` لا يُغلقان**،
// **و`click` يقلب فيُغلق ما فتحه الوصول** ⇒ **`Tab` إليه يفتح الشرح ثمّ `Enter`
// يُغلقه**، فكانت خطوةُ المالك تُنتج **بلاغ فشلٍ عن سلوكٍ صحيح**.
//
// ⇒ **والعلّة مبدئية: مفتاحُ حالةٍ واحد يقلبه أربعة مداخل يُنتج مدخلاً يُلغي أثر
// آخر.** **والاشتقاق من مدخلين مستقلَّين يجعل ذلك مستحيلاً بالبناء لا محروساً** —
// «موضعٌ واحد للحقيقة أو تُشتقّ»، **والثانية هنا أرخص**.
//
// **ولا `click` بذاته:** النقر **يمنح التركيز** فيظهر بالاشتقاق — **واللمس يعمل
// بلا مسارٍ خاصّ**: النقر يمنح، والنقر بعيداً يُزيل.
//
// ⚠️ **و`Esc` يُزيل التركيز صراحةً لا اعتماداً على سلوكٍ افتراضيّ:** «`Esc` يُبعد
// التركيز» **دعوى لم تُقَس عندنا** — والتركيز لا يعمل في المتصفّح المقطوع الرأس
// فلا سبيل إلى قياسها. ⇒ **فتُنفَّذ ولا تُفترض**، وهي **مدخلٌ إلى المصدر نفسه
// (التركيز) لا مفتاحُ حالةٍ ثانٍ** — فالاشتقاق يبقى واحداً.
// **وبه يسقط «حدّ `Esc` المعروف» بدل أن يُوثَّق.**
//
// ⭐ **والحالة التي تكشف الفرق:** `Tab` إليه (يظهر) ثمّ حوّم عليه ثمّ ابعد
// المؤشّر ⇒ **يبقى ظاهراً لأن التركيز باقٍ**. **ومفتاحٌ واحد كان سيُغلقه.**
function vzUiWireHelp(doc, root) {
  for (const b of root.querySelectorAll(".vzHelp")) {
    const body = doc.getElementById(b.getAttribute("aria-controls"));
    if (!body) continue;
    let hovered = false, focused = false;
    const apply = () => {
      const on = hovered || focused;              // **الاشتقاق، ولا حالة تُخزَّن**
      body.hidden = !on;
      b.setAttribute("aria-expanded", String(on));
    };
    b.addEventListener("mouseenter", () => { hovered = true;  apply(); });
    b.addEventListener("mouseleave", () => { hovered = false; apply(); });
    b.addEventListener("focus",      () => { focused = true;  apply(); });
    b.addEventListener("blur",       () => { focused = false; apply(); });
    b.addEventListener("keydown", (e) => { if (e.key === "Escape") b.blur(); });
  }
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { VZ_IDLE_MIN_MS, VZ_UI_GROUPS, VZ_UI_CLEAN, VZ_UI_TIMING,
    vzUiBuildClean, vzUiBuildTiming, vzUiWireHelp, vzUiRow, vzUiHelpButton };
}
