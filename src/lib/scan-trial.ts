export type TrialFlowId = "roller" | "wood" | "aluminum" | "shade";

export type TrialFlow = {
  id: TrialFlowId;
  label: string;
  lanes: string[][];
  after: string[];
};

export const TRIAL_JOBS: { jobId: string; flow: TrialFlowId }[] = [
  { jobId: "123", flow: "roller" },
  { jobId: "456", flow: "wood" },
  { jobId: "789", flow: "aluminum" },
  { jobId: "111", flow: "shade" },
];

export const TRIAL_FLOWS: TrialFlow[] = [
  {
    id: "roller",
    label: "ม่านม้วน",
    lanes: [["ตัดผ้า"], ["ตัดราง", "ประกอบราง"], ["เตรียมโซ่/หัวเกียร์"]],
    after: ["ประกอบ", "หัว", "QC", "PACK"],
  },
  {
    id: "wood",
    label: "มู่ลี่ไม้",
    lanes: [
      ["เปิดไม้", "ตัดใบ", "เก็บสี", "เจาะใบ"],
      ["ตัดราง", "เจาะราง", "ประกอบราง"],
      ["ตัดเทป/เตรียมโซ่"],
    ],
    after: ["ประกอบชุด", "หัว", "QC", "PACK"],
  },
  {
    id: "aluminum",
    label: "มู่ลี่อลูมิเนียม",
    lanes: [["ตัดใบ"], ["ตัดราง", "ประกอบราง"]],
    after: ["ประกอบชุด", "หัว", "QC", "PACK"],
  },
  {
    id: "shade",
    label: "ม่านปรับแสง",
    lanes: [["ตัดผ้า", "เจาะผ้า"], ["ตัดราง", "ประกอบราง"], ["เตรียมโซ่/หัวเกียร์"]],
    after: ["หัว", "QC", "PACK"],
  },
];

export type TrialRun = {
  jobId: string;
  flow: TrialFlowId;
  step: string;
  employeeId: string;
  employeeName: string;
  status: "running" | "done";
  startedAt: number;
  finishedAt: number | null;
};

const STORAGE_KEY = "wsc:scan-trial:v1";

export function flowById(id: TrialFlowId): TrialFlow {
  const flow = TRIAL_FLOWS.find((row) => row.id === id);
  if (!flow) throw new Error(`Unknown trial flow: ${id}`);
  return flow;
}

export function trialJob(jobId: string): { jobId: string; flow: TrialFlow } | null {
  const match = TRIAL_JOBS.find((row) => row.jobId === jobId.trim());
  if (!match) return null;
  return { jobId: match.jobId, flow: flowById(match.flow) };
}

const STEP_MY: Record<string, string> = {
  ตัดผ้า: "အထည်ဖြတ်",
  เจาะผ้า: "အထည်ဖောက်",
  ตัดราง: "ရထားဖြတ်",
  เจาะราง: "ရထားဖောက်",
  ประกอบราง: "ရထားတပ်",
  "เตรียมโซ่/หัวเกียร์": "သံကြိုး/ဂီယာပြင်",
  ประกอบ: "တပ်ဆင်",
  ประกอบชุด: "အစုံတပ်",
  หัว: "ခေါင်းတပ်",
  เปิดไม้: "သစ်ဖွင့်",
  ตัดใบ: "ရွက်ဖြတ်",
  เก็บสี: "အရောင်တင်",
  เจาะใบ: "ရွက်ဖောက်",
  "ตัดเทป/เตรียมโซ่": "တိပ်ဖြတ်/သံကြိုးပြင်",
  QC: "စစ်ဆေး",
  PACK: "ထုပ်ပိုး",
};

export function stepLabel(name: string): string {
  const burmese = STEP_MY[name];
  return burmese ? `${name} I ${burmese}` : name;
}

export function flowSteps(flow: TrialFlow): string[] {
  return [...flow.lanes.flat(), ...flow.after];
}

export function loadTrialRuns(): TrialRun[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as TrialRun[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveTrialRuns(runs: TrialRun[]) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(runs));
}

export function canStartTrial(input: {
  runs: TrialRun[];
  jobId: string;
  flow: TrialFlow;
  step: string;
  employeeId: string;
}): { ok: true } | { ok: false; message: string; blocked: string[] } {
  const job = input.runs.filter((run) => run.jobId === input.jobId && run.flow === input.flow.id);
  const unfinished = (name: string) => job.find((run) => run.step === name)?.status !== "done";
  const deny = (message: string, blocked: string[]) => ({ ok: false as const, message, blocked });

  const open = input.runs.find(
    (run) => run.employeeId === input.employeeId && run.status === "running",
  );
  if (open) {
    return deny("เครื่องนี้ยังไม่กดเสร็จงาน ไปขั้นต่อไปไม่ได้", [open.step]);
  }

  const same = job.find((run) => run.step === input.step);
  if (same?.status === "running") {
    return deny("คนก่อนหน้ายังไม่กดจบงาน", [input.step]);
  }
  if (same?.status === "done") {
    return deny("ขั้นนี้จบแล้ว", []);
  }

  for (const lane of input.flow.lanes) {
    const index = lane.indexOf(input.step);
    if (index < 0) continue;
    if (index === 0) return { ok: true };
    const previous = lane[index - 1];
    const previousRun = job.find((run) => run.step === previous);
    if (!previousRun || previousRun.status !== "done") {
      return deny(
        previousRun?.status === "running"
          ? "คนก่อนหน้ายังไม่กดจบงาน"
          : `ขั้น ${stepLabel(previous)} ยังไม่จบ ไปต่อไม่ได้`,
        [previous],
      );
    }
    return { ok: true };
  }

  const afterIndex = input.flow.after.indexOf(input.step);
  if (afterIndex < 0) return deny("ขั้นตอนนี้ไม่อยู่ในโฟลของหมวดนี้", []);

  const waitingLanes = input.flow.lanes.flat().filter(unfinished);
  if (waitingLanes.length > 0) {
    const first = waitingLanes[0];
    const firstRun = job.find((run) => run.step === first);
    return deny(
      firstRun?.status === "running"
        ? "คนก่อนหน้ายังไม่กดจบงาน"
        : `ขั้น ${stepLabel(first)} ยังไม่จบ ไปต่อไม่ได้`,
      waitingLanes,
    );
  }

  if (afterIndex > 0) {
    const previous = input.flow.after[afterIndex - 1];
    const previousRun = job.find((run) => run.step === previous);
    if (!previousRun || previousRun.status !== "done") {
      return deny(
        previousRun?.status === "running"
          ? "คนก่อนหน้ายังไม่กดจบงาน"
          : `ขั้น ${stepLabel(previous)} ยังไม่จบ ไปต่อไม่ได้`,
        [previous],
      );
    }
  }

  return { ok: true };
}
