export type WiCategory = {
  id: string;
  name: string;
  description?: string;
  color: string;
};

export type WiStep = {
  id: string;
  order: number;
  categoryId: string;
  processName: string;
  actions: string[];
  department: string;
  documents?: string;
  /** ขั้นที่อยู่ในเส้นทางคู่ขนาน (เช่น EURO vs ลูกล้อ) */
  branch?: "euro-soft" | "wheel";
  branchLabel?: string;
};

export type WorkInstruction = {
  id: string;
  title: string;
  productLine: string;
  categories: WiCategory[];
  steps: WiStep[];
};
