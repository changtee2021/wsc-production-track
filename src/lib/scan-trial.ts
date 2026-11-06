export type TrialFlowId = "roller" | "wood" | "aluminum" | "shade";

/** Wood QC after the timber is issued, before the slats are cut. */
export const WOOD_ISSUE_QC_STEP = "QC ไม้ที่เบิก";

export const WOOD_ISSUE_QC_ITEMS = [
  { id: "wood-qc-color", item_text: "เช็คสี", item_order: 1 },
  { id: "wood-qc-defect", item_text: "เช็คตำหนิ", item_order: 2 },
  { id: "wood-qc-bend", item_text: "ไม้งอหรือไม่", item_order: 3 },
] as const;

export type ScanLane = "v1" | "v2";

/** Office-released jobs stay on v2. Everything else stays on the original scan. */
export function scanLaneDecision(lane: ScanLane, released: boolean): "open" | "blocked" {
  if (lane === "v2") return released ? "open" : "blocked";
  return released ? "blocked" : "open";
}

export function scanLaneBlockMessage(lane: ScanLane): string {
  return lane === "v2"
    ? "ออเดอร์นี้ยังไม่ถูกออฟฟิศส่งเข้าสแกน v2 ใช้ออฟฟิศคีย์ก่อน หรือใช้สแกนเดิม"
    : "ออเดอร์นี้ถูกส่งเข้าสแกน v2 แล้ว ให้พนักงานใช้สแกน v2";
}

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
      ["เบิกไม้", WOOD_ISSUE_QC_STEP, "ตัดใบ", "เก็บสี", "เจาะใบ"],
      ["ตัดราง", "เจาะราง", "ประกอบราง"],
      ["ตัดเทป/เตรียมโซ่"],
    ],
    after: ["ประกอบชุด", "ตั้งงาน", "QC", "PACK"],
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

export function trialProductLabel(id: string | null | undefined): string {
  return TRIAL_FLOWS.find((flow) => flow.id === id)?.label ?? "ไม่ระบุสินค้า";
}

/** Match a production category name such as "2.ม่านม้วน ကုလားကာ" to a flow. */
export function flowForProductName(name: string): TrialFlow | undefined {
  const body = name.replace(/^\d+\.\s*/, "").trim();
  const thai = body.match(/^[\u0E00-\u0E7F0-9.\s/()-]+/)?.[0]?.trim() ?? body;
  return TRIAL_FLOWS.find((flow) => thai === flow.label || thai.startsWith(flow.label));
}

/** A manual belongs on a flow step when its title or production step says that step. */
export function manualMatchesFlowStep(flowStep: string, text: string): boolean {
  if (flowStep === "ประกอบ") return /ประกอบ/.test(text) && !/ประกอบราง|ประกอบชุด/.test(text);
  if (flowStep === "หัว") return /หัว/.test(text) && !/หัวเกียร์/.test(text);
  if (flowStep === "เบิกไม้") return /เบิกไม้|เปิดไม้/.test(text);
  return text.includes(flowStep);
}

export function bestFlowStep(flow: TrialFlow, text: string): string | null {
  const names = [...flow.lanes.flat(), ...flow.after].sort((a, b) => b.length - a.length);
  return names.find((name) => manualMatchesFlowStep(name, text)) ?? null;
}

export const BATCH_STEPS = ["เบิกไม้", "ตัดใบ", "ตัดราง"] as const;
export type BatchStep = (typeof BATCH_STEPS)[number];

export const BATCH_STEP_LABELS: Record<BatchStep, string> = {
  เบิกไม้: "Issue wood",
  ตัดใบ: "Cut slats",
  ตัดราง: "Cut rail",
};

/** Roller-blind staff who may batch-scan. Everyone else stays on one-QR scan. */
export const BATCH_SCAN_EMP_CODES = [
  "66090018",
  "66090021",
  "66090022",
  "66090023",
  "66100027",
  "68040039",
  "69050053",
  "68060045",
  "68060058",
  "68070067",
  "68080080",
  "68080083",
  "68080084",
  "68110103",
  "69010013",
  "69020022",
  "69030032",
  "69030035",
  "69030036",
  "69080081",
  "69090087",
] as const;

const BATCH_SCAN_EMP_CODE_SET = new Set<string>(BATCH_SCAN_EMP_CODES);

export function canUseBatchScan(empCode: string | null | undefined): boolean {
  return BATCH_SCAN_EMP_CODE_SET.has((empCode ?? "").trim());
}

