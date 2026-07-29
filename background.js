// ⚠️ هذا الملف هو الاستثناء الوحيد لقرار «لا service worker في هذا المشروع».
//
// المبرّر (البند #26): هجرة المخطط — تجزئة siteProfiles إلى شظايا sp:<نطاق>،
// وتحويل zones.wheel.map القديم إلى zones.wheel.actions — كانت **لا تقع إلا لمن
// يفتح صفحة الإعدادات بيده**. من لم يفتحها قط يبقى على مخطط قديم إلى الأبد.
// لا سبيل لتشغيل الهجرة عند تحديث الإضافة بلا مستمع chrome.runtime.onInstalled،
// ولا مكان لهذا المستمع إلا service worker.
//
// نطاقه ضيّق بقرار المالك (القرار 10): **لا يفعل شيئاً سوى الهجرة**.
// مستمع واحد فقط، ولا يُنقل إليه أي منطق قائم. أي إضافة أخرى هنا تخالف القرار.
//
// ملاحظة: لا وجود لـ chrome.runtime.onUpdated — التحديث هو onInstalled نفسه
// بـ details.reason === "update"، فمستمع واحد يغطّي التثبيت والتحديث معاً.
//
// importScripts لا "type": "module": هكذا نستدعي **دالة الهجرة نفسها** التي
// تستدعيها صفحة الإعدادات، بلا نسخة ثانية ولا كتلة مقترنة. تحويل storage.js إلى
// وحدة ES كان سيكسر تحميلها كسكربت عادي في popup.html و options.html، وسيُدخل
// كلمة export داخل الكتل المقترنة نصّياً مع content.js فيُسقط tools/test-migration.js.
importScripts("storage.js");

chrome.runtime.onInstalled.addListener((details) => migrateSchema(details?.reason));

// خارج المستمع كي يبقى المستمع سطراً واحداً **يُرجع الوعد ولا يبتلعه**.
// كل خطوات migrateAll استدعاءات chrome.storage، وهي تُبقي الـ worker حيّاً حتى
// تنتهي. والفشل يُسجَّل ولا يُبتلع: هنا لا واجهة تعرضه فيها.
async function migrateSchema(reason) {
  try {
    const result = await migrateAll();
    console.log("[VIDEO-ZONES] هجرة المخطط", reason, JSON.stringify(result));
  } catch (err) {
    console.warn("[VIDEO-ZONES] تعذّرت هجرة المخطط", reason, err);
  }
}
