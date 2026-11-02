// Design preview ONLY: explains the proposed "station mode" scan flow (states + on-screen text).
// Static page — no data, no scanning logic. Used to agree on the flow before building it.
import { createFileRoute } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { StationBadgePreview } from "@/components/StationBadgePreview";
import {
  ArrowDown,
  Bell,
  CircleSlash,
  Copy,
  CreditCard,
  ListChecks,
  Lock,
  Play,
  Repeat,
  ScanLine,
  Search,
  ShieldCheck,
  Square,
  Timer,
  Undo2,
  UserCheck,
  UserRound,
  Users,
  Check,
  Clock,
  Layers,
  QrCode,
  Vibrate,
  Wifi,
  WifiOff,
  Wrench,
  CameraOff,
  Smartphone,
} from "lucide-react";

export const Route = createFileRoute("/_protected/scan-flow")({
  head: () => ({ meta: [{ title: "โฟลว์สแกนโหมดสถานี — WSC ProductionTrack" }] }),
  component: ScanFlowPage,
});

type Tone = "slate" | "sky" | "emerald" | "blue" | "amber" | "red" | "violet";

const TONE: Record<Tone, { box: string; chip: string; text: string; icon: string }> = {
  slate: {
    box: "bg-slate-100 dark:bg-slate-900",
    chip: "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
    text: "text-slate-700 dark:text-slate-200",
    icon: "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
  },
  sky: {
    box: "bg-sky-50 dark:bg-sky-950/40",
    chip: "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
    text: "text-sky-700 dark:text-sky-300",
    icon: "bg-sky-100 text-sky-700 dark:bg-sky-900 dark:text-sky-300",
  },
  emerald: {
    box: "bg-emerald-50 dark:bg-emerald-950/40",
    chip: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
    text: "text-emerald-700 dark:text-emerald-300",
    icon: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300",
  },
  blue: {
    box: "bg-blue-50 dark:bg-blue-950/40",
    chip: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
    text: "text-blue-700 dark:text-blue-300",
    icon: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  },
  amber: {
    box: "bg-amber-50 dark:bg-amber-950/40",
    chip: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
    text: "text-amber-700 dark:text-amber-300",
    icon: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
  },
  red: {
    box: "bg-red-50 dark:bg-red-950/40",
    chip: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
    text: "text-red-700 dark:text-red-300",
    icon: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
  },
  violet: {
    box: "bg-violet-50 dark:bg-violet-950/40",
    chip: "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
    text: "text-violet-800 dark:text-violet-200",
    icon: "bg-violet-100 text-violet-700 dark:bg-violet-900 dark:text-violet-300",
  },
};

function IconBadge({ tone, children }: { tone: Tone; children: ReactNode }) {
  return (
    <span
      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${TONE[tone].icon}`}
    >
      {children}
    </span>
  );
}

// ---------- screen mock (what the worker sees) ----------
function Screen({
  tone,
  icon,
  tag,
  title,
  line,
  sound,
}: {
  tone: Tone;
  icon: ReactNode;
  tag: string;
  title: string;
  line?: string;
  sound?: string;
}) {
  const t = TONE[tone];
  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border bg-card shadow-sm">
      <div className={`flex flex-1 flex-col items-center gap-2 px-5 py-6 text-center ${t.box}`}>
        <span
          className={`mb-1 flex h-16 w-16 items-center justify-center rounded-2xl ${t.icon} [&>svg]:h-9 [&>svg]:w-9`}
        >
          {icon}
        </span>
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${t.chip}`}>{tag}</span>
        <p className={`text-xl font-bold leading-snug ${t.text}`}>{title}</p>
        {line && <p className="text-sm text-foreground/80">{line}</p>}
      </div>
      {sound && <p className="border-t px-4 py-2 text-xs text-muted-foreground">🔔 {sound}</p>}
    </div>
  );
}

