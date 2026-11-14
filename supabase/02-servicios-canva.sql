-- ==========================================================
-- Actualización: servicios como en el Canva (foto, "la experiencia incluye", duración).
-- Correr UNA vez en Supabase → SQL Editor, después de schema.sql.
-- Se puede volver a correr sin romper nada.
-- ==========================================================

alter table public.services add column if not exists includes text not null default '';
alter table public.services add column if not exists duration text not null default '';
alter table public.services add column if not exists image_url text not null default '';
alter table public.services add column if not exists image_path text;

-- Borra los servicios de ejemplo de la primera versión
delete from public.services
where title in ('Maquillaje social', 'Novias', 'Clase de automaquillaje')
   or (title = 'Quinceañeras' and price = '$ 45.000');

-- Carga los servicios del Canva (solo si la tabla quedó vacía)
insert into public.services (title, description, price, includes, duration, sort)
select * from (values
  ('Social makeup',
   'Maquillaje profesional personalizado para eventos, fiestas y ocasiones especiales. Un look diseñado según tus facciones, estilo y preferencias.',
   '$85.000',
   E'Preparación profesional de la piel.\nMaquillaje personalizado.\nAplicación de pestañas.\nTécnicas de larga duración.',
   '2 horas.', 1),
  ('Quinceañeras',
   'Un maquillaje especial para una noche inolvidable. Un look personalizado que acompañe tu vestido, tu estilo y la esencia de tu celebración.',
   '$140.000',
   E'Prueba de maquillaje previa obligatoria.\nPreparación profesional de la piel.\nDiseño personalizado.\nKit de retoque.',
   '2 horas + prueba previa.', 2),
  ('Bridal makeup',
   'Una experiencia de maquillaje pensada especialmente para tu gran día. Un look que refleje tu personalidad y te haga sentir vos misma.',
   '$140.000',
   E'Asesoramiento personalizado.\nPrueba de maquillaje previa obligatoria.\nPreparación de la piel.\nAplicación de pestañas.\nTécnicas de larga duración.\nKit de retoque.',
   '2 horas + prueba previa.', 3)
) as v(title, description, price, includes, duration, sort)
where not exists (select 1 from public.services);
