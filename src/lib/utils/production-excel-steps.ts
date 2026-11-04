export const LINE_RELEASE_STEP_NAME = "ส่งออเดอร์เข้าไลน์ผลิต";

export type ExcelStepTimes = {
  step_name: string;
  employee_name: string;
  emp_code: string | null;
  started_at: string;
  finished_at: string;
  actual_seconds: number;
};

/** Office send is one instant step: the person who keyed it, at the time it was sent. */
export function lineReleaseStep(sentByName: string | null, at: string): ExcelStepTimes {
  return {
    step_name: LINE_RELEASE_STEP_NAME,
    employee_name: sentByName?.trim() || "พนักงานออฟฟิศ",
    emp_code: null,
    started_at: at,
    finished_at: at,
    actual_seconds: 0,
  };
}

export function trialRunStep(
  run: {
    step: string;
    employee_name: string;
    started_at: string;
    finished_at: string | null;
  },
  empCode: string | null,
): ExcelStepTimes {
  const finished = run.finished_at ?? "";
  const actual =
    run.finished_at == null
      ? 0
      : Math.max(
          1,
          Math.round((new Date(run.finished_at).getTime() - new Date(run.started_at).getTime()) / 1000),
        );
  return {
    step_name: run.step,
    employee_name: run.employee_name,
    emp_code: empCode,
    started_at: run.started_at,
    finished_at: finished,
    actual_seconds: actual,
  };
}

/** Line release stays ahead of a floor step that shares the same clock time. */
export function compareExcelSteps(a: ExcelStepTimes, b: ExcelStepTimes): number {
  const delta = new Date(a.started_at).getTime() - new Date(b.started_at).getTime();
  if (delta !== 0) return delta;
  if (a.step_name === LINE_RELEASE_STEP_NAME) return -1;
  if (b.step_name === LINE_RELEASE_STEP_NAME) return 1;
  return 0;
}