export function isBatchStep(step: string): step is BatchStep {
  return (BATCH_STEPS as readonly string[]).includes(step);
}

export type TrialRun = {
  jobId: string;
  flow: TrialFlowId;
  step: string;
  employeeId: string;
  employeeName: string;
  status: "held" | "running" | "done";
  startedAt: number;
  finishedAt: number | null;
  batchId?: string | null;
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

const STEP_EN: Record<string, string> = {
  ตัดผ้า: "Cut fabric",
  เจาะผ้า: "Punch fabric",
  ตัดราง: "Cut rail",
  เจาะราง: "Drill rail",
  ประกอบราง: "Assemble rail",
  "เตรียมโซ่/หัวเกียร์": "Prep chain / gear",
  ประกอบ: "Assemble",
  ประกอบชุด: "Assemble set",
  หัว: "Fit head",
  เบิกไม้: "Issue wood",
  [WOOD_ISSUE_QC_STEP]: "Check issued wood",
  ตัดใบ: "Cut slats",
  เก็บสี: "Finish colour",
  เจาะใบ: "Drill slats",
  "ตัดเทป/เตรียมโซ่": "Cut tape / prep chain",
  ตั้งงาน: "Set up",
};

/** Burmese labels stay for the manual when the reader picks Myanmar. */
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
  เบิกไม้: "သစ်ထုတ်",
  [WOOD_ISSUE_QC_STEP]: "ထုတ်သစ်စစ်",
  เปิดไม้: "သစ်ဖွင့်",
  ตัดใบ: "ရွက်ဖြတ်",
  เก็บสี: "အရောင်တင်",
  เจาะใบ: "ရွက်ဖောက်",
  "ตัดเทป/เตรียมโซ่": "တိပ်ဖြတ်/သံကြိုးပြင်",
  ตั้งงาน: "အလုပ်စီစဉ်",
  QC: "စစ်ဆေး",
  PACK: "ထုပ်ပိုး",
};

const PLAIN_STEPS = new Set(["QC", "PACK"]);

/** Older scans stored the wood issue step under its previous name. */
const STEP_DONE_ALIASES: Record<string, readonly string[]> = {
  เบิกไม้: ["เปิดไม้"],
};

function matchingDoneRun(runs: TrialRun[], step: string): TrialRun | undefined {
  const names = new Set([step, ...(STEP_DONE_ALIASES[step] ?? [])]);
  return runs.find((run) => names.has(run.step) && run.status === "done");
}

/** Scan shows Thai then English. QC and PACK stay as a single name. */
export function stepLabel(name: string, script: "en" | "my" = "en"): string {
  if (script === "en" && PLAIN_STEPS.has(name)) return name;
  const second = (script === "my" ? STEP_MY : STEP_EN)[name];
  return second ? `${name} I ${second}` : name;
}

/** Same departments as the staff menu. Badge login must see every one of them. */
export const TRIAL_STAFF_SOURCES = [
  "production",
  "qc",
  "packing",
  "maintenance",
  "office",
  "stock",
  "warehouse",
  "transport",
] as const;

export type TrialStaffSource = (typeof TRIAL_STAFF_SOURCES)[number];

export type TrialStaffRow = {
  id: string;
  name: string;
  emp_code: string | null;
  avatar_url: string | null;
  source: TrialStaffSource;
};

export type TrialDesk = "production" | "office" | "qc" | "packing" | "final";

export type TrialBadgePerson = {
  id: string;
  name: string;
  emp_code: string;
  avatar_url: string | null;
  /**
   * QC and packing are the last stations, so those badges do not use the
   * floor step list. `final` is only when one badge is in both.
   */
  department: TrialDesk;
};

const FLOOR_SOURCES: readonly TrialStaffSource[] = [
  "production",
  "maintenance",
  "stock",
  "warehouse",
  "transport",
];

export function trialDesk(sources: readonly TrialStaffSource[]): TrialDesk {
  const present = new Set(sources);
  if (FLOOR_SOURCES.some((source) => present.has(source))) return "production";
  if (present.has("qc") && present.has("packing")) return "final";
  if (present.has("qc")) return "qc";
  if (present.has("packing")) return "packing";
  if (present.has("office")) return "office";
  return "production";
}

