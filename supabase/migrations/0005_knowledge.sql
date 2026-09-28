-- ============================================================================
-- LUIS OS — IDIOMAS + MECHATRONICS ACADEMY · Fase 1
-- Focus Seasons, perfil de idiomas (con alemán), Knowledge Map de Mecatrónica
-- integrado a Skills, evidencia de competencia, Lab, knowledge graph.
--
-- Reutiliza Skills (categorías, skills, evidencia, proyectos, rutas, skill of the week).
-- Las 14 skills de Mecatrónica existentes se MUEVEN a su área (conservan id y evidencia).
-- Ejecutar después de 0001–0004.
-- ============================================================================

begin;

-- Dominios para agrupar el Knowledge Profile
alter table public.skill_categories
  add column domain text not null default 'creative'
    check (domain in ('creative','engineering','languages','business','spiritual','general'));
update public.skill_categories set domain = 'languages' where key = 'english';
update public.skill_categories set domain = 'business' where key in ('business','leadership');
update public.skill_categories set domain = 'engineering' where key = 'mechatronics';

-- Evidencia de competencia: tipo específico (el nivel sigue dependiendo de kind)
alter table public.skill_evidence
  add column subtype text check (subtype in
    ('theory','exercise','session','project','troubleshooting','photo','video','document','code','schematic','note','reading','simulation'));

-- Knowledge graph: relaciones entre skills
create table public.skill_links (
  user_id        uuid not null references auth.users (id) on delete cascade,
  from_skill_id  uuid not null references public.skills (id) on delete cascade,
  to_skill_id    uuid not null references public.skills (id) on delete cascade,
  relation       text not null check (relation in ('prerequisite','related','applies_to')),
  primary key (from_skill_id, to_skill_id, relation),
  check (from_skill_id <> to_skill_id)
);

-- Skill of the Week por "pista": general (creativa) y engineering
alter table public.skill_weeks drop constraint skill_weeks_user_id_week_start_key;
alter table public.skill_weeks
  add column track text not null default 'general' check (track in ('general','engineering')),
  add constraint skill_weeks_user_week_track_key unique (user_id, week_start, track);

-- Proyectos: Lab de Mecatrónica (y portafolio de ingeniería)
alter table public.skill_projects
  add column domain      text not null default 'creative' check (domain in ('creative','engineering','languages','business','spiritual','general')),
  add column difficulty  smallint check (difficulty between 1 and 4),
  add column problem     text,
  add column components  text,
  add column theory      text,
  add column diagram     text,
  add column steps       text,
  add column safety      text,
  add column code        text,
  add column results     text,
  add column lessons     text,
  add column tools       text,
  add column visibility  text not null default 'private' check (visibility in ('private','public'));

-- Idiomas
create table public.languages (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users (id) on delete cascade,
  code           text not null,
  name           text not null,
  flag           text,
  status         text not null check (status in ('native','primary','secondary','maintenance','paused','future')),
  cefr           text check (cefr in ('A1','A2','B1','B2','C1','C2')),
  cefr_evidence  text,          -- el nivel solo se registra con evidencia (examen, evaluación…)
  category_id    uuid references public.skill_categories (id) on delete set null,
  sort_order     smallint not null default 0,
  updated_at     timestamptz not null default now(),
  unique (user_id, code),
  check (cefr is null or length(trim(coalesce(cefr_evidence, ''))) > 0)
);
create trigger languages_touch before update on public.languages
  for each row execute function public.touch_updated_at();

-- Focus Seasons
create table public.focus_seasons (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  name       text not null check (length(trim(name)) between 1 and 60),
  starts_on  date not null,
  ends_on    date not null,
  notes      text,
  created_at timestamptz not null default now(),
  check (ends_on >= starts_on)
);

