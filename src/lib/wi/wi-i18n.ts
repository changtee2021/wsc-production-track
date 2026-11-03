// Screen labels for the employee-facing WI pages (Thai / English / Myanmar).
// Manual content itself is translated per WI in the editor (snapshot.translations).
import { useCallback, useMemo, useSyncExternalStore } from "react";
import type { WiCheckpointType, WiLang } from "@/lib/wi/wi-schema";

const th = {
  appTitle: "คู่มือปฏิบัติงาน",
  kicker: "WSC · วิธีปฏิบัติงาน",
  home: "หน้าแรก",
  back: "กลับ",
  products: "หมวดสินค้า",
  pickProduct: "เลือกหมวดสินค้า",
  pickProductHint: "เลือกสินค้าที่ทำ แล้วดูคู่มือทีละขั้นตอน",
  stepsHint: "เรียงตามขั้นตอนการผลิต กดการ์ดเพื่อเปิดคู่มือ",
  manualsCount: "{n} คู่มือ",
  unreadCount: "ยังไม่อ่าน {n}",
  allRead: "อ่านครบแล้ว",
  step: "ขั้นตอน",
  stepOf: "ขั้นที่ {i} จาก {n}",
  minutes: "ประมาณ {n} นาที",
  stepsCount: "{n} ขั้นตอน",
  safety: "ระวังความปลอดภัย",
  equipment: "ต้องใช้",
  caution: "ระวัง",
  note: "หมายเหตุ",
  expected: "ผลที่ต้องได้",
  checks: "ตรวจก่อนส่งต่อ",
  prev: "ก่อนหน้า",
  next: "ถัดไป",
  oneByOne: "ทีละขั้น",
  showAll: "ทั้งหมด",
  confirmRead: "อ่านจบแล้ว เข้าใจ",
  confirmReadHint: "กดยืนยันเมื่ออ่านครบทุกขั้น",
  readDone: "อ่านแล้ว",
  readAt: "อ่านแล้ว · {t}",
  unread: "ยังไม่อ่าน",
  newVersion: "มีฉบับใหม่",
  pleaseRead: "มีฉบับใหม่ — กรุณาอ่าน",
  savedRead: "บันทึกแล้วว่าอ่านแล้ว",
  whoAreYou: "สแกนบัตร",
  pickName: "สแกนบัตรพนักงาน",
  pickNameHint: "สแกนบัตรตัวเอง หรือพิมพ์เลขพนักงาน ระบบจะจำว่าคุณอ่านคู่มือไหนแล้ว",
  pickNameToConfirm: "สแกนบัตรหรือพิมพ์เลขพนักงานก่อน",
  pickNameFirst: "สแกนบัตรก่อนดูคู่มือ",
  pickNameFirstHint: "สแกนครั้งเดียว เครื่องนี้จะจำไว้ เปลี่ยนได้ที่มุมขวาบน",
  change: "เปลี่ยน",
  searchName: "หรือพิมพ์เลขพนักงาน",
  confirmCode: "ยืนยัน",
  enterCode: "สแกนบัตรหรือพิมพ์เลขพนักงานก่อน",
  cameraFailed: "เปิดกล้องไม่ได้ พิมพ์เลขพนักงานแทน",
  noEmployee: "ไม่พบเลขพนักงานนี้",
  noManuals: "หมวดนี้ยังไม่มีคู่มือ",
  noManualsHint: "คู่มือจะขึ้นที่นี่เมื่อเผยแพร่และผูกกับขั้นตอนของหมวดนี้แล้ว",
  flowParallel: "ทำพร้อมกันได้",
  flowParallelHint: "ในสายเดียวกันต้องเรียง สายที่อยู่กรอบเดียวกันทำพร้อมกันได้",
  flowThen: "ทำต่อเมื่อทุกสายเสร็จ",
  noStepManual: "ยังไม่มีคู่มือ",
  extraManuals: "คู่มือที่ยังไม่อยู่ในโฟล",
  notFound: "ไม่พบคู่มือ",
  notFoundHint: "คู่มืออาจยังไม่เผยแพร่ หรือถูกเก็บถาวรแล้ว — สอบถามหัวหน้างาน",
  noProduct: "ไม่พบหมวดสินค้านี้",
  backToProducts: "กลับไปเลือกหมวด",
  loading: "กำลังโหลด…",
  retry: "ลองใหม่",
  print: "พิมพ์",
  notTranslated: "ยังแปลไม่ครบ — ส่วนที่ยังไม่แปลแสดงเป็นภาษาไทย",
  related: "เอกสารที่เกี่ยวข้อง",
  video: "วิดีโอ",
  openLink: "เปิดลิงก์",
  noSteps: "ยังไม่มีขั้นตอน",
  previewBanner: "ตัวอย่างก่อนเผยแพร่ — พนักงานยังไม่เห็นเนื้อหานี้จนกว่าจะอนุมัติ",
  stepManual: "ดูคู่มือขั้นตอนนี้",
  closeToScan: "ปิดหน้านี้เพื่อกลับไปสแกนงานต่อ",
  notAvailable: "คู่มือนี้ไม่พร้อมใช้งานแล้ว",
  language: "ภาษา",
  cp_pass_fail: "ผ่าน / ไม่ผ่าน",
  cp_checkbox: "ติ๊กยืนยัน",
  cp_numeric: "วัดค่า",
  cp_text: "จดสั้นๆ",
  cp_photo: "ถ่ายรูปหลักฐาน",
};

