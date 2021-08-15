DROP FUNCTION IF EXISTS get_country_current_production(text);
CREATE OR REPLACE FUNCTION public.get_country_current_production(iso3166_ TEXT)
    RETURNS TABLE (id integer, year integer, volume float, unit text, fossil_fuel_type text, source_id integer )
    LANGUAGE sql STABLE
AS $$
SELECT id, year, volume, unit, fossil_fuel_type, source_id FROM (
    SELECT *, RANK() OVER (PARTITION BY source_id, fossil_fuel_type ORDER BY year DESC) FROM public.country_production cp
    WHERE cp.iso3166 = iso3166_ AND project_id = '' AND projection = FALSE
    ORDER BY RANK
) t WHERE RANK=1;
$$;

GRANT EXECUTE ON FUNCTION public.get_country_current_production TO grff;

ALTER TABLE public.sparse_projects ADD COLUMN IF NOT EXISTS methane_m3_ton float NULL;
ALTER TABLE public.sparse_projects DROP COLUMN reserves;
ALTER TABLE public.sparse_projects ADD COLUMN IF NOT EXISTS reserves float8 NULL;
ALTER TABLE public.sparse_projects ADD COLUMN IF NOT EXISTS reserves_unit varchar(10) NULL;
ALTER TABLE public.sparse_projects ADD COLUMN IF NOT EXISTS reserves_grade varchar(10) NULL;
ALTER TABLE public.sparse_projects ADD COLUMN IF NOT EXISTS data_year int4 NULL;
