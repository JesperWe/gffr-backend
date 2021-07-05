ALTER TABLE public.country_production ADD COLUMN IF NOT EXISTS project_id text NULL;
ALTER TABLE public.country_production ADD COLUMN IF NOT EXISTS iso3166_2 text NULL;

DROP FUNCTION get_producing_iso3166();
CREATE OR REPLACE FUNCTION public.get_producing_iso3166()
    RETURNS TABLE (iso3166 text, iso3166_2 TEXT, en TEXT, fr TEXT, es TEXT, sv text)
    LANGUAGE sql STABLE
AS $$
   SELECT DISTINCT prod.iso3166, prod.iso3166_2, c.en, c.fr, c.es, c.sv FROM public.country_production prod
     JOIN public.countries c ON c.iso3166 = prod.iso3166;
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
	iso3166_2 varchar NULL,
	en text NOT NULL,
	es text NULL,
	fr text NULL,
	sv text NULL
);
ALTER TABLE public.countries ADD CONSTRAINT countries_pk PRIMARY KEY (iso3166);
GRANT SELECT ON TABLE public.countries TO grff;
