// Extracts validateBackup from options.js and exercises it against malformed files.
const fs = require("fs"), vm = require("vm");
const opt = fs.readFileSync("options.js", "utf8");
const store = fs.readFileSync("storage.js", "utf8");
const body = opt.slice(opt.indexOf("const BACKUP_VERSION"), opt.indexOf("async function importAllSettings"));
const ctx = { TextEncoder, console };
vm.createContext(ctx);
vm.runInContext(store + "\n" + body, ctx);
const V = ctx.validateBackup;

let pass=0, fail=0;
const t=(name, input, expectOk)=>{
  const r=V(input); const ok=(r===null)===expectOk;
  ok?pass++:fail++;
  console.log(`  ${ok?"✅":"❌"} ${name}${r?` → "${r}"`:" → مقبول"}`);
};
console.log("\nملفات يجب رفضها:");
t("null", null, false);
t("نص بدل كائن", "hello", false);
t("بلا __vizExport", {data:{}}, false);
t("data نص", {__vizExport:true, version:2, data:"x"}, false);
t("data مصفوفة", {__vizExport:true, version:2, data:[]}, false);
t("settings نص (البند #3)", {__vizExport:true, version:2, data:{settings:"x"}}, false);
t("globalSiteRules مصفوفة", {__vizExport:true, version:2, data:{globalSiteRules:[]}}, false);
t("blockedHosts كائن", {__vizExport:true, version:2, data:{settings:{blockedHosts:{}}}}, false);
t("zones نص", {__vizExport:true, version:2, data:{settings:{zones:"x"}}}, false);
t("شظية sp: تالفة", {__vizExport:true, version:2, data:{"sp:a.com":"junk"}}, false);
t("نسخة أحدث (99)", {__vizExport:true, version:99, data:{}}, false);
t("نسخة غير رقمية", {__vizExport:true, version:"x", data:{}}, false);
console.log("\nملفات يجب قبولها:");
t("v2 فارغ", {__vizExport:true, version:2, data:{}}, true);
t("v1 قديم بـ siteProfiles", {__vizExport:true, version:1, data:{siteProfiles:{"a.com":{enabled:true,mappings:[]}}}}, true);
t("v2 بشظايا", {__vizExport:true, version:2, data:{"sp:a.com":{enabled:true,mappings:[]},settings:{blockedHosts:[]}}}, true);
console.log(`\n${fail===0?"✅":"❌"} نجح ${pass} / فشل ${fail}\n`);
process.exit(fail?1:0);
