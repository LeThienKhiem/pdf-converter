-- New accounts start on the free monthly quota, not with "legacy credits".
--
-- handle_new_user granted 3 credits to every signup, and consume_page treats
-- credits as paid usage: Sonnet, no 10-page limit, no watermark, categories,
-- QuickBooks export. So a free account got the paid product three times over
-- and the $2 Week Pass had no reason to exist — six of seven signed-in
-- extractions in the week of Oct 10 ran on the premium model on free plans.
--
-- Credits remain for people who bought a credit pack; existing balances are
-- left untouched. The free tier is the 3-per-30-days quota in consume_page.

alter table public.users alter column credits set default 0;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email, credits)
  values (new.id, new.email, 0);
  return new;
end;
$$;
