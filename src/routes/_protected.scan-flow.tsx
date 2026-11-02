// Design preview: playable new scan UI. It does not write production logs.
import { createFileRoute } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { ScanFlowPrototype } from "@/components/ScanFlowPrototype";
import {
  ArrowRight,
  Bell,
  CreditCard,
  ListChecks,
  Play,
  ScanLine,
  Square,
  Timer,
  UserCheck,
  UserRound,
  Users,
  Check,
  Clock,
  Layers,
  QrCode,
  Wrench,
  Camera,
  AlertTriangle,
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
    <div className="h-[24rem] w-[9.75rem] shrink-0 overflow-hidden">
      <div className="w-[17rem] origin-top-left scale-[0.56]">
        <div className="mb-3 flex items-center gap-2.5">
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
        <div className="rounded-[2rem] border-4 border-slate-800 bg-slate-800 p-1.5 shadow-lg dark:border-slate-600 dark:bg-slate-600">
          <div className="flex h-[36rem] flex-col overflow-hidden rounded-[1.5rem] bg-background">
            <div className="flex items-center justify-between bg-primary px-4 py-2 text-[11px] font-semibold text-primary-foreground">
              <span>WSC ProductionTrack</span>
              <span>🇹🇭 ไทย</span>
            </div>
            <div className="flex flex-1 flex-col gap-3 p-4">{children}</div>
          </div>
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

function StepArrow() {
  return <ArrowRight className="h-5 w-5 shrink-0 text-slate-400" aria-hidden />;
}

function PhoneSteps() {
  return (
    <div className="flex min-w-0 items-center gap-1.5 overflow-x-auto pb-1">
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
        <div className="flex gap-1.5">
          <div className="flex h-11 flex-1 items-center rounded-xl border bg-background px-2.5 text-[11px] text-muted-foreground">
            หรือพิมพ์เลขพนักงาน
          </div>
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border bg-background">
            <Check className="h-4 w-4" />
          </div>
        </div>
      </Phone>
      <StepArrow />

      <Phone
        n={2}
        title="เลือกหมวด ขั้นตอน แล้วสแกนงาน"
        sub="ชื่อค้างอยู่ แล้วกดเริ่มงาน"
        tone="sky"
      >
        <div className="flex items-center gap-2 rounded-xl bg-sky-50 px-3 py-2 text-xs font-medium text-sky-700 dark:bg-sky-950/40 dark:text-sky-300">
          <UserRound className="h-4 w-4" /> สมชาย · ค้างทั้งวันนี้
        </div>
        <FakeSelect
          icon={<Layers className="h-3.5 w-3.5" />}
          label="หมวดหมู่งานม่าน"
          value="ม่านจีบ"
        />
        <FakeSelect
          icon={<ListChecks className="h-3.5 w-3.5" />}
          label="ขั้นตอนการผลิต"
          value="ตัดผ้า"
        />
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
      <StepArrow />

      <Phone
        n={3}
        title="กดเริ่มแล้ว อยู่หน้าเดิม"
        sub="นาฬิกาโผล่ ปุ่มเสร็จงานกดได้"
        tone="emerald"
      >
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
        <div className="rounded-2xl border bg-card p-3">
          <div className="flex min-h-11 items-center gap-2 text-sm font-semibold">
            <span className="flex h-5 w-5 items-center justify-center rounded bg-red-600 text-[10px] text-white">
              ✓
            </span>
            <AlertTriangle className="h-4 w-4 text-destructive" />
            มีปัญหา? เพิ่มหมายเหตุก่อนจบงาน
          </div>
          <div className="mt-2 rounded-lg border bg-background px-2 py-2 text-xs text-muted-foreground">
            อธิบายปัญหาที่พบ…
          </div>
          <div className="mt-2 flex h-11 items-center justify-center gap-1 rounded-xl border text-sm font-semibold">
            <Camera className="h-4 w-4" /> เพิ่มรูปภาพ
          </div>
        </div>
        <div className="mt-auto flex h-14 items-center justify-center gap-2 rounded-2xl bg-slate-900 text-base font-bold text-white">
          <Square className="h-5 w-5 fill-current" /> เสร็จงาน
        </div>
      </Phone>
      <StepArrow />

      <Phone
        n={4}
        title="กดเสร็จแล้ว อยู่หน้าเดิม"
        sub="นาฬิกาหาย รหัสงานว่าง ชื่อยังอยู่"
        tone="blue"
      >
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

function StepChip({ name, hint, last }: { name: string; hint?: string; last?: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-1 text-xs font-semibold ${
        last ? "bg-slate-900 text-white" : "border bg-card"
      }`}
    >
      {name}
      {hint && (
        <span
          className={`text-[10px] font-medium ${last ? "text-white/70" : "text-muted-foreground"}`}
        >
          {hint}
        </span>
      )}
    </span>
  );
}

function FlowArrow() {
  return <ArrowRight className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />;
}

function StepNo({ n }: { n: number }) {
  return (
    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-900 text-[11px] font-bold text-white">
      {n}
    </span>
  );
}

function manualSteps(names: string[]): ReactNode[] {
  return [
    ...names.map((name) => <StepChip key={name} name={name} />),
    <StepChip key="qc" name="QCตรวจ" hint="ขั้นก่อนต้องจบ" />,
    <StepChip key="pack" name="PACK" hint="รอ QC" last />,
  ];
}

function NumberedFlow({ steps }: { steps: ReactNode[] }) {
  return (
    <>
      {steps.map((step, index) => (
        <span key={index} className="inline-flex shrink-0 items-center gap-1">
          {index > 0 && <FlowArrow />}
          <StepNo n={index + 1} />
          {step}
        </span>
      ))}
    </>
  );
}

function CategoryOrder() {
  const rows: {
    name: string;
    count: string;
    fact: string;
    tone: Tone;
    steps: ReactNode[];
    note?: string;
  }[] = [
    {
      name: "ม่านม้วน",
      count: "ตามคู่มือ",
      fact: "7 ขั้น จบที่แพ็ค",
      tone: "sky",
      steps: manualSteps([
        "เตรียมชุดผ้า",
        "เตรียมโซ่/หัวเกียร์",
        "ตัดราง/ถ่วงล่าง",
        "ประกอบ",
        "ตั้งชื่อ",
      ]),
    },
    {
      name: "มู่ลี่ไม้",
      count: "ตามคู่มือ",
      fact: "7 ขั้น จบที่แพ็ค",
      tone: "violet",
      steps: manualSteps(["เตรียมไม้", "เตรียมเทปผ้า/โซ่", "เตรียมราง", "ประกอบ", "ตั้งชื่อ"]),
      note: "กรณีติดบังราง ทำเพิ่มตอนประกอบ",
    },
    {
      name: "มู่ลี่อลูมิเนียม",
      count: "ตามคู่มือ",
      fact: "7 ขั้น จบที่แพ็ค",
      tone: "blue",
      steps: manualSteps([
        "เตรียมชุดอลูมิเนียม",
        "เตรียมเทปผ้า/โซ่",
        "เตรียมราง",
        "ประกอบ",
        "ตั้งชื่อ",
      ]),
      note: "กรณีติดบังราง ทำเพิ่มตอนประกอบ",
    },
    {
      name: "ม่านปรับแสง",
      count: "ตามคู่มือ",
      fact: "หน้าละเอียด แล้ว QC",
      tone: "amber",
      steps: manualSteps([
        "ติดลูกกลิ้งกับราง",
        "ตั้งเครื่องตัดผ้า",
        "ตัดผ้า",
        "เจาะรู",
        "ติดเทปที่ไม้",
        "ซีลผ้า",
        "ติดผ้ากับตัวล็อค",
      ]),
    },
  ];

  return (
    <div className="mt-4 space-y-2">
      <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-6 rounded-full border bg-card" />
          เรียงตามคู่มือ ขั้นก่อนไม่จบไปต่อไม่ได้
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-6 rounded-full bg-slate-900" />
          PACK ขั้นสุดท้าย
        </span>
        <span>ขั้นตอนไม่จบ QC ต่อไม่ได้ · QC ไม่เสร็จ แพ็คไม่ได้</span>
      </div>
      {rows.map((row) => (
        <div
          key={row.name}
          className="flex w-full min-w-0 items-center gap-2 rounded-2xl border bg-card px-3 py-2.5"
        >
          <div className={`w-32 shrink-0 rounded-xl px-2.5 py-2 ${TONE[row.tone].box}`}>
            <p className={`text-sm font-bold leading-tight ${TONE[row.tone].text}`}>{row.name}</p>
            <p className="text-[11px] text-muted-foreground">{row.count}</p>
            <p className="text-[11px] font-medium text-foreground/80">{row.fact}</p>
          </div>
          <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto">
            <div className="flex w-max items-center gap-1.5">
              <NumberedFlow steps={row.steps} />
              {row.note && (
                <span className="whitespace-nowrap text-[11px] text-muted-foreground">
                  {row.note}
                </span>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function ScanFlowPage() {
  return (
    <main className="mx-auto min-w-0 w-full max-w-7xl px-4 py-6">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <ScanLine className="h-6 w-6 text-primary" /> โฟลว์สแกนโหมดสถานี
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          ลองกดเล่นหน้าจอใหม่ได้ด้านล่าง ยังไม่บันทึกงานจริง · สแกนบัตรก่อน ชื่อค้างทั้งวัน ·
          กดเริ่มงานแล้วอยู่หน้าเดิม นาฬิกาขึ้น และกดเสร็จงานก่อนถึงสแกนงานต่อไปได้
        </p>
      </header>

      <Section title="ลองกดเล่น" sub="หน้าจอใหม่บนมือถือ กดสแกนบัตร เลือกหมวด แล้วเริ่มงานได้เลย">
        <ScanFlowPrototype />
      </Section>

      {/* 0. Phone UI preview */}
      <Section
        title="หน้าจอมือถือ 4 ขั้นตอน"
        sub="กดเริ่มงานแล้วไม่เปลี่ยนหน้า นาฬิกากับปุ่มเสร็จงานโผล่บนฟอร์มเดิม"
      >
        <div className="rounded-2xl border bg-card p-4 sm:p-6">
          <PhoneSteps />
        </div>
        <CategoryOrder />
      </Section>

      <Section title="สรุปแล้ว" sub="กติกาที่ตกลงไว้ และลำดับตามคู่มือการประกอบ">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {[
            {
              i: <Bell className="h-5 w-5" />,
              t: "ยังไม่กดเสร็จ แล้วจะรับงานใหม่",
              a: "บังคับบนเครื่องตัวเอง ต้องกดเสร็จก่อน คนต่อไปกดเริ่มไม่ได้ พอสแกนจะขึ้นว่าคนก่อนหน้ายังไม่กดจบงาน",
              tone: "amber" as Tone,
            },
            {
              i: <Timer className="h-5 w-5" />,
              t: "งานค้างนาน",
              a: "ระบบไม่ปิดให้ กดเสร็จเมื่อทำงานจบ",
              tone: "sky" as Tone,
            },
            {
              i: <UserCheck className="h-5 w-5" />,
              t: "หัวหน้าปลดล็อก",
              a: "สแกนบัตรเหมือนพนักงาน แอดมินล็อกอินแบบเดิม",
              tone: "emerald" as Tone,
            },
            {
              i: <Users className="h-5 w-5" />,
              t: "ใบงานเดียว หลายคน",
              a: "ได้ คนละเครื่อง แต่คนต่อไปเริ่มได้เมื่อคนก่อนหน้ากดเสร็จแล้ว",
              tone: "blue" as Tone,
            },
            {
              i: <ListChecks className="h-5 w-5" />,
              t: "ขั้นที่ต้องรอ",
              a: "เรียงตามคู่มือ ขั้นก่อนไม่จบไปต่อไม่ได้ ขั้นตอนไม่จบ QC ต่อไม่ได้ QC ไม่เสร็จ แพ็คไม่ได้",
              tone: "violet" as Tone,
            },
            {
              i: <Smartphone className="h-5 w-5" />,
              t: "มือถือ",
              a: "ใช้มือถือส่วนตัวของแต่ละคน ไม่มีเครื่องกลาง",
              tone: "red" as Tone,
            },
            {
              i: <Wrench className="h-5 w-5" />,
              t: "บัตรหายหรือลืมพก",
              a: "แจ้งหัวหน้างาน นอกระบบ ไม่ทำในแอป",
              tone: "slate" as Tone,
            },
          ].map((d) => (
            <div
              key={d.t}
              className={`flex items-start gap-3 rounded-2xl border p-3 ${TONE[d.tone].box}`}
            >
              <IconBadge tone={d.tone}>{d.i}</IconBadge>
              <div>
                <p className={`text-sm font-medium ${TONE[d.tone].text}`}>{d.t}</p>
                <p className="mt-0.5 text-xs leading-5 text-slate-600">{d.a}</p>
              </div>
            </div>
          ))}
        </div>
      </Section>
    </main>
  );
}
