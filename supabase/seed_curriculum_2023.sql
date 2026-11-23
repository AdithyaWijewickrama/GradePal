-- ============================================================================
-- GRADE PAL — SEED: CURRICULUM 2023 CORE MODULES
-- Run after supabase/curricula.sql: SQL Editor → New query → paste → Run.
-- Safe to re-run: semesters and modules that already exist are left alone.
--
-- Source: FoE UoR Student Handbook 2024/2025 (26th batch) — common core
-- (3.5.1) and each department's compulsory core modules (5.3.2 DCEE,
-- 6.4.2 DEIE, 6.5.2 DCE, 7.3.2 DMME, 8.3.2 DMENA).
-- Credits and semester come from the module code: 2 letters, semester digit,
-- credit digit, then a 2-digit number (handbook 3.5.1).
--
-- Not included: Technical / General Electives (each student picks their own),
-- Industrial Training, and repeated "(Continued)" rows for multi-semester
-- projects, which are listed once in the semester their code gives.
-- ============================================================================

begin;

create temp table seed_modules (
  department text,
  semester_number integer,
  code text,
  name text,
  credits numeric,
  sort_order integer
) on commit drop;

insert into seed_modules (department, semester_number, code, name, credits, sort_order) values
  (null, 1, 'CE1101', 'Basic Concepts in Environmental Engineering', 1, 0),
  (null, 1, 'CE1202', 'Introduction to Infrastructure Planning', 2, 1),
  (null, 1, 'EE1102', 'Programming Fundamentals', 1, 2),
  (null, 1, 'EE1301', 'Fundamentals of Electricity', 3, 3),
  (null, 1, 'ME1201', 'Engineering Drawing', 2, 4),
  (null, 1, 'ME1202', 'Fundamentals of Thermodynamics', 2, 5),
  (null, 1, 'IS1301', 'Communication for Engineers', 3, 6),
  (null, 1, 'IS1402', 'Mathematical Fundamentals for Engineers', 4, 7),
  (null, 2, 'CE2201', 'Fundamentals of Fluid Mechanics', 2, 0),
  (null, 2, 'CE2302', 'Mechanics of Materials', 3, 1),
  (null, 2, 'EE2201', 'Fundamentals of Electronics', 2, 2),
  (null, 2, 'EE2202', 'Object-Oriented Programming', 2, 3),
  (null, 2, 'ME2201', 'Engineering Mechanics', 2, 4),
  (null, 2, 'ME2302', 'Fundamentals of Materials and Manufacturing Engineering', 3, 5),
  (null, 2, 'IS2401', 'Linear Algebra and Differential Equations', 4, 6),
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
  ('DEIE', 3, 'EE3204', 'Engineering Electromagnetism', 2, 3),
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
  ('DEIE', 5, 'EE5102', 'Electronic Circuit Design', 1, 1),
  ('DEIE', 5, 'EE5203', 'Machine Learning', 2, 2),
  ('DEIE', 5, 'EE5304', 'Power Electronics', 3, 3),
  ('DEIE', 5, 'EE5305', 'Power Systems', 3, 4),
  ('DEIE', 5, 'EE5206', 'Software Project', 2, 5),
  ('DEIE', 5, 'IS5311', 'Discrete Mathematics', 3, 6),
  ('DEIE', 6, 'EE6301', 'Computer Networks', 3, 0),
  ('DEIE', 6, 'EE6302', 'Control Systems Design', 3, 1),
  ('DEIE', 6, 'EE6203', 'Digital Signal Processing', 2, 2),
  ('DEIE', 6, 'EE6304', 'Embedded Systems Design', 3, 3),
  ('DEIE', 6, 'EE6105', 'Research Methodologies', 1, 4),
  ('DEIE', 6, 'IS6101', 'Engineering Ethics', 1, 5),
  ('DEIE', 6, 'IS6302', 'Numerical Methods', 3, 6),
  ('DEIE', 7, 'EE7201', 'Design and Management of Networks', 2, 0),
  ('DEIE', 7, 'EE7202', 'Electrical Installations', 2, 1),
  ('DEIE', 7, 'EE7803', 'Undergraduate Project', 8, 2),
  ('DEIE', 8, 'EE8202', 'Comprehensive Design Project', 2, 0),
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
  ('DCE', 5, 'EC5202', 'Electronic Circuit Design', 2, 1),
  ('DCE', 5, 'EC5203', 'Machine Learning', 2, 2),
  ('DCE', 5, 'EC5204', 'Object Oriented Design Patterns and Principles', 2, 3),
  ('DCE', 5, 'EC5405', 'Software Group Project', 4, 4),
  ('DCE', 5, 'EC5311', 'Discrete Mathematics', 3, 5),
  ('DCE', 6, 'EC6301', 'Artificial Intelligence', 3, 0),
  ('DCE', 6, 'EC6302', 'Computer Networks', 3, 1),
  ('DCE', 6, 'EC6303', 'Embedded Systems Design', 3, 2),
  ('DCE', 6, 'EC6204', 'Operating Systems and Network Programming', 2, 3),
  ('DCE', 6, 'EC6105', 'Research Methodologies', 1, 4),
  ('DCE', 5, 'IS5101', 'Engineering Ethics', 1, 6),
  ('DCE', 5, 'IS5302', 'Numerical Methods', 3, 7),
  ('DCE', 7, 'EC7201', 'Information Security', 2, 0),
  ('DCE', 7, 'EC7802', 'Undergraduate Project', 8, 1),
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
  ('DMENA', 5, 'MN5306', 'Marine Refrigeration and Air Conditioning', 3, 5),
  ('DMENA', 5, 'MN5307', 'Ship Design and Construction Technology II', 3, 6),
  ('DMENA', 6, 'MN6201', 'Application of CFD for Marine Design', 2, 0),
  ('DMENA', 6, 'MN6302', 'Electro-Technology I', 3, 1),
  ('DMENA', 6, 'MN6303', 'Engineering Knowledge (General) IV', 3, 2),
  ('DMENA', 6, 'MN6204', 'Engineering Knowledge (Motor) IV', 2, 3),
  ('DMENA', 6, 'MN6205', 'Maritime English III', 2, 4),
  ('DMENA', 6, 'MN6206', 'Marine Engineering Instrumentation and Control Systems II', 2, 5),
  ('DMENA', 6, 'MN6307', 'Ship Structural Analysis and Design', 3, 6),
  ('DMENA', 6, 'MN6308', 'Shipboard Power and High Voltage Applications', 3, 7),
  ('DMENA', 7, 'MN7201', 'Automated Systems I', 2, 0),
  ('DMENA', 7, 'MN7202', 'Electro-Technology II', 2, 1),
  ('DMENA', 7, 'MN7303', 'Engineering Knowledge (General) V', 3, 2),
  ('DMENA', 7, 'MN7304', 'Engineering Knowledge (Motor) V', 3, 3),
  ('DMENA', 7, 'MN7305', 'Marine Engineering Instrumentation and Control Systems III', 3, 4),
  ('DMENA', 7, 'MN7406', 'Marine Engineering and Naval Architecture (MENA) Design Project', 4, 5),
  ('DMENA', 7, 'MN7205', 'Maritime Law and Safety II', 2, 6),
  ('DMENA', 8, 'MN8201', 'Electro-Technology III', 2, 0),
  ('DMENA', 8, 'MN8202', 'Engineering Knowledge (Motor) VI', 2, 1),
  ('DMENA', 8, 'MN8203', 'Engineering Knowledge (General) VI', 2, 2),
  ('DMENA', 8, 'MN8304', 'Marine Operations and Watch Keeping (Simulator)', 3, 3),
  ('DMENA', 8, 'MN8305', 'Shipboard Leadership and Management', 3, 4);

