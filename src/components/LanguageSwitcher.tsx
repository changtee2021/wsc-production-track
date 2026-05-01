import { Button } from "@/components/ui/button";
import { Languages } from "lucide-react";
import { useI18n } from "@/lib/i18n";

export function LanguageSwitcher() {
  const { lang, setLang } = useI18n();
  return (
    <Button
      variant="secondary"
      size="sm"
      className="gap-1"
      onClick={() => setLang(lang === "th" ? "my" : "th")}
      title={lang === "th" ? "เปลี่ยนเป็นภาษาพม่า" : "ထိုင်းဘာသာသို့ ပြောင်းရန်"}
    >
      <Languages className="h-4 w-4" />
      <span className="font-semibold">{lang === "th" ? "🇹🇭 ไทย" : "🇲🇲 မြန်မာ"}</span>
    </Button>
  );
}
