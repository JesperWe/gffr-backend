ALTER TABLE public.country_production ADD COLUMN IF NOT EXISTS project_id text NOT NULL DEFAULT '';
ALTER TABLE public.country_production ADD COLUMN IF NOT EXISTS iso3166_2 text NOT NULL DEFAULT '';

ALTER TABLE public.country_reserves ADD COLUMN IF NOT EXISTS project_id text NOT NULL DEFAULT '';
ALTER TABLE public.country_reserves ADD COLUMN IF NOT EXISTS iso3166_2 text NOT NULL DEFAULT '';

CREATE OR REPLACE FUNCTION public.get_producing_iso3166()
    RETURNS TABLE (iso3166 text, iso3166_2 TEXT, en TEXT, fr TEXT, es TEXT, sv text)
    LANGUAGE sql STABLE
AS $$
   SELECT DISTINCT prod.iso3166, prod.iso3166_2, c.en, c.fr, c.es, c.sv FROM
   	(SELECT DISTINCT iso3166, COALESCE(iso3166_2, '') AS iso3166_2 FROM public.country_production) prod
     JOIN public.countries c ON c.iso3166 = prod.iso3166 AND c.iso3166_2 = prod.iso3166_2
     ORDER BY prod.iso3166;
$$;

GRANT SELECT ON TABLE public.languages TO grff;
GRANT SELECT ON TABLE public.sources TO grff;
GRANT SELECT ON TABLE public.country_production TO grff;
GRANT SELECT ON TABLE public.country_reserves TO grff;
GRANT SELECT ON TABLE public.ne_country TO grff;
GRANT SELECT ON TABLE public.pages TO grff;

DROP TABLE IF EXISTS public.countries;

CREATE TABLE public.countries (
	iso3166 varchar NOT NULL,
	iso3166_2 varchar NOT NULL DEFAULT '',
	en text NOT NULL,
	es text NULL,
	fr text NULL,
	sv text NULL,
	CONSTRAINT countries_pk PRIMARY KEY (iso3166, iso3166_2)
);

GRANT SELECT ON TABLE public.countries TO grff;

DROP FUNCTION IF EXISTS get_projects(text, text);
CREATE OR REPLACE FUNCTION public.get_projects(iso3166_ TEXT, iso3166_2_ text)
    RETURNS TABLE (project_id TEXT, iso3166_2 TEXT )
    LANGUAGE sql STABLE
AS $$
	SELECT DISTINCT project_id, iso3166_2 FROM public.country_production p WHERE (iso3166_ = p.iso3166 AND iso3166_2_ = p.iso3166_2) OR (iso3166_ = p.iso3166 AND iso3166_2_ = '')
		ORDER BY project_id;
$$;

DROP FUNCTION IF EXISTS get_production_sources(text, text, text);
CREATE OR REPLACE FUNCTION public.get_production_sources(iso3166_ TEXT, iso3166_2_ TEXT = '', project_id_ TEXT = '' )
    RETURNS SETOF sources
    LANGUAGE sql STABLE
AS $$
	SELECT * FROM public.sources s WHERE s.source_id IN (
		SELECT DISTINCT source_id FROM public.country_production p
		WHERE
				p.projection = FALSE AND
				(iso3166_ = p.iso3166 AND p.iso3166_2 = iso3166_2_ AND p.project_id = project_id_)
	)
$$;
GRANT EXECUTE ON FUNCTION public.get_production_sources TO grff;

DROP FUNCTION IF EXISTS get_projection_sources(text, text, text);
CREATE OR REPLACE FUNCTION public.get_projection_sources(iso3166_ TEXT, iso3166_2_ TEXT = '', project_id_ TEXT = '' )
    RETURNS SETOF sources
    LANGUAGE sql STABLE
AS $$
	SELECT * FROM public.sources s WHERE s.source_id IN (
		SELECT DISTINCT source_id FROM public.country_production p
		WHERE
				p.projection = TRUE AND
				(iso3166_ = p.iso3166 AND p.iso3166_2 = iso3166_2_ AND p.project_id = project_id_)
	) OR s.source_id = 100
$$;
GRANT EXECUTE ON FUNCTION public.get_projection_sources TO grff;

DROP FUNCTION IF EXISTS get_reserves_sources(text, text, text);
CREATE OR REPLACE FUNCTION public.get_reserves_sources(iso3166_ TEXT, iso3166_2_ TEXT = '', project_id_ TEXT = '' )
    RETURNS TABLE (source_id integer, name TEXT, name_pretty TEXT, description TEXT, url TEXT, grades TEXT, YEAR integer, quality integer)
    LANGUAGE sql STABLE
AS $$
SELECT a.source_id, a.name, a.name_pretty, a.description, a.url, b.grades, b.YEAR, b.quality FROM
	(	SELECT * FROM public.sources s WHERE s.source_id IN (
		SELECT DISTINCT source_id FROM public.country_reserves p
		WHERE
				(iso3166_ = p.iso3166 AND p.iso3166_2 = iso3166_2_ AND p.project_id = project_id_)
	) ) a
	LEFT OUTER JOIN
		(SELECT string_agg(DISTINCT grade, '/') AS grades, max(YEAR) AS YEAR, max(quality)::integer AS quality, source_id FROM public.country_reserves WHERE iso3166=iso3166_ GROUP BY source_id) b
		ON a.source_id = b.source_id
	ORDER BY quality DESC;
$$;
GRANT EXECUTE ON FUNCTION public.get_reserves_sources TO grff;