create table public.focus_items (
  id         uuid primary key default gen_random_uuid(),
  season_id  uuid not null references public.focus_seasons (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  label      text not null check (length(trim(label)) between 1 and 60),
  level      text not null check (level in ('primary','secondary','maintenance','future')),
  sort_order smallint not null default 0
);

-- Weekly Reset
alter table public.weekly_reviews add column can_do_now text;

-- Integridad
create or replace function public.check_knowledge_owner()
returns trigger language plpgsql security definer set search_path = public as $$
declare j jsonb := to_jsonb(new); ok boolean := true; uid uuid := new.user_id;
begin
  if j->>'from_skill_id' is not null then
    ok := ok and (select user_id from public.skills where id = (j->>'from_skill_id')::uuid) is not distinct from uid; end if;
  if j->>'to_skill_id' is not null then
    ok := ok and (select user_id from public.skills where id = (j->>'to_skill_id')::uuid) is not distinct from uid; end if;
  if j->>'category_id' is not null then
    ok := ok and (select user_id from public.skill_categories where id = (j->>'category_id')::uuid) is not distinct from uid; end if;
  if j->>'season_id' is not null then
    ok := ok and (select user_id from public.focus_seasons where id = (j->>'season_id')::uuid) is not distinct from uid; end if;
  if not ok then raise exception 'El registro relacionado no pertenece a este usuario'; end if;
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['skill_links','languages','focus_seasons','focus_items'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "own rows" on public.%I for all to authenticated
                    using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t);
    execute format('create trigger %I before insert or update on public.%I for each row execute function public.check_knowledge_owner()', t || '_owner', t);
  end loop;
end $$;

-- ============================================================================
-- SEEDS
-- ============================================================================
create or replace function public.seed_knowledge(uid uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  -- Áreas del Knowledge Map + categorías de idiomas

  insert into public.skill_categories (user_id, key, name, domain, sort_order) values
    (uid, 'mx-fundamentals', 'Fundamentals', 'engineering', 20),
    (uid, 'mx-electricity', 'Electricity', 'engineering', 21),
    (uid, 'mx-electronics', 'Electronics', 'engineering', 22),
    (uid, 'mx-instrumentation', 'Instrumentation', 'engineering', 23),
    (uid, 'mx-sensors', 'Sensors', 'engineering', 24),
    (uid, 'mx-actuators', 'Actuators', 'engineering', 25),
    (uid, 'mx-motors', 'Motors', 'engineering', 26),
    (uid, 'mx-plc', 'PLC', 'engineering', 27),
    (uid, 'mx-automation', 'Industrial Automation', 'engineering', 28),
    (uid, 'mx-control', 'Control Systems', 'engineering', 29),
    (uid, 'mx-pneumatics', 'Pneumatics', 'engineering', 30),
    (uid, 'mx-hydraulics', 'Hydraulics', 'engineering', 31),
    (uid, 'mx-mechanics', 'Mechanics', 'engineering', 32),
    (uid, 'mx-cad', 'CAD', 'engineering', 33),
    (uid, 'mx-programming', 'Programming', 'engineering', 34),
    (uid, 'mx-embedded', 'Embedded Systems', 'engineering', 35),
    (uid, 'mx-robotics', 'Robotics', 'engineering', 36),
    (uid, 'mx-comm', 'Industrial Communication', 'engineering', 37),
    (uid, 'mx-maintenance', 'Maintenance', 'engineering', 38),
    (uid, 'mx-hvac', 'HVAC / Refrigeration', 'engineering', 39),
    (uid, 'mx-troubleshooting', 'Troubleshooting', 'engineering', 40),
    (uid, 'mx-safety', 'Safety', 'engineering', 41),
    (uid, 'mx-software', 'Software', 'engineering', 42),
    (uid, 'german', 'German · Deutsch', 'languages', 50),
    (uid, 'french', 'French · Français', 'languages', 51),
    (uid, 'japanese', 'Japanese · 日本語', 'languages', 52),
    (uid, 'mandarin', 'Mandarin · 中文', 'languages', 53)
  on conflict (user_id, key) do nothing;

  -- Mover las skills de Mecatrónica existentes a su área (conservan evidencia e id)

  update public.skills s set category_id = a.id, key = v.newkey, name = v.newname, sort_order = 0
  from (values
    ('electricity', 'mx-electricity', 'electrical-fundamentals', 'Electrical Fundamentals'),
    ('electronics', 'mx-electronics', 'electronics-fundamentals', 'Electronics Fundamentals'),
    ('plc', 'mx-plc', 'plc-fundamentals', 'PLC Fundamentals'),
    ('automation', 'mx-automation', 'automation-fundamentals', 'Automation Fundamentals'),
    ('control', 'mx-control', 'control-fundamentals', 'Control Fundamentals'),
    ('sensors', 'mx-sensors', 'sensor-fundamentals', 'Sensor Fundamentals'),
    ('motors', 'mx-motors', 'motor-fundamentals', 'Motor Fundamentals'),
    ('pneumatics', 'mx-pneumatics', 'pneumatic-fundamentals', 'Pneumatic Fundamentals'),
    ('hydraulics', 'mx-hydraulics', 'hydraulic-fundamentals', 'Hydraulic Fundamentals'),
    ('programming', 'mx-programming', 'programming-fundamentals', 'Programming Fundamentals'),
    ('cad', 'mx-cad', 'cad-fundamentals', 'CAD Fundamentals'),
    ('robotics', 'mx-robotics', 'robotics-fundamentals', 'Robotics Fundamentals'),
    ('industrial-maintenance', 'mx-maintenance', 'maintenance-fundamentals', 'Maintenance Fundamentals'),
    ('troubleshooting', 'mx-troubleshooting', 'troubleshooting-method', 'Troubleshooting Method')
  ) as v(oldkey, area, newkey, newname)
  join public.skill_categories a on a.user_id = uid and a.key = v.area
  where s.user_id = uid and s.key = v.oldkey
    and s.category_id = (select id from public.skill_categories where user_id = uid and key = 'mechatronics');
  delete from public.skill_categories c where c.user_id = uid and c.key = 'mechatronics'
    and not exists (select 1 from public.skills s where s.category_id = c.id);

  insert into public.skills (user_id, category_id, key, name, sort_order, archived)
  select uid, c.id, v.skey, v.sname, v.sort, v.arch
  from (values
    ('mx-fundamentals', 'mathematics', 'Mathematics', 0, false),
    ('mx-fundamentals', 'physics', 'Physics', 1, false),
    ('mx-fundamentals', 'technical-drawing', 'Technical Drawing', 2, false),
    ('mx-fundamentals', 'measurement', 'Measurement', 3, false),
    ('mx-fundamentals', 'engineering-fundamentals', 'Engineering Fundamentals', 4, false),
    ('mx-electricity', 'electrical-fundamentals', 'Electrical Fundamentals', 0, false),
    ('mx-electricity', 'voltage', 'Voltage', 1, false),
    ('mx-electricity', 'current', 'Current', 2, false),
    ('mx-electricity', 'resistance', 'Resistance', 3, false),
    ('mx-electricity', 'power', 'Power', 4, false),
    ('mx-electricity', 'ohms-law', 'Ohm''s Law', 5, false),
    ('mx-electricity', 'kirchhoffs-laws', 'Kirchhoff''s Laws', 6, false),
    ('mx-electricity', 'ac', 'AC', 7, false),
    ('mx-electricity', 'dc', 'DC', 8, false),
    ('mx-electricity', 'single-phase-systems', 'Single-Phase Systems', 9, false),
    ('mx-electricity', 'three-phase-systems', 'Three-Phase Systems', 10, false),
    ('mx-electricity', 'transformers', 'Transformers', 11, false),
    ('mx-electricity', 'electrical-protection', 'Electrical Protection', 12, false),
    ('mx-electricity', 'electrical-panels', 'Electrical Panels', 13, false),
    ('mx-electricity', 'wiring', 'Wiring', 14, false),
    ('mx-electricity', 'grounding', 'Grounding', 15, false),
    ('mx-electronics', 'electronics-fundamentals', 'Electronics Fundamentals', 0, false),
    ('mx-electronics', 'analog-electronics', 'Analog Electronics', 1, false),
    ('mx-electronics', 'digital-electronics', 'Digital Electronics', 2, false),
    ('mx-electronics', 'diodes', 'Diodes', 3, false),
    ('mx-electronics', 'transistors', 'Transistors', 4, false),
    ('mx-electronics', 'mosfet', 'MOSFET', 5, false),
    ('mx-electronics', 'op-amps', 'Op-Amps', 6, false),
    ('mx-electronics', 'power-electronics', 'Power Electronics', 7, false),
    ('mx-electronics', 'logic-gates', 'Logic Gates', 8, false),
    ('mx-electronics', 'digital-systems', 'Digital Systems', 9, false),
    ('mx-instrumentation', 'multimeter', 'Multimeter', 0, false),
    ('mx-instrumentation', 'oscilloscope', 'Oscilloscope', 1, false),
    ('mx-instrumentation', 'clamp-meter', 'Clamp Meter', 2, false),
    ('mx-instrumentation', 'measurement-techniques', 'Measurement Techniques', 3, false),
    ('mx-instrumentation', 'calibration', 'Calibration', 4, false),
    ('mx-instrumentation', 'electrical-diagnostics', 'Electrical Diagnostics', 5, false),
    ('mx-sensors', 'sensor-fundamentals', 'Sensor Fundamentals', 0, false),
    ('mx-sensors', 'temperature-sensors', 'Temperature Sensors', 1, false),
    ('mx-sensors', 'pressure-sensors', 'Pressure Sensors', 2, false),
    ('mx-sensors', 'proximity-sensors', 'Proximity Sensors', 3, false),
    ('mx-sensors', 'photoelectric-sensors', 'Photoelectric Sensors', 4, false),
    ('mx-sensors', 'inductive-sensors', 'Inductive Sensors', 5, false),
    ('mx-sensors', 'capacitive-sensors', 'Capacitive Sensors', 6, false),
    ('mx-sensors', 'encoders', 'Encoders', 7, false),
    ('mx-sensors', 'flow-sensors', 'Flow Sensors', 8, false),
    ('mx-sensors', 'level-sensors', 'Level Sensors', 9, false),
    ('mx-sensors', 'position-sensors', 'Position Sensors', 10, false),
    ('mx-actuators', 'relays', 'Relays', 0, false),
    ('mx-actuators', 'contactors', 'Contactors', 1, false),
    ('mx-actuators', 'solenoids', 'Solenoids', 2, false),
    ('mx-actuators', 'servomotors', 'Servomotors', 3, false),
    ('mx-actuators', 'stepper-motors', 'Stepper Motors', 4, false),
    ('mx-actuators', 'control-valves', 'Control Valves', 5, false),
    ('mx-motors', 'motor-fundamentals', 'Motor Fundamentals', 0, false),
    ('mx-motors', 'dc-motors', 'DC Motors', 1, false),
    ('mx-motors', 'ac-motors', 'AC Motors', 2, false),
    ('mx-motors', 'single-phase-motors', 'Single-Phase Motors', 3, false),
    ('mx-motors', 'three-phase-motors', 'Three-Phase Motors', 4, false),
    ('mx-motors', 'induction-motors', 'Induction Motors', 5, false),
    ('mx-motors', 'motor-starters', 'Motor Starters', 6, false),
    ('mx-motors', 'motor-protection', 'Motor Protection', 7, false),
    ('mx-motors', 'vfd', 'VFD', 8, false),
    ('mx-plc', 'plc-fundamentals', 'PLC Fundamentals', 0, false),
    ('mx-plc', 'plc-inputs', 'PLC Inputs', 1, false),
    ('mx-plc', 'plc-outputs', 'PLC Outputs', 2, false),
    ('mx-plc', 'digital-i-o', 'Digital I/O', 3, false),
    ('mx-plc', 'analog-i-o', 'Analog I/O', 4, false),
    ('mx-plc', 'ladder-logic', 'Ladder Logic', 5, false),
    ('mx-plc', 'timers', 'Timers', 6, false),
    ('mx-plc', 'counters', 'Counters', 7, false),
    ('mx-plc', 'sequences', 'Sequences', 8, false),
    ('mx-plc', 'interlocks', 'Interlocks', 9, false),
    ('mx-plc', 'alarms', 'Alarms', 10, false),
    ('mx-plc', 'hmi-integration', 'HMI Integration', 11, false),
    ('mx-plc', 'plc-diagnostics', 'PLC Diagnostics', 12, false),
    ('mx-automation', 'automation-fundamentals', 'Automation Fundamentals', 0, false),
    ('mx-automation', 'control-panels', 'Control Panels', 1, false),
    ('mx-automation', 'hmi', 'HMI', 2, false),
    ('mx-automation', 'scada', 'SCADA', 3, false),
    ('mx-automation', 'safety-systems', 'Safety Systems', 4, false),
    ('mx-control', 'control-fundamentals', 'Control Fundamentals', 0, false),
    ('mx-control', 'open-loop', 'Open Loop', 1, false),
    ('mx-control', 'closed-loop', 'Closed Loop', 2, false),
    ('mx-control', 'feedback', 'Feedback', 3, false),
    ('mx-control', 'transfer-functions', 'Transfer Functions', 4, false),
    ('mx-control', 'pid', 'PID', 5, false),
    ('mx-control', 'system-response', 'System Response', 6, false),
    ('mx-control', 'control-design', 'Control Design', 7, false),
    ('mx-pneumatics', 'pneumatic-fundamentals', 'Pneumatic Fundamentals', 0, false),
    ('mx-pneumatics', 'pneumatic-pressure', 'Pneumatic Pressure', 1, false),
    ('mx-pneumatics', 'pneumatic-flow', 'Pneumatic Flow', 2, false),
    ('mx-pneumatics', 'pneumatic-cylinders', 'Pneumatic Cylinders', 3, false),
    ('mx-pneumatics', 'pneumatic-valves', 'Pneumatic Valves', 4, false),
    ('mx-pneumatics', 'solenoid-valves', 'Solenoid Valves', 5, false),
    ('mx-pneumatics', 'frl-units', 'FRL Units', 6, false),
    ('mx-pneumatics', 'pneumatic-diagrams', 'Pneumatic Diagrams', 7, false),
    ('mx-pneumatics', 'pneumatic-troubleshooting', 'Pneumatic Troubleshooting', 8, false),
    ('mx-hydraulics', 'hydraulic-fundamentals', 'Hydraulic Fundamentals', 0, false),
    ('mx-hydraulics', 'hydraulic-pumps', 'Hydraulic Pumps', 1, false),
    ('mx-hydraulics', 'hydraulic-valves', 'Hydraulic Valves', 2, false),
    ('mx-hydraulics', 'hydraulic-cylinders', 'Hydraulic Cylinders', 3, false),
    ('mx-hydraulics', 'hydraulic-pressure', 'Hydraulic Pressure', 4, false),
    ('mx-hydraulics', 'hydraulic-flow', 'Hydraulic Flow', 5, false),
    ('mx-hydraulics', 'hydraulic-diagrams', 'Hydraulic Diagrams', 6, false),
    ('mx-hydraulics', 'hydraulic-troubleshooting', 'Hydraulic Troubleshooting', 7, false),
    ('mx-mechanics', 'mechanisms', 'Mechanisms', 0, false),
    ('mx-mechanics', 'gears', 'Gears', 1, false),
    ('mx-mechanics', 'bearings', 'Bearings', 2, false),
    ('mx-mechanics', 'belts', 'Belts', 3, false),
    ('mx-mechanics', 'chains', 'Chains', 4, false),
    ('mx-mechanics', 'shafts', 'Shafts', 5, false),
    ('mx-mechanics', 'fasteners', 'Fasteners', 6, false),
    ('mx-mechanics', 'mechanical-transmission', 'Mechanical Transmission', 7, false),
    ('mx-mechanics', 'lubrication', 'Lubrication', 8, false),
    ('mx-cad', 'cad-fundamentals', 'CAD Fundamentals', 0, false),
    ('mx-cad', '2d-cad', '2D CAD', 1, false),
    ('mx-cad', '3d-cad', '3D CAD', 2, false),
    ('mx-cad', 'assemblies', 'Assemblies', 3, false),
    ('mx-cad', 'mechanical-design', 'Mechanical Design', 4, false),
    ('mx-programming', 'programming-fundamentals', 'Programming Fundamentals', 0, false),
    ('mx-programming', 'logic', 'Logic', 1, false),
    ('mx-programming', 'algorithms', 'Algorithms', 2, false),
    ('mx-programming', 'python', 'Python', 3, false),
    ('mx-programming', 'c-cpp', 'C/C++', 4, false),
    ('mx-programming', 'data', 'Data', 5, false),
    ('mx-programming', 'apis', 'APIs', 6, false),
    ('mx-embedded', 'arduino', 'Arduino', 0, false),
    ('mx-embedded', 'esp32', 'ESP32', 1, false),
    ('mx-embedded', 'microcontrollers', 'Microcontrollers', 2, false),
    ('mx-embedded', 'mcu-digital-i-o', 'MCU Digital I/O', 3, false),
    ('mx-embedded', 'mcu-analog-i-o', 'MCU Analog I/O', 4, false),
    ('mx-embedded', 'pwm', 'PWM', 5, false),
    ('mx-embedded', 'embedded-communication', 'Embedded Communication', 6, false),
    ('mx-embedded', 'sensor-interfacing', 'Sensor Interfacing', 7, false),
    ('mx-embedded', 'actuator-control', 'Actuator Control', 8, false),
    ('mx-robotics', 'robotics-fundamentals', 'Robotics Fundamentals', 0, false),
    ('mx-robotics', 'coordinate-systems', 'Coordinate Systems', 1, false),
    ('mx-robotics', 'kinematics', 'Kinematics', 2, false),
    ('mx-robotics', 'industrial-robots', 'Industrial Robots', 3, false),
    ('mx-robotics', 'robot-programming', 'Robot Programming', 4, false),
    ('mx-robotics', 'robot-safety', 'Robot Safety', 5, false),
    ('mx-robotics', 'vision-systems', 'Vision Systems', 6, false),
    ('mx-comm', 'serial-communication', 'Serial Communication', 0, false),
    ('mx-comm', 'modbus', 'Modbus', 1, false),
    ('mx-comm', 'ethernet', 'Ethernet', 2, false),
    ('mx-comm', 'ethernet-ip', 'EtherNet/IP', 3, false),
    ('mx-comm', 'profinet', 'PROFINET', 4, false),
    ('mx-comm', 'can', 'CAN', 5, false),
    ('mx-comm', 'industrial-networks', 'Industrial Networks', 6, false),
    ('mx-maintenance', 'maintenance-fundamentals', 'Maintenance Fundamentals', 0, false),
    ('mx-maintenance', 'preventive-maintenance', 'Preventive Maintenance', 1, false),
    ('mx-maintenance', 'corrective-maintenance', 'Corrective Maintenance', 2, false),
    ('mx-maintenance', 'predictive-maintenance', 'Predictive Maintenance', 3, false),
    ('mx-maintenance', 'inspection', 'Inspection', 4, false),
    ('mx-maintenance', 'failure-analysis', 'Failure Analysis', 5, false),
    ('mx-maintenance', 'maintenance-planning', 'Maintenance Planning', 6, false),
    ('mx-hvac', 'hvac-fundamentals', 'HVAC Fundamentals', 0, false),
    ('mx-hvac', 'hvac-electrical-diagnostics', 'HVAC Electrical Diagnostics', 1, false),
    ('mx-hvac', 'compressors', 'Compressors', 2, false),
    ('mx-hvac', 'hvac-motors', 'HVAC Motors', 3, false),
    ('mx-hvac', 'hvac-sensors', 'HVAC Sensors', 4, false),
    ('mx-hvac', 'hvac-temperature', 'HVAC Temperature', 5, false),
    ('mx-hvac', 'hvac-pressure', 'HVAC Pressure', 6, false),
    ('mx-hvac', 'hvac-controls', 'HVAC Controls', 7, false),
    ('mx-hvac', 'hvac-troubleshooting', 'HVAC Troubleshooting', 8, false),
    ('mx-troubleshooting', 'troubleshooting-method', 'Troubleshooting Method', 0, false),
    ('mx-troubleshooting', 'electrical-faults', 'Electrical Faults', 1, false),
    ('mx-troubleshooting', 'mechanical-faults', 'Mechanical Faults', 2, false),
    ('mx-troubleshooting', 'sensor-faults', 'Sensor Faults', 3, false),
    ('mx-troubleshooting', 'plc-faults', 'PLC Faults', 4, false),
    ('mx-troubleshooting', 'communication-faults', 'Communication Faults', 5, false),
    ('mx-troubleshooting', 'motor-faults', 'Motor Faults', 6, false),
    ('mx-troubleshooting', 'process-faults', 'Process Faults', 7, false),
    ('mx-safety', 'electrical-safety', 'Electrical Safety', 0, false),
    ('mx-safety', 'lockout-tagout', 'Lockout / Tagout', 1, false),
    ('mx-safety', 'ppe', 'PPE', 2, false),
    ('mx-safety', 'industrial-safety', 'Industrial Safety', 3, false),
    ('mx-safety', 'risk-identification', 'Risk Identification', 4, false),
    ('mx-software', 'tia-portal', 'TIA Portal', 0, true),
    ('mx-software', 'factory-i-o', 'Factory I/O', 1, true),
    ('mx-software', 'autocad', 'AutoCAD', 2, true),
    ('mx-software', 'solidworks', 'SolidWorks', 3, true),
    ('mx-software', 'matlab', 'MATLAB', 4, true),
    ('mx-software', 'simulink', 'Simulink', 5, true),
    ('mx-software', 'labview', 'LabVIEW', 6, true),
    ('mx-software', 'arduino-ide', 'Arduino IDE', 7, true),
    ('mx-software', 'vs-code', 'VS Code', 8, true),
    ('german', 'pronunciation', 'Pronunciation', 0, false),
    ('german', 'alphabet-sounds', 'Alphabet / Sounds', 1, false),
    ('german', 'greetings', 'Greetings', 2, false),
    ('german', 'numbers', 'Numbers', 3, false),
    ('german', 'dates', 'Dates', 4, false),
    ('german', 'time', 'Time', 5, false),
    ('german', 'basic-vocabulary', 'Basic Vocabulary', 6, false),
    ('german', 'articles', 'Articles', 7, false),
    ('german', 'gender', 'Gender', 8, false),
    ('german', 'cases', 'Cases', 9, false),
    ('german', 'nominative', 'Nominative', 10, false),
    ('german', 'accusative', 'Accusative', 11, false),
    ('german', 'dative', 'Dative', 12, false),
    ('german', 'genitive', 'Genitive', 13, false),
    ('german', 'verb-conjugation', 'Verb Conjugation', 14, false),
    ('german', 'word-order', 'Word Order', 15, false),
    ('german', 'modal-verbs', 'Modal Verbs', 16, false),
    ('german', 'separable-verbs', 'Separable Verbs', 17, false),
    ('german', 'past-tenses', 'Past Tenses', 18, false),
    ('german', 'future', 'Future', 19, false),
    ('german', 'adjectives', 'Adjectives', 20, false),
    ('german', 'prepositions', 'Prepositions', 21, false),
    ('german', 'connectors', 'Connectors', 22, false),
    ('german', 'listening', 'Listening', 23, false),
    ('german', 'speaking', 'Speaking', 24, false),
    ('german', 'reading', 'Reading', 25, false),
    ('german', 'writing', 'Writing', 26, false),
    ('german', 'conversation', 'Conversation', 27, false),
    ('german', 'vocabulary', 'Vocabulary', 28, false),
    ('german', 'grammar', 'Grammar', 29, false),
    ('german', 'technical-vocabulary', 'Technical Vocabulary', 30, false),
    ('german', 'engineering-german', 'Engineering German', 31, false),
    ('french', 'listening', 'Listening', 0, false),
    ('french', 'speaking', 'Speaking', 1, false),
    ('french', 'reading', 'Reading', 2, false),
    ('french', 'writing', 'Writing', 3, false),
    ('french', 'pronunciation', 'Pronunciation', 4, false),
    ('french', 'vocabulary', 'Vocabulary', 5, false),
    ('french', 'grammar', 'Grammar', 6, false),
    ('french', 'conversation', 'Conversation', 7, false),
    ('japanese', 'listening', 'Listening', 0, false),
    ('japanese', 'speaking', 'Speaking', 1, false),
    ('japanese', 'reading', 'Reading', 2, false),
    ('japanese', 'writing', 'Writing', 3, false),
    ('japanese', 'pronunciation', 'Pronunciation', 4, false),
    ('japanese', 'vocabulary', 'Vocabulary', 5, false),
    ('japanese', 'grammar', 'Grammar', 6, false),
    ('japanese', 'kana', 'Kana', 7, false),
    ('japanese', 'kanji', 'Kanji', 8, false),
    ('japanese', 'conversation', 'Conversation', 9, false),
    ('mandarin', 'listening', 'Listening', 0, false),
    ('mandarin', 'speaking', 'Speaking', 1, false),
    ('mandarin', 'reading', 'Reading', 2, false),
    ('mandarin', 'writing', 'Writing', 3, false),
    ('mandarin', 'pronunciation', 'Pronunciation', 4, false),
    ('mandarin', 'vocabulary', 'Vocabulary', 5, false),
    ('mandarin', 'grammar', 'Grammar', 6, false),
    ('mandarin', 'tones', 'Tones', 7, false),
    ('mandarin', 'hanzi', 'Hanzi', 8, false),
    ('mandarin', 'conversation', 'Conversation', 9, false),
    ('english', 'technical-vocabulary', 'Technical Vocabulary', 20, false),
    ('english', 'reading-manuals', 'Reading Manuals', 21, false),
    ('english', 'datasheets', 'Datasheets', 22, false),
    ('english', 'technical-videos', 'Technical Videos', 23, false),
    ('english', 'technical-documentation', 'Technical Documentation', 24, false),
    ('english', 'technical-troubleshooting', 'Technical Troubleshooting', 25, false),
    ('english', 'technical-conversation', 'Technical Conversation', 26, false),
    ('english', 'job-interviews', 'Job Interviews', 27, false)
  ) as v(ckey, skey, sname, sort, arch)
  join public.skill_categories c on c.user_id = uid and c.key = v.ckey
  on conflict (category_id, key) do nothing;

  insert into public.learning_paths (user_id, key, title, goal, practice_project, expected_result, sort_order) values
    (uid, 'english-mechatronics', 'English for Mechatronics', 'Poder explicar un problema técnico completo en inglés.', 'Explicar en inglés (video de 3 min) cómo diagnosticaste una falla', 'Lees un manual/datasheet en inglés y explicas una falla técnica sin traducir.', 10),
    (uid, 'german-academy', 'German Academy · A1 → C2', 'Base sólida de alemán, sin prisa, cuando decidas activarlo.', 'Presentarte y describir tu trabajo en alemán (A1–A2)', 'Avanzar por niveles A1→C2 con evidencia de cada habilidad, no por horas.', 11),
    (uid, 'german-engineering', 'German for Engineering', 'Comprender vocabulario y documentación técnica básica en alemán.', 'Glosario técnico DE/EN/ES de un tablero eléctrico real', 'Leer una hoja técnica básica en alemán e identificar componentes y advertencias.', 12)
  on conflict (user_id, key) do nothing;

  insert into public.learning_path_steps (path_id, user_id, skill_id, position)
  select p.id, uid, s.id, v.pos
  from (values
    ('english-mechatronics', 'english', 'technical-vocabulary', 1),
    ('english-mechatronics', 'english', 'reading-manuals', 2),
    ('english-mechatronics', 'english', 'datasheets', 3),
    ('english-mechatronics', 'english', 'technical-videos', 4),
    ('english-mechatronics', 'english', 'technical-documentation', 5),
    ('english-mechatronics', 'english', 'technical-troubleshooting', 6),
    ('english-mechatronics', 'english', 'technical-conversation', 7),
    ('english-mechatronics', 'english', 'job-interviews', 8),
    ('german-academy', 'german', 'pronunciation', 1),
    ('german-academy', 'german', 'alphabet-sounds', 2),
    ('german-academy', 'german', 'greetings', 3),
    ('german-academy', 'german', 'numbers', 4),
    ('german-academy', 'german', 'dates', 5),
    ('german-academy', 'german', 'time', 6),
    ('german-academy', 'german', 'basic-vocabulary', 7),
    ('german-academy', 'german', 'articles', 8),
    ('german-academy', 'german', 'gender', 9),
    ('german-academy', 'german', 'cases', 10),
    ('german-academy', 'german', 'nominative', 11),
    ('german-academy', 'german', 'accusative', 12),
    ('german-academy', 'german', 'dative', 13),
    ('german-academy', 'german', 'genitive', 14),
    ('german-academy', 'german', 'verb-conjugation', 15),
    ('german-academy', 'german', 'word-order', 16),
    ('german-academy', 'german', 'modal-verbs', 17),
    ('german-academy', 'german', 'separable-verbs', 18),
    ('german-academy', 'german', 'past-tenses', 19),
    ('german-academy', 'german', 'future', 20),
    ('german-academy', 'german', 'adjectives', 21),
    ('german-academy', 'german', 'prepositions', 22),
    ('german-academy', 'german', 'connectors', 23),
    ('german-academy', 'german', 'listening', 24),
    ('german-academy', 'german', 'speaking', 25),
    ('german-academy', 'german', 'reading', 26),
    ('german-academy', 'german', 'writing', 27),
    ('german-academy', 'german', 'conversation', 28),
    ('german-engineering', 'german', 'basic-vocabulary', 1),
    ('german-engineering', 'german', 'articles', 2),
    ('german-engineering', 'german', 'technical-vocabulary', 3),
    ('german-engineering', 'german', 'reading', 4),
    ('german-engineering', 'german', 'engineering-german', 5)
  ) as v(pkey, ckey, skey, pos)
  join public.learning_paths p on p.user_id = uid and p.key = v.pkey
  join public.skill_categories c on c.user_id = uid and c.key = v.ckey
  join public.skills s on s.category_id = c.id and s.key = v.skey
  on conflict do nothing;

  insert into public.skill_projects (user_id, key, title, objective, sequence, path_key, domain, difficulty) values
    (uid, 'lab-led-circuits', 'LED circuits', 'Armar circuitos con LEDs y calcular resistencias.', 11, 'mechatronics-lab', 'engineering', 1),
    (uid, 'lab-relay-control', 'Relay control', 'Controlar una carga con un relevador de forma segura.', 12, 'mechatronics-lab', 'engineering', 1),
    (uid, 'lab-sensor-testing', 'Sensor testing', 'Probar sensores y leer su comportamiento con instrumentos.', 13, 'mechatronics-lab', 'engineering', 1),
    (uid, 'lab-motor-basics', 'Motor basics', 'Arrancar, invertir y medir un motor DC.', 14, 'mechatronics-lab', 'engineering', 1),
    (uid, 'lab-arduino-basics', 'Arduino basics', 'Entradas y salidas digitales con Arduino.', 15, 'mechatronics-lab', 'engineering', 1),
    (uid, 'lab-automatic-lighting', 'Automatic lighting', 'Encender iluminación según luz ambiente.', 21, 'mechatronics-lab', 'engineering', 2),
    (uid, 'lab-temperature-monitoring', 'Temperature monitoring', 'Medir y registrar temperatura con alertas.', 22, 'mechatronics-lab', 'engineering', 2),
    (uid, 'lab-motor-control', 'Motor control', 'Arranque directo con contactor y protección.', 23, 'mechatronics-lab', 'engineering', 2),
    (uid, 'lab-pneumatic-sequence', 'Pneumatic sequence', 'Secuencia A+ B+ A- B- con electroválvulas.', 24, 'mechatronics-lab', 'engineering', 2),
    (uid, 'lab-plc-traffic-light', 'PLC traffic light', 'Semáforo en ladder con timers.', 25, 'mechatronics-lab', 'engineering', 2),
    (uid, 'lab-conveyor-simulation', 'Conveyor simulation', 'Banda transportadora con sensores e interlocks.', 31, 'mechatronics-lab', 'engineering', 3),
    (uid, 'lab-plc-p-hmi', 'PLC + HMI', 'Pantalla HMI para operar y ver alarmas.', 32, 'mechatronics-lab', 'engineering', 3),
    (uid, 'lab-vfd-motor-control', 'VFD motor control', 'Control de velocidad de motor trifásico con variador.', 33, 'mechatronics-lab', 'engineering', 3),
    (uid, 'lab-automatic-tank', 'Automatic tank', 'Control de nivel con PID.', 34, 'mechatronics-lab', 'engineering', 3),
    (uid, 'lab-sensor-network', 'Sensor network', 'Red de sensores con ESP32.', 35, 'mechatronics-lab', 'engineering', 3),
    (uid, 'lab-industrial-automation-cell', 'Industrial automation cell', 'Celda automatizada con tablero y seguridad.', 41, 'mechatronics-lab', 'engineering', 4),
    (uid, 'lab-scada-project', 'SCADA project', 'Supervisión de proceso con SCADA y Modbus.', 42, 'mechatronics-lab', 'engineering', 4),
    (uid, 'lab-predictive-maintenance-project', 'Predictive maintenance project', 'Detectar fallas por tendencia de datos.', 43, 'mechatronics-lab', 'engineering', 4),
    (uid, 'lab-robotic-system', 'Robotic system', 'Programar un sistema robótico con seguridad.', 44, 'mechatronics-lab', 'engineering', 4),
    (uid, 'lab-integrated-mechatronic-system', 'Integrated mechatronic system', 'Diseñar un sistema mecatrónico completo.', 45, 'mechatronics-lab', 'engineering', 4)
  on conflict (user_id, key) do nothing;

  insert into public.skill_project_skills (project_id, user_id, skill_id)
  select p.id, uid, s.id
  from (values
    ('lab-led-circuits', 'mx-electricity', 'ohms-law'),
    ('lab-led-circuits', 'mx-electricity', 'wiring'),
    ('lab-led-circuits', 'mx-instrumentation', 'multimeter'),
    ('lab-relay-control', 'mx-actuators', 'relays'),
    ('lab-relay-control', 'mx-electricity', 'wiring'),
    ('lab-relay-control', 'mx-safety', 'electrical-safety'),
    ('lab-sensor-testing', 'mx-sensors', 'sensor-fundamentals'),
    ('lab-sensor-testing', 'mx-instrumentation', 'multimeter'),
    ('lab-sensor-testing', 'mx-sensors', 'proximity-sensors'),
    ('lab-motor-basics', 'mx-motors', 'dc-motors'),
    ('lab-motor-basics', 'mx-motors', 'motor-fundamentals'),
    ('lab-motor-basics', 'mx-safety', 'electrical-safety'),
    ('lab-arduino-basics', 'mx-embedded', 'arduino'),
    ('lab-arduino-basics', 'mx-embedded', 'mcu-digital-i-o'),
    ('lab-arduino-basics', 'mx-programming', 'programming-fundamentals'),
    ('lab-automatic-lighting', 'mx-sensors', 'photoelectric-sensors'),
    ('lab-automatic-lighting', 'mx-actuators', 'relays'),
    ('lab-automatic-lighting', 'mx-embedded', 'arduino'),
    ('lab-temperature-monitoring', 'mx-sensors', 'temperature-sensors'),
    ('lab-temperature-monitoring', 'mx-embedded', 'mcu-analog-i-o'),
    ('lab-temperature-monitoring', 'mx-programming', 'data'),
    ('lab-motor-control', 'mx-motors', 'motor-starters'),
    ('lab-motor-control', 'mx-actuators', 'contactors'),
    ('lab-motor-control', 'mx-motors', 'motor-protection'),
    ('lab-pneumatic-sequence', 'mx-pneumatics', 'pneumatic-cylinders'),
    ('lab-pneumatic-sequence', 'mx-pneumatics', 'pneumatic-valves'),
    ('lab-pneumatic-sequence', 'mx-pneumatics', 'pneumatic-diagrams'),
    ('lab-pneumatic-sequence', 'mx-plc', 'sequences'),
    ('lab-plc-traffic-light', 'mx-plc', 'ladder-logic'),
    ('lab-plc-traffic-light', 'mx-plc', 'timers'),
    ('lab-plc-traffic-light', 'mx-plc', 'sequences'),
    ('lab-conveyor-simulation', 'mx-plc', 'plc-fundamentals'),
    ('lab-conveyor-simulation', 'mx-plc', 'sequences'),
    ('lab-conveyor-simulation', 'mx-sensors', 'proximity-sensors'),
    ('lab-conveyor-simulation', 'mx-plc', 'interlocks'),
    ('lab-plc-p-hmi', 'mx-automation', 'hmi'),
    ('lab-plc-p-hmi', 'mx-plc', 'hmi-integration'),
    ('lab-plc-p-hmi', 'mx-plc', 'alarms'),
    ('lab-vfd-motor-control', 'mx-motors', 'vfd'),
    ('lab-vfd-motor-control', 'mx-motors', 'three-phase-motors'),
    ('lab-vfd-motor-control', 'mx-motors', 'motor-protection'),
    ('lab-automatic-tank', 'mx-sensors', 'level-sensors'),
    ('lab-automatic-tank', 'mx-control', 'pid'),
    ('lab-automatic-tank', 'mx-actuators', 'control-valves'),
    ('lab-sensor-network', 'mx-embedded', 'embedded-communication'),
    ('lab-sensor-network', 'mx-embedded', 'esp32'),
    ('lab-sensor-network', 'mx-embedded', 'sensor-interfacing'),
    ('lab-industrial-automation-cell', 'mx-automation', 'automation-fundamentals'),
    ('lab-industrial-automation-cell', 'mx-automation', 'control-panels'),
    ('lab-industrial-automation-cell', 'mx-automation', 'safety-systems'),
    ('lab-industrial-automation-cell', 'mx-plc', 'plc-fundamentals'),
    ('lab-scada-project', 'mx-automation', 'scada'),
    ('lab-scada-project', 'mx-comm', 'modbus'),
    ('lab-scada-project', 'mx-comm', 'industrial-networks'),
    ('lab-predictive-maintenance-project', 'mx-maintenance', 'predictive-maintenance'),
    ('lab-predictive-maintenance-project', 'mx-programming', 'data'),
    ('lab-predictive-maintenance-project', 'mx-maintenance', 'failure-analysis'),
    ('lab-robotic-system', 'mx-robotics', 'robot-programming'),
    ('lab-robotic-system', 'mx-robotics', 'kinematics'),
    ('lab-robotic-system', 'mx-robotics', 'robot-safety'),
    ('lab-integrated-mechatronic-system', 'mx-cad', 'mechanical-design'),
    ('lab-integrated-mechatronic-system', 'mx-embedded', 'microcontrollers'),
    ('lab-integrated-mechatronic-system', 'mx-control', 'closed-loop'),
    ('lab-integrated-mechatronic-system', 'mx-cad', '3d-cad')
  ) as v(pkey, ckey, skey)
  join public.skill_projects p on p.user_id = uid and p.key = v.pkey
  join public.skill_categories c on c.user_id = uid and c.key = v.ckey
  join public.skills s on s.category_id = c.id and s.key = v.skey
  on conflict do nothing;

  insert into public.skill_links (user_id, from_skill_id, to_skill_id, relation)
  select uid, a.id, b.id, v.rel
  from (values
    ('mx-plc', 'plc-fundamentals', 'mx-automation', 'automation-fundamentals', 'related'),
    ('mx-automation', 'automation-fundamentals', 'mx-sensors', 'sensor-fundamentals', 'related'),
    ('mx-sensors', 'sensor-fundamentals', 'mx-motors', 'motor-fundamentals', 'related'),
    ('mx-motors', 'motor-fundamentals', 'mx-troubleshooting', 'troubleshooting-method', 'related'),
    ('mx-plc', 'plc-fundamentals', 'mx-troubleshooting', 'troubleshooting-method', 'related'),
    ('mx-plc', 'timers', 'mx-plc', 'ladder-logic', 'prerequisite'),
    ('mx-electricity', 'ohms-law', 'mx-electricity', 'electrical-fundamentals', 'prerequisite'),
    ('mx-safety', 'electrical-safety', 'mx-electricity', 'wiring', 'prerequisite'),
    ('mx-safety', 'lockout-tagout', 'mx-electricity', 'electrical-panels', 'prerequisite'),
    ('mx-motors', 'vfd', 'mx-motors', 'three-phase-motors', 'related'),
    ('mx-control', 'pid', 'mx-control', 'closed-loop', 'prerequisite'),
    ('mx-instrumentation', 'multimeter', 'mx-instrumentation', 'electrical-diagnostics', 'prerequisite'),
    ('english', 'reading', 'english', 'reading-manuals', 'prerequisite'),
    ('english', 'reading-manuals', 'mx-plc', 'plc-fundamentals', 'applies_to'),
    ('english', 'technical-vocabulary', 'english', 'technical-troubleshooting', 'prerequisite'),
    ('german', 'basic-vocabulary', 'german', 'technical-vocabulary', 'prerequisite'),
    ('german', 'technical-vocabulary', 'german', 'engineering-german', 'prerequisite'),
    ('german', 'technical-vocabulary', 'english', 'technical-vocabulary', 'related')
  ) as v(ca, sa, cb, sb, rel)
  join public.skill_categories c1 on c1.user_id = uid and c1.key = v.ca
  join public.skills a on a.category_id = c1.id and a.key = v.sa
  join public.skill_categories c2 on c2.user_id = uid and c2.key = v.cb
  join public.skills b on b.category_id = c2.id and b.key = v.sb
  on conflict do nothing;

  -- Perfil de idiomas: English PRIMARY, el resto FUTURE (tú decides cuándo activarlos)
  insert into public.languages (user_id, code, name, flag, status, category_id, sort_order)
  select uid, v.code, v.name, v.flag, v.status, c.id, v.sort
  from (values
    ('es', 'Español', '🇪🇸', 'native', null, 0),
    ('en', 'English', '🇺🇸', 'primary', 'english', 1),
    ('fr', 'French', '🇫🇷', 'future', 'french', 2),
    ('de', 'German', '🇩🇪', 'future', 'german', 3),
    ('ja', 'Japanese', '🇯🇵', 'future', 'japanese', 4),
    ('zh', 'Mandarin Chinese', '🇨🇳', 'future', 'mandarin', 5)
  ) as v(code, name, flag, status, ckey, sort)
  left join public.skill_categories c on c.user_id = uid and c.key = v.ckey
  on conflict (user_id, code) do nothing;

  -- Primera temporada de enfoque
  if not exists (select 1 from public.focus_seasons where user_id = uid) then
    with s as (
      insert into public.focus_seasons (user_id, name, starts_on, ends_on)
      values (uid, 'OCT–DIC 2026', '2026-10-01', '2026-12-31') returning id
    )
    insert into public.focus_items (season_id, user_id, label, level, sort_order)
    select s.id, uid, v.label, v.level, v.sort from s, (values
      ('English', 'primary', 1), ('Mechatronics', 'primary', 2), ('Filmmaking', 'primary', 3),
      ('Physical Health', 'primary', 4), ('Finances', 'primary', 5),
      ('French', 'future', 10), ('German', 'future', 11), ('Japanese', 'future', 12), ('Mandarin', 'future', 13)
    ) as v(label, level, sort);
  end if;
end $$;

create or replace function public.handle_new_user_knowledge()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.seed_knowledge(new.id);
  return new;
end $$;
-- El nombre asegura que corre después de on_auth_user_created_skills (orden alfabético)
create trigger on_auth_user_created_zz_knowledge after insert on auth.users
  for each row execute function public.handle_new_user_knowledge();

revoke execute on function public.seed_knowledge(uuid) from public, anon, authenticated;
revoke execute on function public.handle_new_user_knowledge() from public, anon, authenticated;
revoke execute on function public.check_knowledge_owner() from public, anon, authenticated;

do $$ begin perform public.seed_knowledge(id) from auth.users; end $$;

commit;

notify pgrst, 'reload schema';
