-- production_logs.employee_id: nullable + ON DELETE SET NULL
ALTER TABLE public.production_logs ALTER COLUMN employee_id DROP NOT NULL;
ALTER TABLE public.production_logs DROP CONSTRAINT IF EXISTS production_logs_employee_id_fkey;
ALTER TABLE public.production_logs
  ADD CONSTRAINT production_logs_employee_id_fkey
  FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE SET NULL;

-- qc_reports.qc_employee_id: nullable + ON DELETE SET NULL
ALTER TABLE public.qc_reports ALTER COLUMN qc_employee_id DROP NOT NULL;
ALTER TABLE public.qc_reports DROP CONSTRAINT IF EXISTS qc_reports_qc_employee_id_fkey;
ALTER TABLE public.qc_reports
  ADD CONSTRAINT qc_reports_qc_employee_id_fkey
  FOREIGN KEY (qc_employee_id) REFERENCES public.qc_employees(id) ON DELETE SET NULL;