/** Floor staff do not start the wood-issue QC. That checklist belongs to the QC desk. */
export function floorFlowSteps(flow: TrialFlow): string[] {
  return flowSteps(flow).filter((name) => name !== WOOD_ISSUE_QC_STEP);
}

/** Steps this badge may see. QC and packing never see earlier production steps. */
export function trialVisibleSteps(department: TrialDesk, flow: TrialFlow): string[] {
  if (department === "qc") return ["QC"];
  if (department === "packing") return ["PACK"];
  if (department === "final") return ["QC", "PACK"];
  if (department === "office") return [];
  return floorFlowSteps(flow);
}

/**
 * One badge code is one person, even when the staff menu stores them in
 * several department tables. Office intake only when that is their only row.
 */
export function trialBadgeRoster(rows: TrialStaffRow[]): TrialBadgePerson[] {
  const groups = new Map<string, TrialStaffRow[]>();
  for (const row of rows) {
    const code = (row.emp_code ?? "").trim();
    if (!code) continue;
    const list = groups.get(code) ?? [];
    list.push(row);
    groups.set(code, list);
  }

  const people: TrialBadgePerson[] = [];
  for (const [code, list] of groups) {
    const ordered = [...list].sort(
      (a, b) => TRIAL_STAFF_SOURCES.indexOf(a.source) - TRIAL_STAFF_SOURCES.indexOf(b.source),
    );
    const worker = ordered.find((row) => row.source !== "office") ?? ordered[0];
    people.push({
      id: worker.id,
      name: worker.name,
      emp_code: code,
      avatar_url: ordered.find((row) => row.avatar_url)?.avatar_url ?? null,
      department: trialDesk(ordered.map((row) => row.source)),
    });
  }
  people.sort((a, b) => a.name.localeCompare(b.name, "th"));
  return people;
}

export function flowSteps(flow: TrialFlow): string[] {
  return [...flow.lanes.flat(), ...flow.after];
}

export type TrialStepSnapshot = {
  step: string;
  employeeName: string;
  status: "held" | "running" | "done";
  startedAt: number;
  finishedAt: number | null;
};

/** What the office list shows: the live step, plus earlier steps that are already finished. */
export function trialStepView(
  flow: TrialFlow,
  runs: TrialStepSnapshot[],
): { headline: string; who: string | null; since: number | null; earlier: TrialStepSnapshot[] } {
  const ordered = flowSteps(flow);
  const byStep = new Map(runs.map((run) => [run.step, run]));
  const inFlow = new Set(ordered);
  const flowDone = ordered
    .map((step) => byStep.get(step))
    .filter((run): run is TrialStepSnapshot => run?.status === "done");
  const extraDone = runs
    .filter((run) => run.status === "done" && !inFlow.has(run.step))
    .sort((a, b) => (a.finishedAt ?? a.startedAt) - (b.finishedAt ?? b.startedAt));
  const earlier = [...flowDone, ...extraDone];
  const running =
    ordered.map((step) => byStep.get(step)).find((run) => run?.status === "running") ??
    runs.find((run) => run.status === "running");
  if (running) {
    return {
      headline: `กำลังทำ ${running.step}`,
      who: running.employeeName,
      since: running.startedAt,
      earlier,
    };
  }
  const held =
    ordered.map((step) => byStep.get(step)).find((run) => run?.status === "held") ??
    runs.find((run) => run.status === "held");
  if (held) {
    return {
      headline: `ยืนยันชุดแล้ว รอเริ่ม ${held.step}`,
      who: held.employeeName,
      since: null,
      earlier,
    };
  }
  const next = ordered.find((step) => byStep.get(step)?.status !== "done");
  if (!next) return { headline: "ครบทุกขั้น", who: null, since: null, earlier };
  if (earlier.length === 0) return { headline: "ยังไม่เริ่ม", who: null, since: null, earlier };
  if (flowDone.length === 0) {
    return { headline: `ทำแล้ว ${earlier.length} ขั้น`, who: null, since: null, earlier };
  }
  return { headline: `รอ ${next}`, who: null, since: null, earlier };
}

/** Keep the newer record for each step when the phone and the server both have a copy. */
export function mergeTrialRuns(local: TrialRun[], remote: TrialRun[], jobId: string): TrialRun[] {
  const others = local.filter((run) => run.jobId !== jobId);
  const byStep = new Map<string, TrialRun>();
  const stamp = (run: TrialRun) => run.finishedAt ?? run.startedAt;
  for (const run of remote.filter((row) => row.jobId === jobId)) byStep.set(run.step, run);
  for (const run of local.filter((row) => row.jobId === jobId)) {
    const have = byStep.get(run.step);
    if (!have || stamp(run) > stamp(have)) byStep.set(run.step, run);
  }
  return [...others, ...byStep.values()];
}

