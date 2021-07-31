ALTER TABLE public.conversion_constant ADD COLUMN IF NOT EXISTS subtype varchar(20) NULL;
ALTER TABLE public.conversion_constant ADD COLUMN IF NOT EXISTS country varchar(3) NULL;