-- one semester per (number, department) for Curriculum 2023 — all of 3–8 for
-- every department, even those with no core modules listed (e.g. DCE sem 8),
-- so students see an empty semester rather than a blank tab
insert into public.semesters (semester_number, department, batch_label, curriculum_code)
select s.semester_number, s.department, '2025/2026', '2023'
from (
  select n as semester_number, null::text as department from generate_series(1, 2) n
  union all
  select n, d from generate_series(3, 8) n
  cross join unnest(array['DEIE', 'DMME', 'DMENA', 'DCEE', 'DCE']) d
) s
where not exists (
  select 1 from public.semesters x
  where x.semester_number = s.semester_number
    and x.department is not distinct from s.department
    and x.curriculum_code = '2023'
);

insert into public.modules (semester_id, code, name, credits, sort_order)
select x.id, s.code, s.name, s.credits, s.sort_order
from seed_modules s
join public.semesters x
  on x.semester_number = s.semester_number
 and x.department is not distinct from s.department
 and x.curriculum_code = '2023'
where not exists (
  select 1 from public.modules m where m.semester_id = x.id and m.code = s.code
);

-- Students on Curriculum 2023 now see these semesters instead of the shared
-- ones, so carry over any grades they already saved on a shared module with
-- the same code in the same semester. Their old rows are left untouched.
insert into public.grades (user_id, module_id, grade)
select g.user_id, new_m.id, g.grade
from public.grades g
join public.profiles p on p.id = g.user_id
join public.batch_curricula bc on bc.batch = p.batch and bc.curriculum_code = '2023'
join public.modules old_m on old_m.id = g.module_id
join public.semesters old_s on old_s.id = old_m.semester_id and old_s.curriculum_code is null
join public.semesters new_s
  on new_s.curriculum_code = '2023'
 and new_s.semester_number = old_s.semester_number
 and new_s.department is not distinct from old_s.department
-- codes compared ignoring case and spaces ("EE 1102" = "EE1102")
join public.modules new_m on new_m.semester_id = new_s.id
 and new_m.code = upper(replace(old_m.code, ' ', ''))
where not exists (
  select 1 from public.grades x where x.user_id = g.user_id and x.module_id = new_m.id
);

commit;

-- CHECK: modules and credits per Curriculum 2023 semester
select x.semester_number, coalesce(x.department, 'COMMON') as department,
       count(m.id) as modules, sum(m.credits) as credits
from public.semesters x
left join public.modules m on m.semester_id = x.id
where x.curriculum_code = '2023'
group by x.semester_number, x.department
order by x.department nulls first, x.semester_number;
