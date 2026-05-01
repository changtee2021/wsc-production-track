import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Lang = "th" | "my";

type Dict = Record<string, string>;

const STORAGE_KEY = "pt_lang";

// Burmese translations reviewed for production-line vocabulary.
// "Job ID" → အလုပ်နံပါတ်, "Employee" → ဝန်ထမ်း, "Step" → အဆင့်,
// "Start work" → အလုပ်စတင်ရန်, "Finish work" → အလုပ်ပြီးဆုံးရန်
const dictionaries: Record<Lang, Dict> = {
  th: {
    "page.title": "สแกนงาน — ProductionTrack",
    "page.desc":
      "สแกน QR code เพื่อบันทึกเวลาเริ่มและเสร็จงานในสายการผลิต ใช้งานง่ายบนมือถือ",
    "header.admin": "ผู้ดูแล",
    "job.label": "รหัสงาน (Job ID)",
    "job.autoHint": "ระบบดึงรหัสจาก QR code อัตโนมัติ ไม่ต้องพิมพ์เอง",
    "job.empty": 'ยังไม่มีรหัสงาน — กดปุ่ม "สแกน QR" หรือกรอกด้วยตัวเอง',
    "job.scan": "สแกน QR",
    "job.placeholder": "หรือพิมพ์รหัสงาน เช่น JOB123",
    "job.resetTitle": "ล้างรหัสงานเพื่อสแกนใหม่",
    "job.confirmTitle": "ยืนยันรหัสงาน",
    "emp.title": "เลือกพนักงาน",
    "emp.loading": "กำลังโหลด…",
    "emp.placeholder": "-- เลือกพนักงาน --",
    "step.title": "เลือกขั้นตอนการผลิต",
    "step.placeholder": "-- เลือกขั้นตอน --",
    "step.minutes": "นาที",
    "step.warning": "ขั้นตอนนี้ไม่ควรเกิน {n} นาที",
    "action.start": "เริ่มงาน",
    "action.finish": "เสร็จงาน",
    "action.saving": "กำลังบันทึก…",
    "toast.noJob": "ไม่พบรหัสงาน — กรุณาสแกน QR code",
    "toast.noSelect": "กรุณาเลือกพนักงานและขั้นตอน",
    "toast.scanned": "สแกนสำเร็จ: {v}",
    "toast.startedAt": "เริ่มงาน เมื่อ {t}",
    "toast.finishedAt": "เสร็จงาน เมื่อ {t}",
    "log.startOk": "บันทึกการเริ่มงานเรียบร้อย",
    "log.finishOk": "บันทึกการเสร็จงานเรียบร้อย",
    "footer.langs": "🇹🇭 ไทย · 🇲🇲 พม่า · 🇱🇦 ลาว · 🇰🇭 กัมพูชา",
    "lang.label": "ภาษา",
  },
  my: {
    "page.title": "အလုပ်စကင်န် — ProductionTrack",
    "page.desc":
      "ထုတ်လုပ်မှုလိုင်းတွင် အလုပ်စတင်ချိန်နှင့် ပြီးဆုံးချိန်ကို မှတ်တမ်းတင်ရန် QR ကုဒ်ကို စကင်န်ဖတ်ပါ။ မိုဘိုင်းတွင် အသုံးပြုရလွယ်ကူပါသည်။",
    "header.admin": "စီမံခန့်ခွဲသူ",
    "job.label": "အလုပ်နံပါတ် (Job ID)",
    "job.autoHint": "စနစ်က QR ကုဒ်မှ နံပါတ်ကို အလိုအလျောက် ထုတ်ယူပေးသည်။ ကိုယ်တိုင်ရိုက်ထည့်ရန် မလိုပါ။",
    "job.empty": 'အလုပ်နံပါတ် မရှိသေးပါ — "QR စကင်န်" ကို နှိပ်ပါ သို့မဟုတ် ကိုယ်တိုင်ရိုက်ထည့်ပါ။',
    "job.scan": "QR စကင်န်",
    "job.placeholder": "သို့မဟုတ် အလုပ်နံပါတ် ရိုက်ထည့်ပါ၊ ဥပမာ JOB123",
    "job.resetTitle": "အလုပ်နံပါတ်ကို ရှင်းပြီး ပြန်စကင်န်ပါ",
    "job.confirmTitle": "အလုပ်နံပါတ်ကို အတည်ပြုပါ",
    "emp.title": "ဝန်ထမ်းကို ရွေးချယ်ပါ",
    "emp.loading": "ဖွင့်နေသည်…",
    "emp.placeholder": "-- ဝန်ထမ်းရွေးပါ --",
    "step.title": "ထုတ်လုပ်မှုအဆင့်ကို ရွေးချယ်ပါ",
    "step.placeholder": "-- အဆင့်ရွေးပါ --",
    "step.minutes": "မိနစ်",
    "step.warning": "ဤအဆင့်သည် {n} မိနစ်ထက် မပိုသင့်ပါ",
    "action.start": "အလုပ်စတင်ရန်",
    "action.finish": "အလုပ်ပြီးဆုံးရန်",
    "action.saving": "သိမ်းဆည်းနေသည်…",
    "toast.noJob": "အလုပ်နံပါတ် မတွေ့ပါ — QR ကုဒ်ကို စကင်န်ဖတ်ပါ",
    "toast.noSelect": "ဝန်ထမ်းနှင့် အဆင့်ကို ရွေးချယ်ပါ",
    "toast.scanned": "စကင်န်အောင်မြင်သည်: {v}",
    "toast.startedAt": "အလုပ်စတင်ပြီး {t}",
    "toast.finishedAt": "အလုပ်ပြီးဆုံးပြီး {t}",
    "log.startOk": "အလုပ်စတင်မှုကို သိမ်းဆည်းပြီးပါပြီ",
    "log.finishOk": "အလုပ်ပြီးဆုံးမှုကို သိမ်းဆည်းပြီးပါပြီ",
    "footer.langs": "🇹🇭 ထိုင်း · 🇲🇲 မြန်မာ · 🇱🇦 လာအို · 🇰🇭 ကမ္ဘောဒီးယား",
    "lang.label": "ဘာသာစကား",
  },
};

