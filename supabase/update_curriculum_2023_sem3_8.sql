-- ============================================================================
-- GRADE PAL — UPDATE: CURRICULUM 2023, SEMESTERS 3–8
-- Run after supabase/seed_curriculum_2023.sql has been run once:
-- SQL Editor → New query → paste → Run. Safe to re-run.
--
-- Brings every department's semester 3–8 core modules in line with the
-- FoE UoR Student Handbook 2025/2026 (27th batch), sections 5.3.2 (DCEE),
-- 6.4.2 (DEIE), 6.5.2 (DCE), 7.3.2 (DMME) and 8.3.2 (DMENA).
--
-- What changes (DCEE and DMME are unchanged):
--   DEIE   EE3204→EE3304 (2→3 cr), EE5102→EE5202 (1→2 cr), EE7202→EE7302
--          (2→3 cr), EE8202→EE8201; Engineering Ethics and Numerical Methods
--          move from sem 6 to sem 5 (IS5101, IS5302); IS5311 Discrete Maths
--          and EE6105 Research Methodologies dropped; IS6301 Mathematical
--          Modelling added in sem 6.
--   DCE    Sem 5: EC5202 is now Digital Systems Design with HDL (Electronic
--          Circuit Design dropped), Operating Systems and Network Programming
--          is EC5205, Software Group Project is EC5406, Discrete Maths is
--          IS5311. Engineering Ethics and Numerical Methods move to sem 6
--          (IS6102, IS6303). Information Security moves from sem 7 to sem 6
--          (EC6204).
--   DMENA  MN5306 Marine Refrigeration, MN6205 Maritime English III, MN6307
--          and MN6308 dropped; Instrumentation and Control Systems II is
--          MN6205; MN6206 Marine Engine Room Simulator Training I added;
--          MN8304 is now Marine Engine Room Simulator Training II;
--          MN7201 renamed Automated Systems.
--
-- Students' grades are kept wherever the module is the same subject under a
-- new code or semester. A dropped module is deleted only if nobody has a grade
-- on it; any that are kept are listed by the check at the end so you can
-- review them in Admin → Modules.
-- ============================================================================

begin;

-- kept until the end of this run so the checks below can use it
drop table if exists pg_temp.handbook;
create temp table handbook (
  department text, semester_number integer, code text, name text,
  credits numeric, sort_order integer
);

