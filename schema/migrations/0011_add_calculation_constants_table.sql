BEGIN TRANSACTION;

DO $$ BEGIN
    CREATE TYPE public.constant_type_enum AS ENUM (
        'BARRELS_PER_TON',
        'PETAJOULES_PER_MILLION_CUBIC_METRES_GAS',
        'BOE_PER_E6M3',
        'EIA_NON_FUEL_USE_RATIO',
        'IPCC_MASS_TO_ENERGY',
        'IPCC_ENERGY_TO_EMISSIONS',
        'PRODUCTION_CO2_FACTOR',
        'METHANE_INTENSITY',
        'METHANE_FACTORISATION',
        'COMBUSTION_EMISSIONS_CO2E_FACTOR'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE public.modifier_enum AS ENUM (
        'GWP100', 
        'GWP20', 
        'sparse-scope1'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS public.calculation_constants (
    id uuid DEFAULT uuid_generate_v4(),
    constant_type constant_type_enum NOT NULL,
    authority VARCHAR(20) NOT NULL,
    unit VARCHAR(20) NOT NULL,
    low float8,
    factor float8 NOT NULL,
    high float8,
    fossil_fuel_type VARCHAR(20),
    description VARCHAR(500),
    reference TEXT,
    modifier modifier_enum,
    subtype VARCHAR(20),
    country VARCHAR(2),
    project_id INTEGER,
    quality INTEGER,

    PRIMARY KEY(id),
    
    CONSTRAINT fk_calculation_constants_project
      FOREIGN KEY(project_id) 
	  REFERENCES public.project(id),

    UNIQUE(
        constant_type, 
        authority, 
        fossil_fuel_type,
        modifier,
        subtype,
        country,
        project_id
    )
);

GRANT SELECT ON TABLE public.calculation_constants TO grff;

COMMIT;