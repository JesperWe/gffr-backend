ALTER TABLE public.conversion_constant
    ADD COLUMN IF NOT EXISTS project_id integer DEFAULT null,
    ADD COLUMN IF NOT EXISTS quality integer DEFAULT null,
    ADD CONSTRAINT fk_conversion_constant_projects FOREIGN KEY (project_id) REFERENCES public.project (id);

GRANT SELECT ON TABLE public.sparse_projects TO grff;