export type WiLabelKey = keyof typeof th;

const en: Record<WiLabelKey, string> = {
  appTitle: "Work instructions",
  kicker: "WSC · How to do the job",
  home: "Home",
  back: "Back",
  products: "Products",
  pickProduct: "Choose a product",
  pickProductHint: "Pick what you are making, then follow the manual step by step",
  stepsHint: "In production order. Tap a card to open the manual.",
  manualsCount: "{n} manuals",
  unreadCount: "{n} not read",
  allRead: "All read",
  step: "Step",
  stepOf: "Step {i} of {n}",
  minutes: "About {n} min",
  stepsCount: "{n} steps",
  safety: "Safety first",
  equipment: "You need",
  caution: "Caution",
  note: "Note",
  expected: "Good result",
  checks: "Check before passing on",
  prev: "Back",
  next: "Next",
  oneByOne: "One by one",
  showAll: "Show all",
  confirmRead: "I have read and understood",
  confirmReadHint: "Confirm after reading every step",
  readDone: "Read",
  readAt: "Read · {t}",
  unread: "Not read",
  newVersion: "New version",
  pleaseRead: "New version — please read",
  savedRead: "Saved as read",
  whoAreYou: "Scan badge",
  pickName: "Scan your badge",
  pickNameHint:
    "Scan your own badge or type your employee number. We remember which manuals you have read",
  pickNameToConfirm: "Scan your badge or type your number first",
  pickNameFirst: "Scan your badge to open the manuals",
  pickNameFirstHint: "Only once — this device remembers. Change it at the top right.",
  change: "Change",
  searchName: "Or type your employee number",
  confirmCode: "Confirm",
  enterCode: "Scan your badge or type your number first",
  cameraFailed: "Camera did not open. Type your employee number instead",
  noEmployee: "No employee with this number",
  noManuals: "No manuals for this product yet",
  noManualsHint: "Manuals appear here once they are published for this product's steps",
  flowParallel: "Can run together",
  flowParallelHint: "Stay in order inside one line. Lines in the same box can run together",
  flowThen: "After every line is finished",
  noStepManual: "No manual yet",
  extraManuals: "Manuals not in this flow yet",
  notFound: "Manual not found",
  notFoundHint: "It may not be published yet or was archived — ask your supervisor",
  noProduct: "Product not found",
  backToProducts: "Back to products",
  loading: "Loading…",
  retry: "Try again",
  print: "Print",
  notTranslated: "Not fully translated — untranslated parts are shown in Thai",
  related: "Related documents",
  video: "Video",
  openLink: "Open link",
  noSteps: "No steps yet",
  previewBanner: "Preview — staff cannot see this until it is approved",
  stepManual: "Open the manual for this step",
  closeToScan: "Close this to go back to scanning",
  notAvailable: "This manual is no longer available",
  language: "Language",
  cp_pass_fail: "Pass / Fail",
  cp_checkbox: "Tick to confirm",
  cp_numeric: "Measure",
  cp_text: "Short note",
  cp_photo: "Take a photo",
};

