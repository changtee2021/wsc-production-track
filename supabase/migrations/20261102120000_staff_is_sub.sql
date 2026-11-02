-- Sub staff change often and are listed apart from regular employees.
alter table wsc_production.employees add column if not exists is_sub boolean not null default false;
alter table wsc_production.qc_employees add column if not exists is_sub boolean not null default false;
alter table wsc_production.packing_employees add column if not exists is_sub boolean not null default false;
alter table wsc_production.maintenance_employees add column if not exists is_sub boolean not null default false;
alter table wsc_production.office_employees add column if not exists is_sub boolean not null default false;
alter table wsc_production.stock_employees add column if not exists is_sub boolean not null default false;
alter table wsc_production.wh_employees add column if not exists is_sub boolean not null default false;
alter table wsc_production.transport_employees add column if not exists is_sub boolean not null default false;