interface I18nCtx {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
}

const Ctx = createContext<I18nCtx | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("th");

  useEffect(() => {
    const saved = (typeof window !== "undefined" && localStorage.getItem(STORAGE_KEY)) as Lang | null;
    if (saved === "th" || saved === "my") setLangState(saved);
  }, []);

  const setLang = (l: Lang) => {
    setLangState(l);
    if (typeof window !== "undefined") localStorage.setItem(STORAGE_KEY, l);
  };

  const t = (key: string, vars?: Record<string, string | number>) => {
    let s = dictionaries[lang][key] ?? dictionaries.th[key] ?? key;
    if (vars) for (const k in vars) s = s.replaceAll(`{${k}}`, String(vars[k]));
    return s;
  };

  return <Ctx.Provider value={{ lang, setLang, t }}>{children}</Ctx.Provider>;
}

export function useI18n() {
  const c = useContext(Ctx);
  if (!c) {
    // Safe fallback so non-wrapped trees (e.g. admin pages) don't crash.
    return {
      lang: "th" as Lang,
      setLang: () => {},
      t: (key: string, vars?: Record<string, string | number>) => {
        let s = dictionaries.th[key] ?? key;
        if (vars) for (const k in vars) s = s.replaceAll(`{${k}}`, String(vars[k]));
        return s;
      },
    };
  }
  return c;
}

export function flagFor(nat: string | null | undefined): string {
  switch (nat?.toLowerCase()) {
    case "thai":
      return "🇹🇭";
    case "burmese":
    case "myanmar":
      return "🇲🇲";
    case "lao":
      return "🇱🇦";
    case "khmer":
    case "cambodian":
      return "🇰🇭";
    default:
      return "👤";
  }
}

export function initialsOf(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}