insert into handbook (department, semester_number, code, name, credits, sort_order) values
  ('DCEE', 3, 'CE3201', 'Concrete Technology', 2, 0),
  ('DCEE', 3, 'CE3202', 'Construction Processes and Technology', 2, 1),
  ('DCEE', 3, 'CE3303', 'Engineering Surveying', 3, 2),
  ('DCEE', 3, 'CE3304', 'Fluid Mechanics', 3, 3),
  ('DCEE', 3, 'CE3205', 'Structural Analysis I', 2, 4),
  ('DCEE', 3, 'IS3301', 'Complex Analysis and Mathematical Transforms', 3, 5),
  ('DCEE', 3, 'IS3322', 'Society and the Engineer', 3, 6),
  ('DCEE', 4, 'CE4301', 'Building Planning and Cost Estimating', 3, 0),
  ('DCEE', 4, 'CE4302', 'Design of Concrete Structures I', 3, 1),
  ('DCEE', 4, 'CE4303', 'Engineering Geology and Soil Mechanics', 3, 2),
  ('DCEE', 4, 'CE4304', 'Structural Analysis II', 3, 3),
  ('DCEE', 4, 'CE4305', 'Water and Wastewater Engineering', 3, 4),
  ('DCEE', 4, 'IS4301', 'Probability and Statistics', 3, 5),
  ('DCEE', 5, 'CE5201', 'Building Services Engineering', 2, 0),
  ('DCEE', 5, 'CE5202', 'Design of Steel Structures', 2, 1),
  ('DCEE', 5, 'CE5303', 'Hydraulic Engineering', 3, 2),
  ('DCEE', 5, 'CE5204', 'Structural Analysis III', 2, 3),
  ('DCEE', 5, 'CE5205', 'Traffic and Transport Engineering', 2, 4),
  ('DCEE', 5, 'IS5101', 'Engineering Ethics', 1, 5),
  ('DCEE', 5, 'IS5302', 'Numerical Methods', 3, 6),
  ('DCEE', 6, 'CE6301', 'Design of Concrete Structures II', 3, 0),
  ('DCEE', 6, 'CE6302', 'Engineering Hydrology', 3, 1),
  ('DCEE', 6, 'CE6303', 'Environmental Engineering Design', 3, 2),
  ('DCEE', 6, 'CE6304', 'Geotechnical Engineering', 3, 3),
  ('DCEE', 6, 'CE6105', 'Surveying Work Camp', 1, 4),
  ('DCEE', 6, 'IS6301', 'Mathematical Modelling', 3, 5),
  ('DCEE', 7, 'CE7401', 'Comprehensive Design Project', 4, 0),
  ('DCEE', 7, 'CE7302', 'Construction Environmental Management', 3, 1),
  ('DCEE', 7, 'CE7303', 'Geotechnical Engineering Design', 3, 2),
  ('DCEE', 7, 'CE7204', 'Integrated Solid Waste Management', 2, 3),
  ('DCEE', 7, 'CE7205', 'Matrix Structural Analysis and Finite Element Method', 2, 4),
  ('DCEE', 7, 'CE7606', 'Undergraduate Research Project', 6, 5),
  ('DCEE', 8, 'CE8302', 'Construction Management', 3, 0),
  ('DCEE', 8, 'CE8303', 'Highway and Pavement Engineering', 3, 1),
  ('DEIE', 3, 'EE3301', 'Analog Electronics', 3, 0),
  ('DEIE', 3, 'EE3202', 'Data Structures and Algorithms', 2, 1),
  ('DEIE', 3, 'EE3203', 'Electrical and Electronic Measurements', 2, 2),
  ('DEIE', 3, 'EE3304', 'Engineering Electromagnetism', 3, 3),
  ('DEIE', 3, 'EE3205', 'Power and Energy', 2, 4),
  ('DEIE', 3, 'EE3306', 'Signals and Systems', 3, 5),
  ('DEIE', 3, 'IS3301', 'Complex Analysis and Mathematical Transforms', 3, 6),
  ('DEIE', 3, 'IS3321', 'Fundamentals of Management for Engineers', 3, 7),
  ('DEIE', 3, 'IS3322', 'Society and the Engineer', 3, 8),
  ('DEIE', 4, 'EE4201', 'Analog and Digital Communication', 2, 0),
  ('DEIE', 4, 'EE4202', 'Computer Architecture and Operating Systems', 2, 1),
  ('DEIE', 4, 'EE4203', 'Database Systems', 2, 2),
  ('DEIE', 4, 'EE4304', 'Digital Logic Design', 3, 3),
  ('DEIE', 4, 'EE4305', 'Electric Machines', 3, 4),
  ('DEIE', 4, 'EE4206', 'Engineering Design Methodology', 2, 5),
  ('DEIE', 4, 'EE4207', 'Web Application Development', 2, 6),
  ('DEIE', 4, 'IS4301', 'Probability and Statistics', 3, 7),
  ('DEIE', 4, 'IS4322', 'Basic Economics', 3, 8),
  ('DEIE', 5, 'EE5201', 'Communication Systems', 2, 0),
  ('DEIE', 5, 'EE5202', 'Electronic Circuit Design', 2, 1),
  ('DEIE', 5, 'EE5203', 'Machine Learning', 2, 2),
  ('DEIE', 5, 'EE5304', 'Power Electronics', 3, 3),
  ('DEIE', 5, 'EE5305', 'Power Systems', 3, 4),
  ('DEIE', 5, 'EE5206', 'Software Project', 2, 5),
  ('DEIE', 5, 'IS5101', 'Engineering Ethics', 1, 6),
  ('DEIE', 5, 'IS5302', 'Numerical Methods', 3, 7),
  ('DEIE', 6, 'EE6301', 'Computer Networks', 3, 0),
  ('DEIE', 6, 'EE6302', 'Control Systems Design', 3, 1),
  ('DEIE', 6, 'EE6203', 'Digital Signal Processing', 2, 2),
  ('DEIE', 6, 'EE6304', 'Embedded Systems Design', 3, 3),
  ('DEIE', 6, 'IS6301', 'Mathematical Modelling', 3, 4),
  ('DEIE', 7, 'EE7201', 'Design and Management of Networks', 2, 0),
  ('DEIE', 7, 'EE7302', 'Electrical Installations', 3, 1),
  ('DEIE', 7, 'EE7803', 'Undergraduate Project', 8, 2),
  ('DEIE', 8, 'EE8201', 'Comprehensive Design Project', 2, 0),
  ('DCE', 3, 'EC3301', 'Analog Electronics', 3, 0),
  ('DCE', 3, 'EC3202', 'Data Structures and Algorithms', 2, 1),
  ('DCE', 3, 'EC3203', 'Electrical and Electronic Measurements', 2, 2),
  ('DCE', 3, 'EC3404', 'GUI Programming', 4, 3),
  ('DCE', 3, 'EC3305', 'Signals and Systems', 3, 4),
  ('DCE', 3, 'IS3301', 'Complex Analysis and Mathematical Transforms', 3, 5),
  ('DCE', 3, 'IS3321', 'Fundamentals of Management for Engineers', 3, 6),
  ('DCE', 3, 'IS3322', 'Society and the Engineer', 3, 7),
  ('DCE', 4, 'EC4201', 'Advanced Data Structures and Algorithms', 2, 0),
  ('DCE', 4, 'EC4202', 'Computer Architecture and Operating Systems', 2, 1),
  ('DCE', 4, 'EC4203', 'Database Systems', 2, 2),
  ('DCE', 4, 'EC4304', 'Digital Logic Design', 3, 3),
  ('DCE', 4, 'EC4205', 'Software Engineering Principles', 2, 4),
  ('DCE', 4, 'EC4206', 'Software Testing and Quality Assurance', 2, 5),
  ('DCE', 4, 'EC4307', 'Web Application Development', 3, 6),
  ('DCE', 4, 'IS4301', 'Probability and Statistics', 3, 7),
  ('DCE', 4, 'IS4322', 'Basic Economics', 3, 8),
  ('DCE', 5, 'EC5301', 'Control System Design', 3, 0),
  ('DCE', 5, 'EC5202', 'Digital Systems Design with HDL', 2, 1),
  ('DCE', 5, 'EC5203', 'Machine Learning', 2, 2),
  ('DCE', 5, 'EC5204', 'Object Oriented Design Patterns and Principles', 2, 3),
  ('DCE', 5, 'EC5205', 'Operating Systems and Network Programming', 2, 4),
  ('DCE', 5, 'EC5406', 'Software Group Project', 4, 5),
  ('DCE', 5, 'IS5311', 'Discrete Mathematics', 3, 6),
  ('DCE', 6, 'EC6301', 'Artificial Intelligence', 3, 0),
  ('DCE', 6, 'EC6302', 'Computer Networks', 3, 1),
  ('DCE', 6, 'EC6303', 'Embedded Systems Design', 3, 2),
  ('DCE', 6, 'EC6204', 'Information Security', 2, 3),
  ('DCE', 6, 'EC6105', 'Research Methodologies', 1, 4),
  ('DCE', 6, 'IS6102', 'Engineering Ethics', 1, 5),
  ('DCE', 6, 'IS6303', 'Numerical Methods', 3, 6),
  ('DCE', 7, 'EC7802', 'Undergraduate Project', 8, 0),
  ('DMME', 3, 'ME3301', 'Applied Thermodynamics', 3, 0),
  ('DMME', 3, 'ME3202', 'Engineering Design Methodology', 2, 1),
  ('DMME', 3, 'ME3303', 'Fluid Mechanics', 3, 2),
  ('DMME', 3, 'ME3204', 'Manufacturing Processes and Practices', 2, 3),
  ('DMME', 3, 'ME3305', 'Metallurgy for Engineers', 3, 4),
  ('DMME', 3, 'ME3206', 'Strength of Materials', 2, 5),
  ('DMME', 3, 'IS3301', 'Complex Analysis and Mathematical Transforms', 3, 6),
  ('DMME', 4, 'ME4301', 'Advanced Materials Engineering', 3, 0),
  ('DMME', 4, 'ME4302', 'Design of Machine Elements', 3, 1),
  ('DMME', 4, 'ME4303', 'Manufacturing Engineering', 3, 2),
  ('DMME', 4, 'ME4304', 'Mechanics of Machines', 3, 3),
  ('DMME', 4, 'ME4305', 'Modelling and Analysis of Dynamic Systems', 3, 4),
  ('DMME', 4, 'IS4301', 'Probability and Statistics', 3, 5),
  ('DMME', 5, 'ME5301', 'Advanced Control Systems', 3, 0),
  ('DMME', 5, 'ME5302', 'Computer Aided Design', 3, 1),
  ('DMME', 5, 'ME5303', 'Mechanical Engineering Design', 3, 2),
  ('DMME', 5, 'ME5204', 'Production Planning and Control', 2, 3),
  ('DMME', 5, 'ME5305', 'Refrigeration and Air Conditioning', 3, 4),
  ('DMME', 5, 'IS5101', 'Engineering Ethics', 1, 5),
  ('DMME', 5, 'IS5302', 'Numerical Methods', 3, 6),
  ('DMME', 6, 'ME6201', 'Advanced Fluid Mechanics', 2, 0),
  ('DMME', 6, 'ME6302', 'Computer Aided Manufacturing', 3, 1),
  ('DMME', 6, 'ME6303', 'Electrical Machines', 3, 2),
  ('DMME', 6, 'ME6104', 'Industry-based Project', 1, 3),
  ('DMME', 6, 'ME6305', 'Maintenance Management', 3, 4),
  ('DMME', 6, 'ME6206', 'Power Hydraulics', 2, 5),
  ('DMME', 6, 'ME6207', 'Solid Mechanics', 2, 6),
  ('DMME', 7, 'ME7601', 'Comprehensive Design Project', 6, 0),
  ('DMME', 7, 'ME7402', 'Final Year Project', 4, 1),
  ('DMME', 7, 'ME7303', 'Heat and Mass Transfer', 3, 2),
  ('DMME', 7, 'ME7304', 'Production and Operations Management', 3, 3),
  ('DMME', 8, 'ME8301', 'Building Service Engineering', 3, 0),
  ('DMME', 8, 'ME8202', 'Lean Manufacturing and Supply Chain Management', 2, 1),
  ('DMENA', 3, 'MN3201', 'Fundamentals of Naval Architecture', 2, 0),
  ('DMENA', 3, 'MN3302', 'Engineering Knowledge (General) I', 3, 1),
  ('DMENA', 3, 'MN3303', 'Engineering Knowledge (Motor) I', 3, 2),
  ('DMENA', 3, 'MN3204', 'Maritime English I', 2, 3),
  ('DMENA', 3, 'MN3305', 'Hydrostatics and Stability of Marine Vehicles', 3, 4),
  ('DMENA', 3, 'MN3206', 'Marine Engineering Drawing', 2, 5),
  ('DMENA', 3, 'ME3204', 'Manufacturing Processes and Practices', 2, 6),
  ('DMENA', 3, 'ME3206', 'Strength of Materials', 2, 7),
  ('DMENA', 3, 'IS3302', 'Complex Analysis and Mathematical Transforms', 3, 8),
  ('DMENA', 4, 'MN4201', 'Applied Thermodynamics', 2, 0),
  ('DMENA', 4, 'MN4202', 'Maritime English II', 2, 1),
  ('DMENA', 4, 'MN4303', 'Marine Engineering Computer Aided Drawing', 3, 2),
  ('DMENA', 4, 'MN4304', 'Engineering Knowledge (General) II', 3, 3),
  ('DMENA', 4, 'MN4205', 'Mechanics of Machines', 2, 4),
  ('DMENA', 4, 'MN4206', 'Ship Design and Construction Technology I', 2, 5),
  ('DMENA', 4, 'MN4307', 'Engineering Knowledge (Motor) II', 3, 6),
  ('DMENA', 4, 'IS4305', 'Probability and Statistics', 3, 7),
  ('DMENA', 5, 'MN5301', 'Engineering Knowledge (General) III', 3, 0),
  ('DMENA', 5, 'MN5302', 'Engineering Knowledge (Motor) III', 3, 1),
  ('DMENA', 5, 'MN5303', 'Marine Engineering Instrumentation and Control Systems I', 3, 2),
  ('DMENA', 5, 'MN5204', 'Maritime Law and Safety I', 2, 3),
  ('DMENA', 5, 'MN5305', 'Marine Power and Shipboard Electrical Systems', 3, 4),
  ('DMENA', 5, 'MN5307', 'Ship Design and Construction Technology II', 3, 5),
  ('DMENA', 6, 'MN6201', 'Application of CFD for Marine Design', 2, 0),
  ('DMENA', 6, 'MN6302', 'Electro-Technology I', 3, 1),
  ('DMENA', 6, 'MN6303', 'Engineering Knowledge (General) IV', 3, 2),
  ('DMENA', 6, 'MN6204', 'Engineering Knowledge (Motor) IV', 2, 3),
  ('DMENA', 6, 'MN6205', 'Marine Engineering Instrumentation and Control Systems II', 2, 4),
  ('DMENA', 6, 'MN6206', 'Marine Engine Room Simulator Training I', 2, 5),
  ('DMENA', 7, 'MN7201', 'Automated Systems', 2, 0),
  ('DMENA', 7, 'MN7202', 'Electro-Technology II', 2, 1),
  ('DMENA', 7, 'MN7303', 'Engineering Knowledge (General) V', 3, 2),
  ('DMENA', 7, 'MN7304', 'Engineering Knowledge (Motor) V', 3, 3),
  ('DMENA', 7, 'MN7305', 'Marine Engineering Instrumentation and Control Systems III', 3, 4),
  ('DMENA', 7, 'MN7406', 'Marine Engineering and Naval Architecture (MENA) Design Project', 4, 5),
  ('DMENA', 7, 'MN7205', 'Maritime Law and Safety II', 2, 6),
  ('DMENA', 8, 'MN8201', 'Electro-Technology III', 2, 0),
  ('DMENA', 8, 'MN8202', 'Engineering Knowledge (Motor) VI', 2, 1),
  ('DMENA', 8, 'MN8203', 'Engineering Knowledge (General) VI', 2, 2),
  ('DMENA', 8, 'MN8304', 'Marine Engine Room Simulator Training II', 3, 3),
  ('DMENA', 8, 'MN8305', 'Shipboard Leadership and Management', 3, 4);

