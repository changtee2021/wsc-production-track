import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  batchWithdrawBlock,
  canStartTrial,
  canUseBatchScan,
  claimBatchJob,
  flowById,
  nextFlowStep,
  stepLabel,
  flowForProductName,
  mergeTrialRuns,
  nextTrialSteps,
  trialStepView,
  scanLaneBlockMessage,
  scanLaneDecision,
  trialBadgeRoster,
  trialVisibleSteps,
  type TrialRun,
  type TrialStaffRow,
} from "./scan-trial.ts";

function done(step: string, extra: Partial<TrialRun> = {}): TrialRun {
  return {
    jobId: "123",
    flow: "roller",
    step,
    employeeId: "e1",
    employeeName: "A",
    status: "done",
    startedAt: 1,
    finishedAt: 2,
    ...extra,
  };
}

describe("batch scan staff", () => {
  it("keeps the roller batch buttons on the named badges only", () => {
    assert.equal(canUseBatchScan("66090018"), true);
    assert.equal(canUseBatchScan("69090087"), true);
    assert.equal(canUseBatchScan("68110103"), true);
    assert.equal(canUseBatchScan(" 68080080 "), true);
    assert.equal(canUseBatchScan("68080084"), true);
    assert.equal(canUseBatchScan("66090024"), false);
    assert.equal(canUseBatchScan(""), false);
  });
});

describe("scan lanes", () => {
  it("keeps an office-released job on v2 only", () => {
    assert.equal(scanLaneDecision("v2", true), "open");
    assert.equal(scanLaneDecision("v1", true), "blocked");
  });

  it("keeps a job office has not sent on the original scan", () => {
    assert.equal(scanLaneDecision("v1", false), "open");
    assert.equal(scanLaneDecision("v2", false), "blocked");
  });

  it("tells each lane why the job is blocked", () => {
    assert.match(scanLaneBlockMessage("v2"), /สแกนเดิม/);
    assert.match(scanLaneBlockMessage("v1"), /สแกน v2/);
  });
});