const my: Record<WiLabelKey, string> = {
  appTitle: "လုပ်ငန်းလမ်းညွှန်",
  kicker: "WSC · အလုပ်လုပ်နည်း",
  home: "ပင်မစာမျက်နှာ",
  back: "နောက်သို့",
  products: "ထုတ်ကုန်အမျိုးအစား",
  pickProduct: "ထုတ်ကုန်ကို ရွေးပါ",
  pickProductHint: "လုပ်နေသည့် ထုတ်ကုန်ကိုရွေးပြီး အဆင့်လိုက် ကြည့်ပါ",
  stepsHint: "ထုတ်လုပ်မှု အစဉ်အတိုင်း စီထားသည်။ ဖွင့်ရန် ကတ်ကို နှိပ်ပါ",
  manualsCount: "လမ်းညွှန် {n} ခု",
  unreadCount: "မဖတ်ရသေး {n}",
  allRead: "အားလုံး ဖတ်ပြီး",
  step: "အဆင့်",
  stepOf: "အဆင့် {i} / {n}",
  minutes: "ခန့်မှန်း {n} မိနစ်",
  stepsCount: "{n} ဆင့်",
  safety: "ဘေးကင်းရေး သတိပြုရန်",
  equipment: "လိုအပ်သော ပစ္စည်း",
  caution: "သတိ",
  note: "မှတ်ချက်",
  expected: "ရရမည့် ရလဒ်",
  checks: "မပို့မီ စစ်ဆေးရန်",
  prev: "ယခင်",
  next: "နောက်တစ်ဆင့်",
  oneByOne: "တစ်ဆင့်ချင်း",
  showAll: "အားလုံး",
  confirmRead: "ဖတ်ပြီး နားလည်ပါပြီ",
  confirmReadHint: "အဆင့်အားလုံး ဖတ်ပြီးမှ အတည်ပြုပါ",
  readDone: "ဖတ်ပြီး",
  readAt: "ဖတ်ပြီး · {t}",
  unread: "မဖတ်ရသေး",
  newVersion: "ဗားရှင်းအသစ်",
  pleaseRead: "ဗားရှင်းအသစ် — ဖတ်ပေးပါ",
  savedRead: "ဖတ်ပြီးကြောင်း မှတ်ထားပြီး",
  whoAreYou: "ကတ်ဖတ်",
  pickName: "ဝန်ထမ်းကတ် ဖတ်ပါ",
  pickNameHint:
    "ကိုယ့်ကတ်ကို ဖတ်ပါ သို့မဟုတ် ဝန်ထမ်းနံပါတ် ရိုက်ပါ။ ဖတ်ပြီးသော လမ်းညွှန်ကို မှတ်ထားပါမည်",
  pickNameToConfirm: "ကတ်ဖတ်ပါ သို့မဟုတ် နံပါတ်အရင်ရိုက်ပါ",
  pickNameFirst: "လမ်းညွှန်ကြည့်ရန် ကတ်အရင်ဖတ်ပါ",
  pickNameFirstHint: "တစ်ကြိမ်သာ ဖတ်ရန် — ဤစက်က မှတ်ထားပါမည်။ ညာဘက်အပေါ်တွင် ပြောင်းနိုင်သည်။",
  change: "ပြောင်းရန်",
  searchName: "သို့မဟုတ် ဝန်ထမ်းနံပါတ် ရိုက်ပါ",
  confirmCode: "အတည်ပြု",
  enterCode: "ကတ်ဖတ်ပါ သို့မဟုတ် နံပါတ်အရင်ရိုက်ပါ",
  cameraFailed: "ကင်မရာ မဖွင့်ပါ။ နံပါတ်ရိုက်ပါ",
  noEmployee: "ဤဝန်ထမ်းနံပါတ် မတွေ့ပါ",
  noManuals: "ဤထုတ်ကုန်အတွက် လမ်းညွှန် မရှိသေးပါ",
  noManualsHint: "ထုတ်ပြန်ပြီးသည်နှင့် ဤနေရာတွင် ပေါ်လာပါမည်",
  flowParallel: "တစ်ပြိုင်နက် လုပ်နိုင်သည်",
  flowParallelHint:
    "လိုင်းတစ်ခုထဲ အစဉ်လိုက်လုပ်ပါ။ ဘောင်တစ်ခုတည်းက လိုင်းများကို တစ်ပြိုင်နက်လုပ်နိုင်သည်",
  flowThen: "လိုင်းအားလုံး ပြီးမှ ဆက်လုပ်",
  noStepManual: "လမ်းညွှန် မရှိသေးပါ",
  extraManuals: "ဤအစဉ်တွင် မပါသေးသော လမ်းညွှန်",
  notFound: "လမ်းညွှန် မတွေ့ပါ",
  notFoundHint: "မထုတ်ပြန်ရသေး သို့မဟုတ် သိမ်းဆည်းထားပြီ — ကြီးကြပ်သူကို မေးပါ",
  noProduct: "ဤထုတ်ကုန် မတွေ့ပါ",
  backToProducts: "ထုတ်ကုန်စာရင်းသို့",
  loading: "ဖွင့်နေသည်…",
  retry: "ထပ်ကြိုးစားပါ",
  print: "ပုံနှိပ်",
  notTranslated: "ဘာသာပြန် မပြည့်စုံသေးပါ — မပြန်ရသေးသည့်အပိုင်းကို ထိုင်းလို ပြထားသည်",
  related: "ဆက်စပ် စာရွက်စာတမ်း",
  video: "ဗီဒီယို",
  openLink: "လင့်ခ် ဖွင့်ရန်",
  noSteps: "အဆင့် မရှိသေးပါ",
  previewBanner: "အစမ်းကြည့်ရှုခြင်း — အတည်မပြုမီ ဝန်ထမ်းများ မမြင်ရပါ",
  stepManual: "ဤအဆင့်၏ လမ်းညွှန် ကြည့်ရန်",
  closeToScan: "စကင်ဖတ်ရန် ပြန်သွားလိုလျှင် ပိတ်ပါ",
  notAvailable: "ဤလမ်းညွှန်ကို အသုံးမပြုနိုင်တော့ပါ",
  language: "ဘာသာစကား",
  cp_pass_fail: "အောင် / ကျ",
  cp_checkbox: "အမှန်ခြစ်ပါ",
  cp_numeric: "တိုင်းတာပါ",
  cp_text: "တိုတိုရေးပါ",
  cp_photo: "ဓာတ်ပုံ ရိုက်ပါ",
};