// ---------- flow chart pieces ----------
function Down({ label }: { label?: string }) {
  return (
    <div className="flex flex-col items-center py-1 text-muted-foreground">
      {label && <span className="mb-0.5 text-[11px] font-medium">{label}</span>}
      <div className="h-4 w-px bg-border" />
      <ArrowDown className="-mt-1 h-4 w-4" />
    </div>
  );
}

function FlowStart({ label }: { label: string }) {
  return (
    <div className="mx-auto w-fit rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground">
      {label}
    </div>
  );
}

function FlowLoop({ label }: { label: string }) {
  return (
    <div className="mx-auto flex w-fit max-w-full items-center gap-2 rounded-full border-2 border-dashed border-sky-400 px-4 py-2 text-sm font-medium text-sky-700 dark:text-sky-300">
      <Repeat className="h-4 w-4 shrink-0" /> {label}
    </div>
  );
}

function FlowBox({
  tone,
  icon,
  title,
  desc,
}: {
  tone: Tone;
  icon: ReactNode;
  title: string;
  desc?: string;
}) {
  const t = TONE[tone];
  return (
    <div className={`mx-auto flex max-w-md items-center gap-3 rounded-2xl border-2 p-3 ${t.box}`}>
      <IconBadge tone={tone}>{icon}</IconBadge>
      <div>
        <p className={`text-sm font-semibold ${t.text}`}>{title}</p>
        {desc && <p className="text-xs text-muted-foreground">{desc}</p>}
      </div>
    </div>
  );
}

