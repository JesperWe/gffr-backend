ALTER TABLE public.conversion_constant ADD COLUMN IF NOT EXISTS subtype varchar(20) NULL;
ALTER TABLE public.conversion_constant ADD COLUMN IF NOT EXISTS country varchar(3) NULL;

DROP TABLE IF EXISTS public.sparse_projects;
CREATE TABLE public.sparse_projects (
    id serial NOT NULL,
    iso3166 varchar(2) NULL,
    iso3166_2 text NULL,
    project_id text NULL,
    source_project_name text NULL,
    source_project_id text NULL,
    region text NULL,
    location_name text NULL,
    operator_name text NULL,
    oc_operator_id text NULL,
    geo_position geography NULL,
    year int4 NULL,
    volume float8 NULL,
    unit varchar(9) NULL,
    production_co2e float8 NULL,
    description text NULL,
    link_url text NULL,
    production_type text NULL,
    production_method text NULL,
    grade text NULL,
    source_id int4 NULL,
    fossil_fuel_type varchar(12) NOT NULL,
    subtype varchar(20) NULL,
    quality int4 NULL,
    reserves bool NULL DEFAULT false,
    projection bool NULL DEFAULT false,
    CONSTRAINT sparse_projects_pk PRIMARY KEY (id)
);
CREATE INDEX IF NOT EXISTS sparse_projects_region ON public.sparse_projects (iso3166,project_id,iso3166_2);
CREATE INDEX IF NOT EXISTS sparse_projects_country ON public.sparse_projects (iso3166);
GRANT SELECT ON TABLE public.sparse_projects TO grff;
