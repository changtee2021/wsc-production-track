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
import { loadStoredStockEmployee, saveStoredStockEmployee } from "@/lib/stock-employee-persistence";

export type WhEmployee = { id: string; name: string; emp_code: string };

type Ctx = {
  empCode: string;
  empName: string;
  empId: string;
  employees: WhEmployee[];
  setEmployee: (emp: WhEmployee) => void;
  ready: boolean;
};

const WarehouseEmployeeContext = createContext<Ctx | null>(null);

export function useWarehouseEmployee() {
  const ctx = useContext(WarehouseEmployeeContext);
  if (!ctx) throw new Error("useWarehouseEmployee must be used within WarehouseEmployeeProvider");
  return ctx;
}

function useWarehouseEmployeesQuery() {
  const token = getWarehouseToken() ?? "";
  const listFn = useServerFn(whListEmployees);
  return useQuery({
    queryKey: ["wh-employees"],
    queryFn: () => listFn({ data: { token } }),
    enabled: !!token,
  });
}

export function WarehouseEmployeePicker({
  title = "พนักงานคลัง",
  showCard = true,
}: {
  title?: string;
  showCard?: boolean;
}) {
  const { empId, setEmployee, employees } = useWarehouseEmployee();

  const select = (
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
            ยังไม่มีพนักงาน — ให้แอดมินเพิ่มใน เมนู พนักงาน → พนักงานคลัง / นับสต๊อก
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
  );

  if (!showCard) return select;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <ClipboardCheck className="h-4 w-4 text-teal-600" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>{select}</CardContent>
    </Card>
  );
}

export function WarehouseEmployeeProvider({
  children,
  requireSelection = true,
}: {
  children: ReactNode;
  requireSelection?: boolean;
}) {
  const { data: employees = [] } = useWarehouseEmployeesQuery();

  const [empId, setEmpId] = useState("");
  const [empCode, setEmpCode] = useState("");
  const [empName, setEmpName] = useState("");

  useEffect(() => {
    const stored = loadStoredStockEmployee();
    if (!stored) return;
    setEmpId(stored.id);
    setEmpCode(stored.code);
    setEmpName(stored.name);
  }, []);

  useEffect(() => {
    if (!employees.length || !empCode) return;
    const match = employees.find((e) => e.emp_code === empCode);
    if (match && match.id !== empId) setEmpId(match.id);
  }, [employees, empCode, empId]);

  const setEmployee = (emp: WhEmployee) => {
    setEmpId(emp.id);
    setEmpCode(emp.emp_code);
    setEmpName(emp.name);
    saveStoredStockEmployee({ id: emp.id, code: emp.emp_code, name: emp.name });
  };

  const ready = !requireSelection || !!empCode;

  const value = useMemo(
    () => ({ empCode, empName, empId, employees, setEmployee, ready }),
    [empCode, empName, empId, employees, ready],
  );

  if (requireSelection && !ready) {
    return (
      <WarehouseEmployeeContext.Provider value={value}>
        <div className="min-h-[100dvh] bg-background p-4">
          <div className="mx-auto max-w-md space-y-4 pt-8">
            <h1 className="text-xl font-bold">คลังสินค้า</h1>
            <p className="text-sm text-muted-foreground">เลือกพนักงานก่อนเริ่มงาน</p>
            <WarehouseEmployeePicker />
          </div>
        </div>
      </WarehouseEmployeeContext.Provider>
    );
  }

  return (
    <WarehouseEmployeeContext.Provider value={value}>{children}</WarehouseEmployeeContext.Provider>
  );
}