const DICT: Record<WiLang, Record<WiLabelKey, string>> = { th, en, my };

export const WI_LANG_LABEL: Record<WiLang, string> = { th: "ไทย", en: "EN", my: "မြန်မာ" };

export type WiT = (key: WiLabelKey, vars?: Record<string, string | number>) => string;

export function wiT(lang: WiLang): WiT {
  return (key, vars) => {
    let s = DICT[lang][key] ?? th[key];
    if (vars) for (const k in vars) s = s.replaceAll(`{${k}}`, String(vars[k]));
    return s;
  };
}

export function checkpointTypeLabel(t: WiT, type: WiCheckpointType): string {
  return t(`cp_${type}` as WiLabelKey);
}

/** Production names are stored as "ไทย မြန်မာ"; show the part for the language. */
export function bilingualName(name: string, lang: WiLang): string {
  const body = name.replace(/^\d+\.\s*/, "").trim();
  const thai = body.match(/^[\u0E00-\u0E7F0-9.\s/()-]+/)?.[0]?.trim() ?? "";
  const burmese = body.match(/[\u1000-\u109F][\u1000-\u109F\s]*/)?.[0]?.trim() ?? "";
  if (lang === "my" && burmese) return burmese;
  return thai || body;
}

export function formatWiDate(iso: string, lang: WiLang): string {
  const locale = lang === "en" ? "en-GB" : lang === "my" ? "my-MM" : "th-TH";
  try {
    return new Date(iso).toLocaleDateString(locale, {
      timeZone: "Asia/Bangkok",
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return new Date(iso).toLocaleDateString("th-TH");
  }
}

// ---- Per-device preferences (language + who is reading) --------------------

const LANG_KEY = "wsc:wi-lang";
const EMP_KEY = "wsc:wi-employee";
const PREFS_EVENT = "wsc:wi-prefs";

export type WiReader = { id: string; name: string; nationality: string | null };

function subscribe(cb: () => void) {
  window.addEventListener(PREFS_EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(PREFS_EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

function readRaw(key: string): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(key) ?? "";
}

function write(key: string, value: string | null) {
  if (value == null) localStorage.removeItem(key);
  else localStorage.setItem(key, value);
  window.dispatchEvent(new Event(PREFS_EVENT));
}

export function langForNationality(nat: string | null | undefined): WiLang {
  const n = nat?.toLowerCase() ?? "";
  if (n.includes("burm") || n.includes("myan") || n.includes("พม่า")) return "my";
  return "th";
}

export function useWiReader(): [WiReader | null, (r: WiReader | null) => void] {
  const raw = useSyncExternalStore(
    subscribe,
    () => readRaw(EMP_KEY),
    () => "",
  );
  const reader = useMemo(() => {
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw) as WiReader;
      return parsed?.id && parsed?.name ? parsed : null;
    } catch {
      return null;
    }
  }, [raw]);
  const set = useCallback((r: WiReader | null) => {
    write(EMP_KEY, r ? JSON.stringify(r) : null);
    if (r && !readRaw(LANG_KEY)) write(LANG_KEY, langForNationality(r.nationality));
  }, []);
  return [reader, set];
}

export function useWiLang(): [WiLang, (l: WiLang) => void, WiT] {
  const raw = useSyncExternalStore(
    subscribe,
    () => readRaw(LANG_KEY),
    () => "",
  );
  const lang: WiLang = raw === "en" || raw === "my" ? raw : "th";
  const set = useCallback((l: WiLang) => write(LANG_KEY, l), []);
  return [lang, set, wiT(lang)];
}
