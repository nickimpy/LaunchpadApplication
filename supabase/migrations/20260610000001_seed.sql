-- Launchpad Application Portal — Phase 1 seed data
-- Schools from school-dropdown-options.json (synced June 10, 2026):
-- 82 schools, 31 flagged as Track A partners.
-- 'Other' is a UI option, not a row. Match on school id, never on name.

insert into public.schools (name, is_partner) values
  ('21st Century Cyber Charter School', false),
  ('Abington Senior High School', false),
  ('Abraham Lincoln High School', true),
  ('Academy Park High School', false),
  ('Agora Cyber Charter School', false),
  ('Arts Academy at Benjamin Rush', true),
  ('ASPIRA Bilingual Cyber Charter School', false),
  ('Belmont Charter High School', true),
  ('Benjamin Franklin High School', false),
  ('Building 21', true),
  ('Central High School', false),
  ('Cheltenham High School', false),
  ('Commonwealth Charter Academy', false),
  ('Constitution High School', false),
  ('Cristo Rey Philadelphia High School', false),
  ('Esperanza Cyber Charter School', false),
  ('Excel Academy North', false),
  ('Excel Academy South', false),
  ('First Philadelphia Preparatory Charter School', false),
  ('Franklin Learning Center', true),
  ('Freire Charter School', false),
  ('George Washington Carver High School of Engineering and Science', true),
  ('George Washington High School', true),
  ('Girard Academic Music Program (GAMP)', false),
  ('Girard College', false),
  ('Horace Furness High School', true),
  ('Imhotep Institute Charter High School', true),
  ('John Bartram High School', true),
  ('Jules E. Mastbaum High School', true),
  ('Julia R. Masterman School', false),
  ('Kensington Creative and Performing Arts High School (KCAPA)', true),
  ('Kensington High School', true),
  ('KIPP DuBois Collegiate Academy', false),
  ('Little Flower Catholic High School for Girls', false),
  ('Martin Luther King High School', true),
  ('Mastery Charter School - Gratz Campus', true),
  ('Mastery Charter School - Hardy Williams Campus', true),
  ('Mastery Charter School - Lenfest Campus', true),
  ('Mastery Charter School - Shoemaker Campus', true),
  ('Mastery Charter School - Thomas Campus', true),
  ('Mastery High School of Camden', false),
  ('Mercy Career & Technical High School', true),
  ('Motivation High School', false),
  ('Multicultural Academy Charter School', true),
  ('Murrell Dobbins Career and Technical Education High School', false),
  ('Northeast High School', true),
  ('Olney High School', true),
  ('Overbrook High School', false),
  ('Parkway Center City Middle College', false),
  ('Parkway West High School', true),
  ('Penn Treaty School', true),
  ('Pennsylvania Cyber Charter School', false),
  ('Pennsylvania Distance Learning Charter School', false),
  ('Pennsylvania Leadership Charter School', false),
  ('Pennsylvania Virtual Charter School', false),
  ('Philadelphia Academy Charter School', false),
  ('Philadelphia High School for the Creative and Performing Arts (CAPA)', false),
  ('Philadelphia Performing Arts: A String Theory Charter School', false),
  ('Philadelphia Virtual Academy', false),
  ('Preparatory Charter School of Mathematics, Science, Technology and Careers', false),
  ('Reach Cyber Charter School', false),
  ('Roman Catholic High School', false),
  ('Roxborough High School', false),
  ('Samuel Fels High School', false),
  ('School of the Future', false),
  ('Science Leadership Academy (Center City)', false),
  ('Science Leadership Academy at Beeber', true),
  ('South Philadelphia High School', true),
  ('Strawberry Mansion High School', true),
  ('Swenson Arts and Technology High School', false),
  ('TECH Freire Charter School', false),
  ('The LINC High School', false),
  ('The Philly Free School', false),
  ('The U School', true),
  ('The Workshop School', true),
  ('Universal Audenried Charter High School', true),
  ('Vaux Big Picture High School', false),
  ('West Catholic Preparatory High School', false),
  ('West Philadelphia High School', false),
  ('William L. Sayre High School', false),
  ('William W. Bodine High School for International Affairs', false),
  ('Woodlynde School', false)
on conflict (name) do update set is_partner = excluded.is_partner;

-- Active cycle + admin-editable defaults (all of this is placeholder copy
-- that staff update in the admin dashboard; nothing cycle-specific is
-- hardcoded in the app)
with cycle as (
  insert into public.cycles (name, is_active)
  values ('2026-2027', true)
  on conflict (name) do update set is_active = excluded.is_active
  returning id
),
settings as (
  insert into public.cycle_settings (cycle_id, key, value)
  select cycle.id, s.key, s.value
  from cycle, (values
    ('summer_location', '"801 Market St, Philadelphia, PA"'::jsonb),
    ('summer_dates', '"TBD — set in admin settings"'::jsonb),
    ('program_info_lightspeed', '"TBD — Lightspeed program description (admin-editable)"'::jsonb),
    ('program_info_foundations', '"TBD — Foundations program description (admin-editable)"'::jsonb),
    ('parent_form_consent_text', '"TBD — consent language pending review (see PRD); editable here before launch"'::jsonb),
    ('contact_email', '"info@launchpadphilly.org"'::jsonb),
    ('step_deadlines', '{}'::jsonb)
  ) as s (key, value)
  on conflict (cycle_id, key) do nothing
  returning 1
)
-- Step 3 beta placeholder prompt (full scaffolded set replaces this later
-- as a data change, not a code change)
insert into public.essay_prompts (cycle_id, prompt, sort_order)
select cycle.id, 'Why do you want to join Launchpad?', 1
from cycle
where not exists (
  select 1 from public.essay_prompts ep, cycle c where ep.cycle_id = c.id
);
