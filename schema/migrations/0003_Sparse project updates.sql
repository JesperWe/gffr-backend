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

ALTER TABLE public.sparse_projects ADD COLUMN IF NOT EXISTS data_year int4 NULL;

DO $$ BEGIN
    CREATE TYPE public.sparse_data_point_type AS ENUM ('production', 'reserve', 'projection');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DROP TABLE IF EXISTS public.sparse_data_point;
CREATE TABLE public.sparse_data_point (
      id serial NOT NULL,
      sparse_project_id int4 NOT NULL,
      data_type sparse_data_point_type NOT NULL ,
      "year" int4 NULL,
      "data_year" int4 NULL,
      volume float8 NULL,
      unit varchar(9) NULL,
      grade varchar(20) NULL,
      fossil_fuel_type varchar(20) NULL,
      subtype varchar(20) NULL,
      source_id integer NULL,
      quality int2 NULL,
      CONSTRAINT sparse_data_point_pk PRIMARY KEY (id),
      CONSTRAINT sparse_data_point_fk FOREIGN KEY (sparse_project_id) REFERENCES public.sparse_projects(id) ON DELETE CASCADE ON UPDATE CASCADE
);
GRANT ALL ON TABLE public.sparse_data_point TO grff;

CREATE OR REPLACE FUNCTION public.get_projects(iso3166_ TEXT, iso3166_2_ text)
    RETURNS TABLE (project_id TEXT, iso3166_2 TEXT, first_year integer, last_year integer, data_type text )
    LANGUAGE sql STABLE
AS $$
(SELECT DISTINCT project_id, iso3166_2, min(year) AS first_year, max(year) AS last_year, 'dense' AS data_type FROM public.country_production p WHERE
        p.project_id <> '' AND ((iso3166_ = p.iso3166 AND iso3166_2_ = p.iso3166_2) OR (iso3166_ = p.iso3166 AND iso3166_2_ = ''))
 GROUP BY project_id, iso3166_2 ORDER BY project_id)
UNION
(
    WITH sdp_year AS (SELECT sparse_project_id, min(year) AS first_year, max(year) AS last_year
                      FROM public.sparse_data_point sdp
                      GROUP BY sdp.sparse_project_id)
    SELECT project_id, iso3166_2, min(first_year), max(last_year), 'sparse' AS data_type
    FROM public.sparse_projects sp, sdp_year
    WHERE sdp_year.sparse_project_id = sp.id AND
        ((iso3166_ = sp.iso3166 AND iso3166_2_ = sp.iso3166_2) OR (iso3166_ = sp.iso3166 AND iso3166_2_ = ''))
    GROUP BY project_id, iso3166_2
)
ORDER BY project_id;
$$;
GRANT EXECUTE ON FUNCTION public.get_projects TO grff;

DROP TABLE IF EXISTS public.project_geo;
CREATE TABLE public.project_geo (
    iso3166 TEXT NOT NULL,
    project_id text NOT NULL,
    geom geometry NOT NULL,
    CONSTRAINT project_geo_pk PRIMARY KEY (iso3166, project_id)
);
GRANT SELECT ON TABLE public.project_geo TO grff;
