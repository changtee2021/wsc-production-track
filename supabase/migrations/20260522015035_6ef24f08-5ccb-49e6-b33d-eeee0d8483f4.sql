
ALTER TABLE public.packing_reports
  ADD CONSTRAINT packing_reports_packing_employee_id_fkey FOREIGN KEY (packing_employee_id) REFERENCES public.packing_employees(id) ON DELETE SET NULL,
  ADD CONSTRAINT packing_reports_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE SET NULL,
  ADD CONSTRAINT packing_reports_step_id_fkey FOREIGN KEY (step_id) REFERENCES public.steps(id) ON DELETE SET NULL,
  ADD CONSTRAINT packing_reports_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.categories(id) ON DELETE SET NULL,
  ADD CONSTRAINT packing_reports_production_log_id_fkey FOREIGN KEY (production_log_id) REFERENCES public.production_logs(id) ON DELETE SET NULL;

ALTER TABLE public.packing_report_items
  ADD CONSTRAINT packing_report_items_packing_report_id_fkey FOREIGN KEY (packing_report_id) REFERENCES public.packing_reports(id) ON DELETE CASCADE,
  ADD CONSTRAINT packing_report_items_checklist_id_fkey FOREIGN KEY (checklist_id) REFERENCES public.packing_checklists(id) ON DELETE SET NULL;

ALTER TABLE public.packing_checklists
  ADD CONSTRAINT packing_checklists_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.categories(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_packing_reports_job_id ON public.packing_reports(job_id);
CREATE INDEX IF NOT EXISTS idx_packing_reports_created_at ON public.packing_reports(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_packing_report_items_report_id ON public.packing_report_items(packing_report_id);
CREATE INDEX IF NOT EXISTS idx_packing_checklists_category_id ON public.packing_checklists(category_id);