function Branch({
  side,
  label,
  tone,
  icon,
  title,
  desc,
}: {
  side: "left" | "right";
  label: string;
  tone: Tone;
  icon: ReactNode;
  title: string;
  desc?: string;
}) {
  const t = TONE[tone];
  return (
    <div className={`flex items-center ${side === "left" ? "flex-row-reverse" : ""}`}>
      <div className="hidden h-px w-4 shrink-0 bg-border sm:block" />
      <div className={`min-w-0 flex-1 rounded-2xl border-2 p-3 ${t.box}`}>
        <span
          className={`mb-1.5 inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${t.chip}`}
        >
          {label}
        </span>
        <div className="flex items-center gap-2.5">
          <IconBadge tone={tone}>{icon}</IconBadge>
          <div className="min-w-0">
            <p className={`text-sm font-semibold ${t.text}`}>{title}</p>
            {desc && <p className="text-xs text-muted-foreground">{desc}</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

// Decision pill in the centre column; branch cards sit left/right on wide screens
// and stack underneath on narrow ones.
function Decision({
  q,
  icon,
  left,
  right,
}: {
  q: string;
  icon: ReactNode;
  left?: ReactNode;
  right?: ReactNode;
}) {
  const t = TONE.violet;
  return (
    <div className="grid items-center gap-2 sm:grid-cols-[1fr_minmax(15rem,20rem)_1fr]">
      <div className="order-2 sm:order-1">{left}</div>
      <div
        className={`order-1 flex items-center justify-center gap-2.5 rounded-full border-2 border-violet-300 px-4 py-2.5 text-center text-sm font-semibold sm:order-2 dark:border-violet-800 ${t.box} ${t.text}`}
      >
        <span
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${t.icon}`}
        >
          {icon}
        </span>
        {q}
      </div>
      <div className="order-3">{right}</div>
    </div>
  );
}

function Section({ title, sub, children }: { title: string; sub?: string; children: ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-lg font-semibold">{title}</h2>
      {sub && <p className="mt-0.5 text-sm text-muted-foreground">{sub}</p>}
      <div className="mt-3">{children}</div>
    </section>
  );
}

// ---------- phone mock (step-by-step UI preview) ----------
function Phone({
  n,
  title,
  sub,
  tone,
  children,
}: {
  n: number;
  title: string;
  sub: string;
  tone: Tone;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center">
      <div className="mb-3 flex items-center gap-2.5 self-stretch">
        <span
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-base font-bold ${TONE[tone].icon}`}
        >
          {n}
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold leading-tight">{title}</p>
          <p className="text-xs text-muted-foreground">{sub}</p>
        </div>
      </div>
      <div className="w-full max-w-[17rem] rounded-[2rem] border-4 border-slate-800 bg-slate-800 p-1.5 shadow-lg dark:border-slate-600 dark:bg-slate-600">
        <div className="flex h-[36rem] flex-col overflow-hidden rounded-[1.5rem] bg-background">
          <div className="flex items-center justify-between bg-primary px-4 py-2 text-[11px] font-semibold text-primary-foreground">
            <span>WSC ProductionTrack</span>
            <span>🇹🇭 ไทย</span>
          </div>
          <div className="flex flex-1 flex-col gap-3 p-4">{children}</div>
        </div>
      </div>
    </div>
  );
}

function FakeSelect({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div>
      <p className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground">
        {icon} {label}
      </p>
      <div className="flex h-12 items-center justify-between rounded-xl border bg-card px-3 text-sm font-semibold">
        {value}
        <span className="text-muted-foreground">▾</span>
      </div>
    </div>
  );
}

function BigButton({ tone, children }: { tone: Tone; children: ReactNode }) {
  const bg: Partial<Record<Tone, string>> = {
    emerald: "bg-emerald-500 text-white",
    blue: "bg-blue-600 text-white",
    sky: "bg-sky-500 text-white",
  };
  return (
    <div
      className={`flex h-14 items-center justify-center gap-2 rounded-2xl text-base font-bold shadow ${bg[tone] ?? "bg-primary text-primary-foreground"}`}
    >
      {children}
    </div>
  );
}

function PhoneSteps() {
  return (
    <div className="grid gap-8 sm:grid-cols-2 xl:grid-cols-4">
      <Phone n={1} title="สแกนบัตรก่อน" sub="ชื่อค้างทั้งวัน ไม่ต้องเลือกใหม่" tone="slate">
        <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed bg-muted/40 text-center">
          <CreditCard className="h-10 w-10 text-primary" />
          <p className="text-sm font-semibold">สแกนบัตรพนักงาน</p>
          <p className="px-4 text-[11px] text-muted-foreground">แทนการกดเลือกชื่อ</p>
        </div>
        <div className="rounded-2xl border bg-card px-3 py-3 text-center">
          <p className="text-[11px] text-muted-foreground">จำชื่อนี้ไว้ทั้งวันนี้</p>
          <p className="text-lg font-bold">สมชาย</p>
        </div>
        <BigButton tone="sky">
          <ScanLine className="h-5 w-5" /> สแกนบัตร
        </BigButton>
      </Phone>

      <Phone n={2} title="เลือกหมวด ขั้นตอน แล้วสแกนงาน" sub="ชื่อค้างอยู่ แล้วกดเริ่มงาน" tone="sky">
        <div className="flex items-center gap-2 rounded-xl bg-sky-50 px-3 py-2 text-xs font-medium text-sky-700 dark:bg-sky-950/40 dark:text-sky-300">
          <UserRound className="h-4 w-4" /> สมชาย · ค้างทั้งวันนี้
        </div>
        <FakeSelect icon={<Layers className="h-3.5 w-3.5" />} label="หมวดหมู่งานม่าน" value="ม่านจีบ" />
        <FakeSelect icon={<ListChecks className="h-3.5 w-3.5" />} label="ขั้นตอนการผลิต" value="ตัดผ้า" />
        <div className="rounded-2xl border bg-card p-3">
          <p className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
            <QrCode className="h-3.5 w-3.5" /> รหัสงาน (JOB ID)
          </p>
          <p className="mt-1.5 text-[11px] font-medium leading-snug text-destructive">
            ยังไม่มีรหัสงาน — กดปุ่ม &quot;สแกน QR&quot; หรือกรอกด้วยตัวเอง
          </p>
          <div className="mt-2 flex h-11 items-center justify-center gap-1.5 rounded-xl bg-blue-600 text-sm font-bold text-white">
            <ScanLine className="h-4 w-4" /> สแกน QR
          </div>
          <div className="mt-2 flex gap-1.5">
            <div className="flex h-11 flex-1 items-center rounded-xl border bg-background px-2.5 text-[11px] text-muted-foreground">
              หรือพิมพ์รหัสงาน เช่น JOB123
            </div>
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border bg-background">
              <Check className="h-4 w-4" />
            </div>
          </div>
        </div>
        <div className="mt-auto">
          <BigButton tone="sky">
            <Play className="h-5 w-5" /> เริ่มงาน
          </BigButton>
        </div>
      </Phone>

      <Phone n={3} title="กดเริ่มแล้ว อยู่หน้าเดิม" sub="นาฬิกาโผล่ ปุ่มเสร็จงานกดได้" tone="emerald">
        <div className="flex items-center gap-2 rounded-xl bg-sky-50 px-3 py-2 text-xs font-medium text-sky-700 dark:bg-sky-950/40 dark:text-sky-300">
          <UserRound className="h-4 w-4" /> สมชาย · ม่านจีบ · ตัดผ้า
        </div>
        <div className="rounded-2xl border bg-card px-3 py-2">
          <p className="text-[11px] text-muted-foreground">รหัสงาน</p>
          <p className="text-lg font-bold text-primary">123</p>
        </div>
        <div className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-sky-400 text-sm font-bold text-white">
          <Play className="h-4 w-4" /> เริ่มงาน
        </div>
        <div className="flex items-center justify-between rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-3 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">
          <span className="flex items-center gap-1.5 text-sm font-semibold">
            <Clock className="h-4 w-4" /> กำลังจับเวลา
          </span>
          <span className="font-mono text-xl font-bold tabular-nums">00:02</span>
        </div>
        <div className="mt-auto flex h-14 items-center justify-center gap-2 rounded-2xl bg-slate-900 text-base font-bold text-white">
          <Square className="h-5 w-5 fill-current" /> เสร็จงาน
        </div>
      </Phone>

      <Phone n={4} title="กดเสร็จแล้ว อยู่หน้าเดิม" sub="นาฬิกาหาย รหัสงานว่าง ชื่อยังอยู่" tone="blue">
        <div className="flex items-center gap-2 rounded-xl bg-sky-50 px-3 py-2 text-xs font-medium text-sky-700 dark:bg-sky-950/40 dark:text-sky-300">
          <UserRound className="h-4 w-4" /> สมชาย · ม่านจีบ · ตัดผ้า
        </div>
        <div className="rounded-2xl border bg-card p-3">
          <p className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
            <QrCode className="h-3.5 w-3.5" /> รหัสงาน (JOB ID)
          </p>
          <p className="mt-1.5 text-[11px] font-medium leading-snug text-destructive">
            ยังไม่มีรหัสงาน — กดปุ่ม &quot;สแกน QR&quot;
          </p>
          <div className="mt-2 flex h-11 items-center justify-center gap-1.5 rounded-xl bg-blue-600 text-sm font-bold text-white">
            <ScanLine className="h-4 w-4" /> สแกน QR
          </div>
        </div>
        <BigButton tone="sky">
          <Play className="h-5 w-5" /> เริ่มงาน
        </BigButton>
        <div className="flex h-14 items-center justify-center gap-2 rounded-2xl bg-slate-400 text-base font-bold text-white">
          <Square className="h-5 w-5 fill-current" /> เสร็จงาน
        </div>
        <div className="mt-auto rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">
          บันทึกการเสร็จงานเรียบร้อย
        </div>
      </Phone>
    </div>
  );
}

function ScanFlowPage() {
  return (
    <main className="mx-auto max-w-7xl px-4 py-6">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <ScanLine className="h-6 w-6 text-primary" /> โฟลว์สแกนโหมดสถานี
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          แบบร่างดูภาพรวม (ยังไม่ใช่หน้าใช้งานจริง) · สแกนบัตรก่อน ชื่อค้างทั้งวัน ·
          กดเริ่มงานแล้วอยู่หน้าเดิม นาฬิกาขึ้น และกดเสร็จงานก่อนถึงสแกนงานต่อไปได้
        </p>
      </header>

      <Section
        title="บัตรพนักงาน"
        sub="ตัวอย่างจากข้อมูลพนักงานจริง 1 คน · บาร์โค้ดด้านล่างคือรหัสพนักงาน"
      >
        <div className="rounded-2xl border bg-[#ece7df] p-6 sm:p-10">
          <StationBadgePreview />
        </div>
      </Section>

      {/* 0. Phone UI preview */}
      <Section
        title="หน้าจอมือถือ 4 ขั้นตอน"
        sub="กดเริ่มงานแล้วไม่เปลี่ยนหน้า นาฬิกากับปุ่มเสร็จงานโผล่บนฟอร์มเดิม"
      >
        <div className="rounded-2xl border bg-card p-4 sm:p-6">
          <PhoneSteps />
        </div>
      </Section>

      {/* 1. Flow chart */}
      <Section title="1. ผังขั้นตอน" sub="อ่านจากบนลงล่าง">
        <div className="mx-auto max-w-3xl rounded-2xl border bg-card p-4 sm:p-8">
          <FlowStart label="เริ่มกะ" />
          <Down />
          <FlowBox
            tone="slate"
            icon={<Smartphone className="h-5 w-5" />}
            title="เปิดแอปจากหน้าจอหลักมือถือ"
            desc="เปิดครั้งเดียว เข้าหน้าสแกนทันที"
          />
          <Down />
          <FlowBox
            tone="slate"
            icon={<CreditCard className="h-5 w-5" />}
            title="สแกนบัตรพนักงานก่อน"
            desc="ชื่อค้างทั้งวัน กล้องไม่ติดให้ใส่รหัส + PIN"
          />
          <Down />
          <FlowBox
            tone="sky"
            icon={<Layers className="h-5 w-5" />}
            title="เลือกหมวดหมู่ แล้วเลือกขั้นตอน"
            desc="ชื่อพนักงานไม่ต้องเลือกใหม่"
          />
          <Down />
          <FlowBox
            tone="slate"
            icon={<ScanLine className="h-5 w-5" />}
            title="กดปุ่มสแกน QR"
            desc="หรือพิมพ์รหัสงานเอง ใช้กล่องเดิม"
          />
          <Down />

          <Decision
            q="รู้จักรหัสไหม?"
            icon={<Search className="h-4 w-4" />}
            right={
              <Branch
                side="right"
                label="ไม่รู้จัก"
                tone="red"
                icon={<CircleSlash className="h-5 w-5" />}
                title="ไม่พบรหัส"
                desc="สแกนใหม่ · พิมพ์เลขใบงาน · หรือเรียกหัวหน้า"
              />
            }
          />
          <Down label="รู้จัก" />

          <Decision
            q="สแกนซ้ำเร็วไปไหม?"
            icon={<Copy className="h-4 w-4" />}
            right={
              <Branch
                side="right"
                label="ซ้ำ"
                tone="slate"
                icon={<Copy className="h-5 w-5" />}
                title="สแกนไปแล้ว"
                desc="ไม่บันทึกซ้ำ"
              />
            }
          />
          <Down label="ไม่ซ้ำ" />

          <Decision
            q="ขั้นก่อนหน้าจบแล้วไหม?"
            icon={<ListChecks className="h-4 w-4" />}
            right={
              <Branch
                side="right"
                label="ยังไม่จบ"
                tone="amber"
                icon={<Lock className="h-5 w-5" />}
                title="รอขั้นก่อนหน้า"
                desc="รอเพื่อน หรือเรียกหัวหน้า"
              />
            }
          />
          <Down label="จบแล้ว" />

          <FlowBox
            tone="emerald"
            icon={<Play className="h-5 w-5" />}
            title="กดเริ่มงาน อยู่หน้าเดิม"
            desc="นาฬิกาโผล่ใต้ปุ่มเริ่ม ปุ่มเสร็จงานกดได้ เวลานับต่อ"
          />
          <Down />
          <Decision
            q="กดปุ่มเสร็จงานหรือยัง?"
            icon={<Square className="h-4 w-4" />}
            right={
              <Branch
                side="right"
                label="ยังไม่กด"
                tone="amber"
                icon={<Lock className="h-5 w-5" />}
                title="ล็อกงานนี้ไว้"
                desc="คนเดิม คนถัดไป และขั้นถัดไป สแกนงานใหม่ไม่ได้ เวลานับต่อไป"
              />
            }
          />
          <Down label="กดเสร็จแล้ว เวลาหยุด อยู่หน้าเดิม" />

          <Decision
            q="มีอินเทอร์เน็ตไหม?"
            icon={<Wifi className="h-4 w-4" />}
            right={
              <Branch
                side="right"
                label="ไม่มีเน็ต"
                tone="amber"
                icon={<WifiOff className="h-5 w-5" />}
                title="เก็บไว้ในเครื่อง"
                desc="ส่งให้เองเมื่อมีเน็ต"
              />
            }
          />
          <Down label="มีเน็ต" />

          <FlowBox
            tone="sky"
            icon={<Vibrate className="h-5 w-5" />}
            title="โชว์ผล + สั่น + เสียง"
            desc="3 วินาที"
          />
          <Down />
          <FlowLoop label="รหัสงานว่างบนหน้าเดิม สแกน QR งานต่อไปได้ ชื่อหมวดขั้นตอนยังอยู่" />
        </div>
      </Section>

      {/* 2. Normal screens */}
      <Section title="2. หน้าจอที่พนักงานเห็น" sub="ปกติ">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Screen
            tone="slate"
            icon={<CreditCard />}
            tag="ต้นวัน"
            title="สแกนบัตรพนักงาน"
            line="ชื่อค้างทั้งวัน"
            sound="เสียงสั้น 1 ครั้ง"
          />
          <Screen
            tone="sky"
            icon={<UserRound />}
            tag="พร้อมเริ่ม"
            title="สมชาย · ม่านจีบ · ตัดผ้า"
            line="สแกนรหัสงาน แล้วกดเริ่มงาน"
          />
          <Screen
            tone="emerald"
            icon={<Play />}
            tag="กำลังทำ"
            title="นาฬิกาขึ้นบนหน้าเดิม"
            line="ปุ่มเสร็จงานกดได้ ยังสแกนงานใหม่ไม่ได้"
            sound="ปิ๊บตอนเริ่ม"
          />
          <Screen
            tone="blue"
            icon={<Square />}
            tag="กดเสร็จแล้ว"
            title="อยู่หน้าเดิม"
            line="นาฬิกาหาย รหัสงานว่าง ชื่อกับขั้นตอนยังอยู่"
            sound="ปิ๊บ-ปิ๊บ"
          />
        </div>
      </Section>

      {/* 3. Problem screens */}
      <Section title="3. หน้าจอเมื่อมีปัญหา" sub="บอกว่าต้องทำอะไรต่อ">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <Screen
            tone="amber"
            icon={<Lock />}
            tag="ยังไม่กดจบงาน"
            title="จบงานนี้ก่อน"
            line="คนเดิม คนถัดไป และขั้นถัดไป สแกนงานใหม่ไม่ได้"
            sound="เสียงต่ำ 1 ครั้ง · เวลานับต่อ"
          />
          <Screen
            tone="amber"
            icon={<Timer />}
            tag="ระบบปิดให้"
            title="ปิดขั้นก่อนให้แล้ว"
            line="ทำงานต่อได้เลย"
            sound="ป้าย “ไม่ได้สแกน” ส่งให้หัวหน้า"
          />
          <Screen
            tone="red"
            icon={<CircleSlash />}
            tag="ไม่รู้จักรหัส"
            title="ไม่พบรหัสนี้"
            line="สแกนใหม่ หรือพิมพ์เลขใบงาน"
            sound="เสียงเตือน 2 ครั้ง"
          />
          <Screen
            tone="slate"
            icon={<Copy />}
            tag="สแกนซ้ำ"
            title="สแกนไปแล้ว"
            line="ไม่บันทึกซ้ำ"
          />
          <Screen
            tone="slate"
            icon={<Undo2 />}
            tag="ยกเลิก"
            title="ยกเลิกแล้ว"
            line="ทำได้ภายใน 10 วินาที"
          />
          <Screen
            tone="amber"
            icon={<ShieldCheck />}
            tag="หัวหน้าปลดล็อก"
            title="หัวหน้าอนุมัติ"
            line="เลือกเหตุผล: เครื่องเสีย · ลืมสแกน"
            sound="บันทึกชื่อหัวหน้าทุกครั้ง"
          />
          <Screen
            tone="amber"
            icon={<WifiOff />}
            tag="ไม่มีอินเทอร์เน็ต"
            title="บันทึกไว้ในเครื่องแล้ว"
            line="จะส่งเองเมื่อมีเน็ต"
            sound="แถบเหลืองบนหน้าจอ · งานไม่หาย"
          />
          <Screen
            tone="slate"
            icon={<CameraOff />}
            tag="กล้องไม่ติด"
            title="พิมพ์รหัสแทน"
            line="รหัสพนักงาน + PIN · เลขใบงาน"
          />
          <Screen
            tone="sky"
            icon={<Smartphone />}
            tag="มือถือกลางสถานี"
            title="ใช้เครื่องกลางได้"
            line="สแกนบัตรตัวเองก่อนใช้"
            sound="สำรองเมื่อมือถือส่วนตัวใช้ไม่ได้"
          />
        </div>
      </Section>

      {/* 4. Decisions */}
      <Section title="4. ต้องตัดสินใจก่อนสร้าง">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {[
            {
              i: <Bell className="h-5 w-5" />,
              t: "เริ่มแบบ “เตือน” หรือ “บังคับ”?",
              tone: "amber" as Tone,
            },
            {
              i: <Timer className="h-5 w-5" />,
              t: "ค้างนานแค่ไหนให้ระบบปิดให้?",
              tone: "sky" as Tone,
            },
            {
              i: <UserCheck className="h-5 w-5" />,
              t: "หัวหน้าปลดล็อกด้วยบัตรหรือ PIN?",
              tone: "emerald" as Tone,
            },
            {
              i: <Users className="h-5 w-5" />,
              t: "ใบงานเดียว ทำได้หลายคนไหม?",
              tone: "blue" as Tone,
            },
            {
              i: <ListChecks className="h-5 w-5" />,
              t: "ขั้นไหนต้องรอขั้นก่อนหน้า?",
              tone: "violet" as Tone,
            },
            {
              i: <Smartphone className="h-5 w-5" />,
              t: "มือถือกลางสำรอง กี่เครื่องต่อไลน์?",
              tone: "red" as Tone,
            },
            {
              i: <Wrench className="h-5 w-5" />,
              t: "บัตรหาย/ลืมพก ทำอย่างไร?",
              tone: "slate" as Tone,
            },
          ].map((d) => (
            <div
              key={d.t}
              className={`flex items-center gap-3 rounded-2xl border p-3 ${TONE[d.tone].box}`}
            >
              <IconBadge tone={d.tone}>{d.i}</IconBadge>
              <p className={`text-sm font-medium ${TONE[d.tone].text}`}>{d.t}</p>
            </div>
          ))}
        </div>
      </Section>
    </main>
  );
}
