-- Unused table

DROP TABLE public.languages;

-- Use data point table for all kinds of projects.

ALTER TABLE public.sparse_projects RENAME TO project;
CREATE TYPE project_type AS ENUM (
    'dense',
    'sparse');
ALTER TABLE public.project ADD COLUMN IF NOT EXISTS project_type project_type NOT NULL DEFAULT 'sparse'::project_type;

-- Unify naming

ALTER TABLE public.sparse_data_point RENAME TO project_data_point;
ALTER TABLE public.country_production RENAME TO country_data_point;
ALTER TABLE public.countries RENAME TO country;
ALTER TABLE public.country_data_point RENAME COLUMN source_operator_name TO operator_name;
ALTER TABLE public.country_data_point ADD COLUMN IF NOT EXISTS subtype varchar(20) NULL;

-- Convert from projection flag to data_point_type

ALTER TYPE sparse_data_point_type RENAME TO data_point_type;
ALTER TABLE public.country_data_point ADD COLUMN IF NOT EXISTS data_type data_point_type NULL;
UPDATE public.country_data_point SET data_type = 'production'::data_point_type WHERE projection = FALSE;
UPDATE public.country_data_point SET data_type = 'projection'::data_point_type WHERE projection = TRUE;
ALTER TABLE public.country_data_point ALTER COLUMN data_type SET NOT NULL;

-- Convert dene projects

INSERT INTO public.project (iso3166, iso3166_2, project_id, project_type, operator_name, oc_operator_id)
    (SELECT DISTINCT iso3166, iso3166_2, project_id, 'dense'::project_type AS project_type, operator_name, oc_operator_id FROM public.country_data_point cp WHERE project_id <> '')
ON CONFLICT DO NOTHING;

DROP INDEX public.country_production_3;
ALTER TABLE public.country_data_point RENAME COLUMN project_id TO project_identifier;
ALTER TABLE public.country_data_point DROP COLUMN operator_name;
ALTER TABLE public.country_data_point DROP COLUMN oc_operator_id;
ALTER TABLE public.country_data_point ADD COLUMN IF NOT EXISTS project_id integer;

ALTER TABLE public.country_data_point ADD CONSTRAINT country_project_fk
    FOREIGN KEY (project_id) REFERENCES public.project(id) ON DELETE CASCADE;

UPDATE public.country_data_point SET project_id = p.id
FROM (SELECT * FROM public.project) p
WHERE p.iso3166 = country_data_point.iso3166 AND p.project_id = country_data_point.project_identifier;

ALTER TABLE public.country_data_point DROP COLUMN project_identifier;
ALTER TABLE public.project_data_point RENAME COLUMN sparse_project_id TO project_id;

-- Merge geo data

UPDATE public.project SET geo_position = pg.geom
FROM (SELECT * FROM public.project_geo) pg
WHERE pg.iso3166 = project.iso3166 AND pg.project_id = project.project_id;

DROP TABLE public.project_geo;

-- Now convert dense data points

INSERT INTO public.project_data_point (project_id, volume, unit, YEAR, source_id, fossil_fuel_type, data_type)
    (SELECT project_id, volume, unit, YEAR, source_id, fossil_fuel_type, 'production' AS data_type FROM public.country_data_point cdp WHERE project_id IS NOT NULL AND volume IS NOT NULL AND projection = false);

INSERT INTO public.project_data_point (project_id, volume, unit, YEAR, source_id, fossil_fuel_type, data_type)
    (SELECT project_id, volume, unit, YEAR, source_id, fossil_fuel_type, 'projection' AS data_type FROM public.country_data_point cdp WHERE project_id IS NOT NULL AND volume IS NOT NULL AND projection = true);

DELETE FROM public.country_data_point WHERE project_id IS NOT NULL;
ALTER TABLE public.country_data_point DROP COLUMN projection;

-- Convert reserves (Fix iso3166 errors first)

UPDATE public.country_reserves SET iso3166 = 'pl' WHERE iso3166 = 'po';
INSERT INTO public.country_data_point (iso3166, volume, unit, YEAR, source_id, fossil_fuel_type, data_type)
    (SELECT iso3166, volume, unit, YEAR, source_id, fossil_fuel_type, 'reserve' AS data_type FROM public.country_reserves WHERE volume IS NOT NULL);
DROP TABLE public.country_reserves;
