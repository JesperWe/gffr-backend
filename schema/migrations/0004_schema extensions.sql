ALTER TABLE public.country_production ADD COLUMN IF NOT EXISTS source_operator_name text NULL;
ALTER TABLE public.country_production ADD COLUMN IF NOT EXISTS oc_operator_id text NULL;

CREATE UNIQUE INDEX sparse_projects_uniq_idx ON public.sparse_projects USING btree (iso3166, project_id);
ALTER TABLE public.sparse_projects ALTER COLUMN geo_position TYPE geometry USING geo_position::geometry;

ALTER TABLE public.sources ADD COLUMN IF NOT EXISTS int8 integer NULL;
ALTER TABLE public.sources ADD COLUMN IF NOT EXISTS int8 integer NULL;
ALTER TABLE public.sources ADD COLUMN IF NOT EXISTS latest_curation_at timestamp NULL;
