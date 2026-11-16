-- Schools added + typed-in answers matched (Nick, 2026-11-16). Idempotent.
--
-- Four schools students had to type in because they weren't in the list
-- (YES Philly is a partner). Then each typed-in answer that clearly names a
-- listed school is linked to it — two "Furness" entries were for Horace
-- Furness High School, which WAS listed but students looked for it under F.
-- Left as typed on purpose: "Woodrow Wilson High School" (ambiguous — several
-- schools have that name) and "Community college Philadelphia" (not a HS).

insert into public.schools (name, is_partner) values
  ('MaST Community Charter School III', false),
  ('Monsignor Bonner & Archbishop Prendergast Catholic High School', false),
  ('One Bright Ray Community High School - Simpson Campus', false),
  ('YES Philly', true)
on conflict (name) do update set is_partner = excluded.is_partner;

with matches (typed, school_name) as (values
  ('furness, horace hs',               'Horace Furness High School'),
  ('howard horace furness highschool', 'Horace Furness High School'),
  ('mast community charter school 3',  'MaST Community Charter School III'),
  ('monseignor bonner prendie',        'Monsignor Bonner & Archbishop Prendergast Catholic High School'),
  ('one bright ray simpson',           'One Bright Ray Community High School - Simpson Campus'),
  ('yesphilly',                        'YES Philly')
)
update public.applications a
set school_id = s.id,
    school_other = null
from matches m
join public.schools s on s.name = m.school_name
where lower(trim(a.school_other)) = m.typed;