/** The steps a worker should see while the list is folded: the next unfinished step of each lane, then the join steps. */
export function nextTrialSteps(flow: TrialFlow, runs: TrialRun[], jobId: string): string[] {
  const job = runs.filter((run) => run.jobId === jobId && run.flow === flow.id);
  const done = (name: string) => Boolean(matchingDoneRun(job, name));
  const laneNow = flow.lanes
    .map((lane) => lane.find((name) => !done(name)))
    .filter((name): name is string => Boolean(name));
  if (laneNow.length > 0) return laneNow.slice(0, 3);
  return flow.after.filter((name) => !done(name)).slice(0, 3);
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
  const heldOpen = input.runs.find(
    (run) => run.employeeId === input.employeeId && run.status === "held",
  );
  if (heldOpen) {
    return deny("มีชุดที่ยืนยันแล้วยังไม่กดเริ่ม", [heldOpen.step]);
  }

  const same = job.find((run) => run.step === input.step);
  if (same?.status === "held") {
    return deny("ชุดนี้รับไปแล้ว", [input.step]);
  }
  if (same?.status === "running") {
    return deny("คนก่อนหน้ายังไม่กดจบงาน", [input.step]);
  }
  if (same?.status === "done" || matchingDoneRun(job, input.step)) {
    return deny("ขั้นนี้จบแล้ว", []);
  }

  for (const lane of input.flow.lanes) {
    const index = lane.indexOf(input.step);
    if (index < 0) continue;
    if (index === 0) return { ok: true };
    const previous = lane[index - 1];
    const previousRun = matchingDoneRun(job, previous) ?? job.find((run) => run.step === previous);
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

/** The step that must stay untouched before an admin can pull a job out of a set. */
export function nextFlowStep(flow: TrialFlow, step: string): string | null {
  for (const lane of flow.lanes) {
    const index = lane.indexOf(step);
    if (index < 0) continue;
    if (index < lane.length - 1) return lane[index + 1] ?? null;
    return flow.after[0] ?? null;
  }
  const afterIndex = flow.after.indexOf(step);
  if (afterIndex < 0) return null;
  return flow.after[afterIndex + 1] ?? null;
}

/** Whether this job can join a wood-issue, slat-cut, or rail-cut set. */
export function claimBatchJob(input: {
  step: BatchStep;
  flow: TrialFlow;
  jobId: string;
  runs: TrialRun[];
}): { ok: true } | { ok: false; message: string } {
  if ((input.step === "เบิกไม้" || input.step === "ตัดใบ") && input.flow.id !== "wood") {
    return { ok: false, message: "จุดนี้รับเฉพาะมู่ลี่ไม้" };
  }
  if (!flowSteps(input.flow).includes(input.step)) {
    return { ok: false, message: "ขั้นตอนนี้ไม่อยู่ในสินค้านี้" };
  }
  const gate = canStartTrial({
    runs: input.runs,
    jobId: input.jobId,
    flow: input.flow,
    step: input.step,
    employeeId: "__batch__",
  });
  if (!gate.ok) {
    if (gate.blocked.length === 1 && gate.blocked[0] === input.step) {
      return { ok: false, message: "ชุดนี้รับไปแล้ว" };
    }
    return { ok: false, message: gate.message };
  }
  return { ok: true };
}

/** Admin may remove only this step, and only while the following step has no row. */
export function batchWithdrawBlock(input: {
  flow: TrialFlow;
  step: string;
  runs: TrialRun[];
}): { ok: true } | { ok: false; message: string; who: string | null } {
  const jobRuns = input.runs.filter((run) => run.flow === input.flow.id);
  const target = jobRuns.find((run) => run.step === input.step);
  if (!target) return { ok: false, message: "ไม่พบขั้นนี้ในชุด", who: null };
  const next = nextFlowStep(input.flow, input.step);
  if (!next) return { ok: true };
  const nextRun = jobRuns.find((run) => run.step === next);
  if (!nextRun) return { ok: true };
  return {
    ok: false,
    message: `${nextRun.employeeName} เริ่มขั้น ${next} แล้ว`,
    who: nextRun.employeeName,
  };
}
