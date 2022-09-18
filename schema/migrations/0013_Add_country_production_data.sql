ALTER TABLE public.country ADD COLUMN IF NOT EXISTS production_snapshot_data jsonb NULL;
GRANT SELECT ON TABLE public.country TO grff;