describe("scan trial flow", () => {
  const roller = flowById("roller");

  it("lets the first step of a lane start", () => {
    const result = canStartTrial({
      runs: [],
      jobId: "123",
      flow: roller,
      step: "ตัดผ้า",
      employeeId: "e1",
    });
    assert.equal(result.ok, true);
  });

  it("blocks a later lane step until the previous one is finished", () => {
    const result = canStartTrial({
      runs: [],
      jobId: "123",
      flow: roller,
      step: "ประกอบราง",
      employeeId: "e1",
    });
    assert.equal(result.ok, false);
    if (!result.ok) assert.deepEqual(result.blocked, ["ตัดราง"]);
  });

  it("blocks QC until every lane is finished", () => {
    const result = canStartTrial({
      runs: [done("ตัดผ้า")],
      jobId: "123",
      flow: roller,
      step: "QC",
      employeeId: "e2",
    });
    assert.equal(result.ok, false);
  });

  it("allows QC after the lanes and the earlier join steps are finished", () => {
    const steps = ["ตัดผ้า", "ตัดราง", "ประกอบราง", "เตรียมโซ่/หัวเกียร์", "ประกอบ", "หัว"];
    const result = canStartTrial({
      runs: steps.map((step) => done(step)),
      jobId: "123",
      flow: roller,
      step: "QC",
      employeeId: "e2",
    });
    assert.equal(result.ok, true);
  });

  it("blocks a worker who still has a running step", () => {
    const result = canStartTrial({
      runs: [done("ตัดผ้า", { status: "running", finishedAt: null })],
      jobId: "123",
      flow: roller,
      step: "ตัดราง",
      employeeId: "e1",
    });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.message, "เครื่องนี้ยังไม่กดเสร็จงาน ไปขั้นต่อไปไม่ได้");
  });

  it("shows the next unfinished step of each lane", () => {
    const steps = nextTrialSteps(roller, [done("ตัดผ้า"), done("ตัดราง")], "123");
    assert.deepEqual(steps, ["ประกอบราง", "เตรียมโซ่/หัวเกียร์"]);
  });

  it("matches a production category name to the roller flow", () => {
    assert.equal(flowForProductName("2.ม่านม้วน ကုလားကာ")?.id, "roller");
  });

  it("uses issue-wood and set-up on the wood flow, with English labels", () => {
    const wood = flowById("wood");
    assert.deepEqual(wood.lanes[0], ["เบิกไม้", "QC ไม้ที่เบิก", "ตัดใบ", "เก็บสี", "เจาะใบ"]);
    assert.deepEqual(wood.after, ["ประกอบชุด", "ตั้งงาน", "QC", "PACK"]);
    assert.equal(stepLabel("เบิกไม้"), "เบิกไม้ I Issue wood");
    assert.equal(stepLabel("ตั้งงาน"), "ตั้งงาน I Set up");
    assert.equal(stepLabel("ตัดใบ"), "ตัดใบ I Cut slats");
    assert.equal(stepLabel("QC ไม้ที่เบิก"), "QC ไม้ที่เบิก I Check issued wood");
    assert.equal(stepLabel("QC"), "QC");
    assert.equal(stepLabel("PACK"), "PACK");
    assert.equal(stepLabel("เบิกไม้", "my").includes("Issue"), false);
  });

  it("holds slat cutting until the issued-wood QC is finished", () => {
    const wood = flowById("wood");
    const issued = done("เบิกไม้", { jobId: "456", flow: "wood" });
    const blocked = canStartTrial({
      runs: [issued],
      jobId: "456",
      flow: wood,
      step: "ตัดใบ",
      employeeId: "e2",
    });
    assert.equal(blocked.ok, false);
    if (!blocked.ok) assert.deepEqual(blocked.blocked, ["QC ไม้ที่เบิก"]);
    const open = canStartTrial({
      runs: [issued, done("QC ไม้ที่เบิก", { jobId: "456", flow: "wood" })],
      jobId: "456",
      flow: wood,
      step: "ตัดใบ",
      employeeId: "e2",
    });
    assert.equal(open.ok, true);
    const legacy = canStartTrial({
      runs: [done("เปิดไม้", { jobId: "456", flow: "wood" })],
      jobId: "456",
      flow: wood,
      step: "QC ไม้ที่เบิก",
      employeeId: "e2",
    });
    assert.equal(legacy.ok, true);
  });

  it("lets a wood issue, slat cut, or rail cut join a set only when the step is free", () => {
    const wood = flowById("wood");
    const open = claimBatchJob({ step: "เบิกไม้", flow: wood, jobId: "456", runs: [] });
    assert.equal(open.ok, true);
    const wrongProduct = claimBatchJob({
      step: "เบิกไม้",
      flow: roller,
      jobId: "123",
      runs: [],
    });
    assert.equal(wrongProduct.ok, false);
    if (!wrongProduct.ok) assert.equal(wrongProduct.message, "จุดนี้รับเฉพาะมู่ลี่ไม้");
    const claimed = claimBatchJob({
      step: "ตัดราง",
      flow: roller,
      jobId: "123",
      runs: [done("ตัดราง", { status: "held", finishedAt: null })],
    });
    assert.equal(claimed.ok, false);
    if (!claimed.ok) assert.equal(claimed.message, "ชุดนี้รับไปแล้ว");
    const waitingQc = claimBatchJob({
      step: "ตัดใบ",
      flow: wood,
      jobId: "456",
      runs: [done("เบิกไม้", { jobId: "456", flow: "wood" })],
    });
    assert.equal(waitingQc.ok, false);
  });

  it("blocks the next station until a confirmed set is finished", () => {
    const wood = flowById("wood");
    const held = canStartTrial({
      runs: [done("เบิกไม้", { jobId: "456", flow: "wood", status: "held", finishedAt: null })],
      jobId: "456",
      flow: wood,
      step: "QC ไม้ที่เบิก",
      employeeId: "qc",
    });
    assert.equal(held.ok, false);
  });

  it("keeps a confirmed set on that person until they press start", () => {
    const wood = flowById("wood");
    const blocked = canStartTrial({
      runs: [
        done("เบิกไม้", {
          jobId: "456",
          flow: "wood",
          status: "held",
          finishedAt: null,
          employeeId: "e1",
        }),
      ],
      jobId: "789",
      flow: wood,
      step: "ตัดราง",
      employeeId: "e1",
    });
    assert.equal(blocked.ok, false);
    if (!blocked.ok) assert.equal(blocked.message, "มีชุดที่ยืนยันแล้วยังไม่กดเริ่ม");
  });

  it("shows a confirmed set as waiting to start", () => {
    const wood = flowById("wood");
    const view = trialStepView(wood, [
      done("เบิกไม้", {
        jobId: "456",
        flow: "wood",
        status: "held",
        finishedAt: null,
        employeeName: "ไม้",
      }),
    ]);
    assert.equal(view.headline, "ยืนยันชุดแล้ว รอเริ่ม เบิกไม้");
    assert.equal(view.since, null);
    assert.equal(view.who, "ไม้");
  });
});

describe("batch withdraw", () => {
  it("allows withdraw until the next step has a row", () => {
    const wood = flowById("wood");
    assert.equal(nextFlowStep(wood, "เบิกไม้"), "QC ไม้ที่เบิก");
    assert.equal(nextFlowStep(wood, "ตัดราง"), "เจาะราง");
    const open = batchWithdrawBlock({
      flow: wood,
      step: "เบิกไม้",
      runs: [done("เบิกไม้", { jobId: "456", flow: "wood", status: "held", finishedAt: null })],
    });
    assert.equal(open.ok, true);
    const blocked = batchWithdrawBlock({
      flow: wood,
      step: "เบิกไม้",
      runs: [
        done("เบิกไม้", { jobId: "456", flow: "wood" }),
        done("QC ไม้ที่เบิก", { jobId: "456", flow: "wood", employeeName: "คิวซี" }),
      ],
    });
    assert.equal(blocked.ok, false);
    if (!blocked.ok) {
      assert.equal(blocked.who, "คิวซี");
      assert.match(blocked.message, /QC ไม้ที่เบิก/);
    }
  });
});