-- same subject, new code and/or semester (matched on the old name too, so a
-- re-run never moves the new module that now holds the old code)
create temp table moves (
  department text, old_semester integer, old_code text, old_name text,
  new_semester integer, new_code text
) on commit drop;

insert into moves values
  ('DEIE', 3, 'EE3204', 'Engineering Electromagnetism', 3, 'EE3304'),
  ('DEIE', 5, 'EE5102', 'Electronic Circuit Design', 5, 'EE5202'),
  ('DEIE', 6, 'IS6101', 'Engineering Ethics', 5, 'IS5101'),
  ('DEIE', 6, 'IS6302', 'Numerical Methods', 5, 'IS5302'),
  ('DEIE', 7, 'EE7202', 'Electrical Installations', 7, 'EE7302'),
  ('DEIE', 8, 'EE8202', 'Comprehensive Design Project', 8, 'EE8201'),
  ('DCE', 5, 'EC5405', 'Software Group Project', 5, 'EC5406'),
  ('DCE', 5, 'EC5311', 'Discrete Mathematics', 5, 'IS5311'),
  ('DCE', 5, 'IS5101', 'Engineering Ethics', 6, 'IS6102'),
  ('DCE', 5, 'IS5302', 'Numerical Methods', 6, 'IS6303'),
  ('DCE', 6, 'EC6204', 'Operating Systems and Network Programming', 5, 'EC5205'),
  ('DCE', 7, 'EC7201', 'Information Security', 6, 'EC6204'),
  ('DMENA', 6, 'MN6206', 'Marine Engineering Instrumentation and Control Systems II', 6, 'MN6205');

