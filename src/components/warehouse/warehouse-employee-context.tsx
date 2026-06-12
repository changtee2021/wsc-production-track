import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ClipboardCheck } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getWarehouseToken } from "@/lib/auth/warehouse-session";
import { whListEmployees } from "@/lib/features/warehouse-settings.functions";

const LAST_EMP_KEY = "ptrack_wh_emp";

export type WhEmployee = { id: string; name: string; emp_code: string };

type Ctx = {
  empCode: string;
  empName: string;
  empId: string;
  setEmployee: (emp: WhEmployee) => void;
  ready: boolean;
};

const WarehouseEmployeeContext = createContext<Ctx | null>(null);

export function useWarehouseEmployee() {
  const ctx = useContext(WarehouseEmployeeContext);
  if (!ctx) throw new Error("useWarehouseEmployee must be used within WarehouseEmployeeProvider");
  return ctx;
}

export function WarehouseEmployeeProvider({
  children,
  requireSelection = true,
}: {
  children: ReactNode;
  requireSelection?: boolean;
}) {
  const token = getWarehouseToken() ?? "";
  const listFn = useServerFn(whListEmployees);
  const { data: employees = [] } = useQuery({
    queryKey: ["wh-employees"],
    queryFn: () => listFn({ data: { token } }),
    enabled: !!token,
  });

  const [empId, setEmpId] = useState("");
  const [empCode, setEmpCode] = useState("");
  const [empName, setEmpName] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem(LAST_EMP_KEY);
      if (!raw) return;
      const { id, code, name } = JSON.parse(raw) as { id: string; code: string; name: string };
      setEmpId(id);
      setEmpCode(code);
      setEmpName(name);
    } catch {
      /* ignore */
    }
  }, []);

  const setEmployee = (emp: WhEmployee) => {
    setEmpId(emp.id);
    setEmpCode(emp.emp_code);
    setEmpName(emp.name);
    if (typeof window !== "undefined") {
      localStorage.setItem(
        LAST_EMP_KEY,
        JSON.stringify({ id: emp.id, code: emp.emp_code, name: emp.name }),
      );
    }
  };

  const ready = !requireSelection || !!empCode;

  const value = useMemo(
    () => ({ empCode, empName, empId, setEmployee, ready }),
    [empCode, empName, empId, ready],
  );

  if (requireSelection && !ready) {
    return (
      <div className="min-h-[100dvh] bg-background p-4">
        <div className="mx-auto max-w-md space-y-4 pt-8">
          <h1 className="text-xl font-bold">คลังสินค้า</h1>
          <p className="text-sm text-muted-foreground">เลือกพนักงานก่อนเริ่มงาน</p>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <ClipboardCheck className="h-4 w-4 text-teal-600" />
                พนักงานคลัง
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Select
                value={empId}
                onValueChange={(id) => {
                  const e = employees.find((x) => x.id === id);
                  if (e) setEmployee(e);
                }}
              >
                <SelectTrigger className="h-14 rounded-2xl text-base">
                  <SelectValue placeholder="เลือกพนักงาน" />
                </SelectTrigger>
                <SelectContent>
                  {employees.length === 0 && (
                    <div className="px-3 py-2 text-sm text-muted-foreground">
                      ยังไม่มีพนักงาน — ให้แอดมินเพิ่มใน ตั้งค่าคลัง → พนักงานคลัง
                    </div>
                  )}
                  {employees.map((e) => (
                    <SelectItem key={e.id} value={e.id} className="py-2">
                      <div className="flex flex-col text-left">
                        <span className="text-base font-semibold leading-tight">{e.name}</span>
                        {e.emp_code && (
                          <span className="font-mono text-xs text-muted-foreground">{e.emp_code}</span>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <WarehouseEmployeeContext.Provider value={value}>{children}</WarehouseEmployeeContext.Provider>
  );
}

export function WarehouseEmployeeBar() {
  const { empId, empName, setEmployee } = useWarehouseEmployee();
  const token = getWarehouseToken() ?? "";
  const listFn = useServerFn(whListEmployees);
  const { data: employees = [] } = useQuery({
    queryKey: ["wh-employees"],
    queryFn: () => listFn({ data: { token } }),
    enabled: !!token,
  });

  return (
    <div className="border-b bg-muted/30 px-3 py-2">
      <Select
        value={empId}
        onValueChange={(id) => {
          const e = employees.find((x) => x.id === id);
          if (e) setEmployee(e);
        }}
      >
        <SelectTrigger className="h-11 rounded-xl border-0 bg-background text-sm shadow-sm">
          <SelectValue placeholder="เลือกพนักงาน">
            {empName ? (
              <span className="flex items-center gap-2">
                <ClipboardCheck className="h-4 w-4 text-teal-600" />
                {empName}
              </span>
            ) : (
              "เลือกพนักงาน"
            )}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {employees.map((e) => (
            <SelectItem key={e.id} value={e.id}>
              {e.name} {e.emp_code ? `(${e.emp_code})` : ""}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