function staff(
  partial: Partial<TrialStaffRow> & Pick<TrialStaffRow, "id" | "source">,
): TrialStaffRow {
  return {
    name: partial.name ?? partial.id,
    emp_code: partial.emp_code ?? "1",
    avatar_url: partial.avatar_url ?? null,
    ...partial,
  };
}

describe("trial badge roster", () => {
  const roller = flowById("roller");

  it("lets a QC-only badge see only the QC step", () => {
    const [person] = trialBadgeRoster([
      staff({ id: "qc1", source: "qc", name: "ป๊อปปี้", emp_code: "69060069" }),
    ]);
    assert.equal(person.emp_code, "69060069");
    assert.equal(person.department, "qc");
    assert.deepEqual(trialVisibleSteps(person.department, roller), ["QC"]);
  });

  it("lets a packing-only badge see only the PACK step", () => {
    const [person] = trialBadgeRoster([
      staff({ id: "pack1", source: "packing", name: "แพ็ค", emp_code: "9" }),
    ]);
    assert.equal(person.department, "packing");
    assert.deepEqual(trialVisibleSteps(person.department, roller), ["PACK"]);
  });

  it("keeps an office-only badge on the intake screen", () => {
    const [person] = trialBadgeRoster([
      staff({ id: "off1", source: "office", name: "ออฟฟิศ", emp_code: "100" }),
    ]);
    assert.equal(person.department, "office");
    assert.deepEqual(trialVisibleSteps(person.department, roller), []);
  });

  it("keeps earlier steps for a production badge", () => {
    const [person] = trialBadgeRoster([
      staff({ id: "prod1", source: "production", name: "ผลิต", emp_code: "1" }),
    ]);
    const steps = trialVisibleSteps(person.department, roller);
    assert.equal(person.department, "production");
    assert.ok(steps.includes("ตัดผ้า"));
    assert.ok(steps.includes("QC"));
  });

  it("merges the same code across departments into one person", () => {
    const people = trialBadgeRoster([
      staff({
        id: "off1",
        source: "office",
        name: "สมชาย",
        emp_code: " 200 ",
        avatar_url: "https://example.com/a.jpg",
      }),
      staff({ id: "qc1", source: "qc", name: "สมชาย", emp_code: "200" }),
      staff({ id: "blank", source: "packing", name: "ไม่มีรหัส", emp_code: "  " }),
    ]);
    assert.equal(people.length, 1);
    assert.equal(people[0].id, "qc1");
    assert.equal(people[0].emp_code, "200");
    assert.equal(people[0].department, "qc");
    assert.equal(people[0].avatar_url, "https://example.com/a.jpg");
  });
});

describe("trial step view", () => {
  const roller = flowById("roller");

  it("shows the running step and the finished steps before it", () => {
    const view = trialStepView(roller, [
      done("ตัดผ้า", { employeeName: "หนึ่ง", finishedAt: 1_700_000_000_000 }),
      {
        jobId: "123",
        flow: "roller",
        step: "ตัดราง",
        employeeId: "e2",
        employeeName: "สอง",
        status: "running",
        startedAt: 1_700_000_100_000,
        finishedAt: null,
      },
    ]);
    assert.equal(view.headline, "กำลังทำ ตัดราง");
    assert.equal(view.who, "สอง");
    assert.equal(view.since, 1_700_000_100_000);
    assert.deepEqual(
      view.earlier.map((step) => step.step),
      ["ตัดผ้า"],
    );
  });

  it("lists finished steps that are not in the preset flow", () => {
    const view = trialStepView(roller, [
      done("ตัดเทปผ้าจากประวัติ", { employeeName: "นุ้ย", finishedAt: 1_700_000_000_000 }),
    ]);
    assert.equal(view.headline, "ทำแล้ว 1 ขั้น");
    assert.deepEqual(
      view.earlier.map((step) => step.step),
      ["ตัดเทปผ้าจากประวัติ"],
    );
  });

  it("keeps a newer local start when the server copy is older", () => {
    const local = [
      done("ตัดผ้า", { status: "running", finishedAt: null, startedAt: 20 }),
    ];
    const remote = [done("ตัดผ้า", { status: "done", finishedAt: 10, startedAt: 1 })];
    const merged = mergeTrialRuns(local, remote, "123");
    assert.equal(merged[0]?.status, "running");
    assert.equal(merged[0]?.startedAt, 20);
  });
});
