
CREATE TABLE if not exists public.prefix_conversions (
	from_prefix varchar(20) NOT NULL,
	to_prefix varchar(20) NOT NULL,
	factor float8 NOT NULL,
	CONSTRAINT prefix_conversions_pk PRIMARY KEY (from_prefix, to_prefix, factor)
);

GRANT SELECT ON TABLE public.prefix_conversions TO grff;


INSERT INTO public.prefix_conversions (from_prefix,to_prefix,factor)
	VALUES ('e9m3','e3m3',1000000.0);
INSERT INTO public.prefix_conversions (from_prefix,to_prefix,factor)
	VALUES ('e12m3','e9m3',1000.0);
INSERT INTO public.prefix_conversions (from_prefix,to_prefix,factor)
	VALUES ('e3bbl','bbl',1000.0);
INSERT INTO public.prefix_conversions (from_prefix,to_prefix,factor)
	VALUES ('e6bbl','bbl',1000000.0);
INSERT INTO public.prefix_conversions (from_prefix,to_prefix,factor)
	VALUES ('e9bbl','bbl',1000000000);
INSERT INTO public.prefix_conversions (from_prefix,to_prefix,factor)
	VALUES ('e6m3','m3',1000000.0);
INSERT INTO public.prefix_conversions (from_prefix,to_prefix,factor)
	VALUES ('e9m3','m3',1000000000);
INSERT INTO public.prefix_conversions (from_prefix,to_prefix,factor)
	VALUES ('e6tonnes','e6ton',1.0);
INSERT INTO public.prefix_conversions (from_prefix,to_prefix,factor)
	VALUES ('Gg','tonne',1000.0);
INSERT INTO public.prefix_conversions (from_prefix,to_prefix,factor)
	VALUES ('e9feet3','e9m3',0.0283168466);
INSERT INTO public.prefix_conversions (from_prefix,to_prefix,factor)
	VALUES ('e12feet3','e9m3',28.3168466);
INSERT INTO public.prefix_conversions (from_prefix,to_prefix,factor)
	VALUES ('e6bbl','e3bblsday',2.739726);
INSERT INTO public.prefix_conversions (from_prefix,to_prefix,factor)
	VALUES ('e9bbl','e6bbl',1000.0);
INSERT INTO public.prefix_conversions (from_prefix,to_prefix,factor)
	VALUES ('bbl','e6bbl',0.000001);
INSERT INTO public.prefix_conversions (from_prefix,to_prefix,factor)
	VALUES ('ton','tonne',1.0);
INSERT INTO public.prefix_conversions (from_prefix,to_prefix,factor)
	VALUES ('tonne','ton',1.0);
INSERT INTO public.prefix_conversions (from_prefix,to_prefix,factor)
	VALUES ('e6ton','ton',1000000.0);
INSERT INTO public.prefix_conversions (from_prefix,to_prefix,factor)
	VALUES ('e9ton','ton',1000000000);
INSERT INTO public.prefix_conversions (from_prefix,to_prefix,factor)
	VALUES ('GJ','TJ',1000.0);
INSERT INTO public.prefix_conversions (from_prefix,to_prefix,factor)
	VALUES ('e3bblsday','bbl',365000.0);
INSERT INTO public.prefix_conversions (from_prefix,to_prefix,factor)
	VALUES ('e6m3','e9m3',0.001);
INSERT INTO public.prefix_conversions (from_prefix,to_prefix,factor)
	VALUES ('PJ','GJ',1000000.0);
INSERT INTO public.prefix_conversions (from_prefix,to_prefix,factor)
	VALUES ('e6boe','boe',1000000.0);
INSERT INTO public.prefix_conversions (from_prefix,to_prefix,factor)
	VALUES ('e3m3','e9m3',0.000001);
INSERT INTO public.prefix_conversions (from_prefix,to_prefix,factor)
	VALUES ('e3bbls','e3bbl',1.0);
INSERT INTO public.prefix_conversions (from_prefix,to_prefix,factor)
	VALUES ('ton','Gg',0.001);
INSERT INTO public.prefix_conversions (from_prefix,to_prefix,factor)
	VALUES ('TJ','PJ',0.001);
INSERT INTO public.prefix_conversions (from_prefix,to_prefix,factor)
	VALUES ('TJ','GJ',1000.0);
INSERT INTO public.prefix_conversions (from_prefix,to_prefix,factor)
	VALUES ('Tg','Gg',1000.0);
INSERT INTO public.prefix_conversions (from_prefix,to_prefix,factor)
	VALUES ('e6feet3','e6m3',0.0283168);
INSERT INTO public.prefix_conversions (from_prefix,to_prefix,factor)
	VALUES ('e6ton','e3ton',1000.0);
INSERT INTO public.prefix_conversions (from_prefix,to_prefix,factor)
	VALUES ('e6bbls','e6bbl',1.0);
INSERT INTO public.prefix_conversions (from_prefix,to_prefix,factor)
	VALUES ('tonnes','ton',1.0);
INSERT INTO public.prefix_conversions (from_prefix,to_prefix,factor)
	VALUES ('e3ton','ton',1000.0);
INSERT INTO public.prefix_conversions (from_prefix,to_prefix,factor)
	VALUES ('kg','tonne',0.001);
INSERT INTO public.prefix_conversions (from_prefix,to_prefix,factor)
	VALUES ('e3shorttons','e3ton',0.90718474);
INSERT INTO public.prefix_conversions (from_prefix,to_prefix,factor)
	VALUES ('e3m3','e6m3',0.001);
INSERT INTO public.prefix_conversions (from_prefix,to_prefix,factor)
	VALUES ('bbls','bbl',1.0);
INSERT INTO public.prefix_conversions (from_prefix,to_prefix,factor)
	VALUES ('e3feet3','e9m3',0.0000000283168466);
INSERT INTO public.prefix_conversions (from_prefix,to_prefix,factor)
	VALUES ('e9bbls','e9bbl',1.0);
INSERT INTO public.prefix_conversions (from_prefix,to_prefix,factor)
	VALUES ('bblsday','bbl',365.0);
INSERT INTO public.prefix_conversions (from_prefix,to_prefix,factor)
	VALUES ('e6tons','ton',1000000.0);
INSERT INTO public.prefix_conversions (from_prefix,to_prefix,factor)
	VALUES ('ton','e6ton',0.000001);
