-- Marca evento como esgotado no calendário público (hover "Esgotado", sem link de ingresso/fotos).

alter table public.douha_events
  add column if not exists sold_out boolean not null default false;

comment on column public.douha_events.sold_out is
  'Quando true, o card no calendário não abre ingresso nem fotos; hover exibe Esgotado.';
