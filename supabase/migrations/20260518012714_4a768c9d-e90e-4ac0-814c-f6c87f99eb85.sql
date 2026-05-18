
ALTER TABLE public.qc_reports
  ADD CONSTRAINT qc_reports_qc_employee_id_fkey
    FOREIGN KEY (qc_employee_id) REFERENCES public.qc_employees(id) ON DELETE RESTRICT,
  ADD CONSTRAINT qc_reports_employee_id_fkey
    FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE SET NULL,
  ADD CONSTRAINT qc_reports_step_id_fkey
    FOREIGN KEY (step_id) REFERENCES public.steps(id) ON DELETE SET NULL,
  ADD CONSTRAINT qc_reports_category_id_fkey
    FOREIGN KEY (category_id) REFERENCES public.categories(id) ON DELETE SET NULL;
