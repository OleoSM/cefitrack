-- Documentos institucionales por tipo (pedido de CEFIMAT, 2026-11-18):
-- además del T&C, el Aviso de Privacidad y la Garantía se publican como PDF
-- versionado, con un solo documento activo POR TIPO.
--
-- Compatible con el frontend anterior: las filas existentes quedan como 'tyc'
-- y, mientras no se active otro tipo, sigue habiendo un único activo.
-- Publicar privacidad/garantía SOLO después de desplegar el frontend nuevo
-- (el viejo pide "el activo" con maybeSingle y fallaría con dos).

alter table public.terms_documents
  add column if not exists tipo text not null default 'tyc';

alter table public.terms_documents drop constraint if exists terms_documents_tipo_check;
alter table public.terms_documents
  add constraint terms_documents_tipo_check check (tipo in ('tyc', 'privacidad', 'garantia'));

drop index if exists public.terms_documents_one_active_idx;
create unique index if not exists terms_documents_un_activo_por_tipo
  on public.terms_documents (tipo) where is_active;