-- same code, but the handbook now uses it for a different subject
create temp table replaced (department text, semester_number integer, code text) on commit drop;

insert into replaced values
  ('DCE', 5, 'EC5202'),
  ('DMENA', 6, 'MN6205'),
  ('DMENA', 8, 'MN8304');

create temp table cur on commit drop as
select x.id as semester_id, x.semester_number, x.department
from public.semesters x
where x.curriculum_code = '2023' and x.semester_number between 3 and 8;

-- 1. old rows whose code the handbook gave to a different subject: tag them
--    so they're treated as dropped (only if the old name is still there)
update public.modules m
set code = m.code || '~old'
from cur c, replaced r
where m.semester_id = c.semester_id
  and c.department = r.department and c.semester_number = r.semester_number
  and m.code = r.code
  and not exists (
    select 1 from handbook h
    where h.department = c.department and h.code = m.code and h.name = m.name
  );

-- 2. renumber/move same-subject modules (tag first so swaps don't collide)
update public.modules m
set code = mv.new_code || '~mv'
from cur c, moves mv
where m.semester_id = c.semester_id
  and c.department = mv.department and c.semester_number = mv.old_semester
  and m.code = mv.old_code and m.name = mv.old_name;

update public.modules m
set code = mv.new_code,
    semester_id = nc.semester_id
from cur oc, moves mv, cur nc
where m.semester_id = oc.semester_id
  and oc.department = mv.department and oc.semester_number = mv.old_semester
  and m.code = mv.new_code || '~mv'
  and nc.department = mv.department and nc.semester_number = mv.new_semester;

-- 3. drop modules no longer in the handbook, unless someone has graded them
delete from public.modules m
using cur c
where m.semester_id = c.semester_id
  and c.department in (select distinct department from handbook)
  and not exists (
    select 1 from handbook h
    where h.department = c.department and h.semester_number = c.semester_number
      and h.code = m.code
  )
  and not exists (select 1 from public.grades g where g.module_id = m.id);

-- 4. names, credits and order straight from the handbook
update public.modules m
set name = h.name, credits = h.credits, sort_order = h.sort_order
from cur c, handbook h
where m.semester_id = c.semester_id
  and h.department = c.department and h.semester_number = c.semester_number
  and h.code = m.code
  and (m.name, m.credits, m.sort_order) is distinct from (h.name, h.credits, h.sort_order);

-- 5. add modules that are new in the handbook
insert into public.modules (semester_id, code, name, credits, sort_order)
select c.semester_id, h.code, h.name, h.credits, h.sort_order
from handbook h
join cur c on c.department = h.department and c.semester_number = h.semester_number
where not exists (
  select 1 from public.modules m where m.semester_id = c.semester_id and m.code = h.code
);

commit;

-- CHECK 1: modules and credits per Curriculum 2023 semester (3–8)
select coalesce(x.department, 'COMMON') as department, x.semester_number,
       count(m.id) as modules, sum(m.credits) as credits
from public.semesters x
left join public.modules m on m.semester_id = x.id
where x.curriculum_code = '2023' and x.semester_number between 3 and 8
group by x.semester_number, x.department
order by x.department, x.semester_number;

-- CHECK 2: dropped modules kept because students have grades on them
-- (empty = nothing left over)
select x.department, x.semester_number, m.code, m.name,
       (select count(*) from public.grades g where g.module_id = m.id) as grades
from public.modules m
join public.semesters x on x.id = m.semester_id
where x.curriculum_code = '2023' and x.semester_number between 3 and 8
  and not exists (
    select 1 from handbook h
    where h.department = x.department and h.semester_number = x.semester_number
      and h.code = m.code
  )
order by x.department, x.semester_number, m.code;
