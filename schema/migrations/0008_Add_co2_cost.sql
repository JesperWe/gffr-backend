create table if not exists "co2_costs" (
		"cost_per_ton" integer not null,
		"currency" varchar(3) not null default 'USD',
		"source" text,
		"year" integer not null,
		primary key ( "cost_per_ton" , "currency" , "source", "year"  )
);