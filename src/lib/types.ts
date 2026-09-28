// Tipos de filas de la base de datos (espejo de supabase/migrations/0001_init.sql)

export type DayType = "crecimiento" | "mantenimiento" | "carrera" | "creador" | "reset";
export type FoodQuality = "excelente" | "buena" | "regular" | "mala";
export type HabitGroup = "manana" | "noche" | "general";

export interface Profile {
  id: string;
  display_name: string;
  timezone: string;
  day_start_hour: number;
  monthly_income_estimate: number | null;
  sleep_goal_hours: number;
  water_goal_glasses: number;
  pages_goal_daily: number;
  meditation_goal_min: number;
  sleep_nights_target: number;
  workouts_target: number;
  pages_week_target: number;
  meditation_days_target: number;
  hygiene_days_target: number;
  content_week_target: number;
}

export interface WeekTemplateRow {
  user_id: string;
  weekday: number;
  day_type: DayType;
  work_start: string | null;
  work_end: string | null;
  workout_focus: string | null;
}

export interface DailyLog {
  user_id: string;
  log_date: string;
  sleep_hours: number | null;
  water_glasses: number;
  food_quality: FoodQuality | null;
  energy: number | null;
  pages_read: number;
  meditation_min: number;
  exhausted: boolean;
  basic_hygiene: boolean;
  ate_decently: boolean;
  going_to_sleep: boolean;
  note: string | null;
}

export interface Habit {
  id: string;
  user_id: string;
  key: string | null;
  name: string;
  group_key: HabitGroup;
  active_days: number[];
  target_per_week: number | null;
  sort_order: number;
  archived: boolean;
}

export interface HabitLog {
  habit_id: string;
  user_id: string;
  log_date: string;
}

export interface Priority {
  id: string;
  user_id: string;
  log_date: string;
  position: number;
  title: string;
  done: boolean;
}

export interface Workout {
  id: string;
  user_id: string;
  log_date: string;
  focus: string;
  duration_min: number | null;
  notes: string | null;
  created_at: string;
}

export interface WorkoutSet {
  id: string;
  workout_id: string;
  user_id: string;
  exercise: string;
  set_number: number;
  reps: number | null;
  weight_kg: number | null;
  notes: string | null;
  created_at: string;
}

export type TxKind = "ingreso" | "gasto";

export interface Transaction {
  id: string;
  user_id: string;
  tx_date: string;
  kind: TxKind;
  category: string;
  amount: number;
  note: string | null;
}

export interface Card {
  id: string;
  user_id: string;
  bank: string;
  nickname: string | null;
  balance: number;
  cut_day: number | null;
  due_day: number | null;
  monthly_payment: number | null;
  archived: boolean;
}

export interface WorthItAnswers {
  salud?: boolean;
  dinero?: boolean;
  profesional?: boolean;
  necesito?: boolean;
  duplicado?: boolean;
}

export interface MsiPurchase {
  id: string;
  user_id: string;
  card_id: string | null;
  product: string;
  total_price: number;
  months: number;
  monthly_payment: number;
  start_date: string;
  end_date: string;
  worth_it: WorthItAnswers;
  created_at: string;
}

export type GoalCategory = "emergencia" | "viajes" | "equipo" | "automovil" | "educacion" | "otros";

export interface SavingsGoal {
  id: string;
  user_id: string;
  category: GoalCategory;
  name: string;
  target: number;
  saved: number;
}

export type ContentOwner = "luis" | "monse";
export type Platform = "youtube" | "instagram" | "tiktok";
export type ContentStatus = "idea" | "guion" | "grabacion" | "edicion" | "programado" | "publicado";

export interface ContentItem {
  id: string;
  user_id: string;
  owner: ContentOwner;
  platform: Platform;
  title: string;
  status: ContentStatus;
  hook: string | null;
  concept: string | null;
  script: string | null;
  shot_list: string | null;
  caption: string | null;
  cta: string | null;
  hashtags: string | null;
  scheduled_date: string | null;
  published_date: string | null;
  url: string | null;
  views: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  saves: number | null;
  followers_gained: number | null;
  engagement_rate: number | null;
  production_id: string | null;
  campaign_id: string | null;
  format: ContentFormat | null;
  in_portfolio: boolean;
  portfolio_note: string | null;
  roles: string[];
  created_at: string;
  updated_at: string;
}

export interface WeeklyReview {
  id: string;
  user_id: string;
  week_start: string;
  metrics: Record<string, unknown>;
  career_progress: string | null;
  work_went_well: string | null;
  work_repeated_problem: string | null;
  feeling: string | null;
  feeling_score: number | null;
  wins: string | null;
  problems: string | null;
  lessons: string | null;
  next_week: string | null;
  top_priorities: string[];
  completed_at: string | null;
  learned_text: string | null;
  next_skill_id: string | null;
  unexpected_expenses: string | null;
  money_win: string | null;
  money_problem: string | null;
  next_money_move: string | null;
  can_do_now: string | null;
}

// ---------------------------------------------------------------------------
// Monse × DAZN
// ---------------------------------------------------------------------------
export type CampaignStatus =
  | "contactada"
  | "negociacion"
  | "aceptada"
  | "produccion"
  | "enviada"
  | "aprobada"
  | "publicada"
  | "pagada";

export interface Campaign {
  id: string;
  user_id: string;
  brand: string;
  program: string | null;
  contact_name: string | null;
  contact_email: string | null;
  brief: string | null;
  deliverables: string | null;
  deadline: string | null;
  payment_amount: number | null;
  payment_currency: "MXN" | "USD" | "EUR";
  paid_at: string | null;
  status: CampaignStatus;
  links: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export type ProductionStatus = "planeacion" | "grabacion" | "postproduccion" | "terminada";
export type Phase = "antes" | "durante" | "despues";

export interface Production {
  id: string;
  user_id: string;
  owner: ContentOwner;
  campaign_id: string | null;
  title: string;
  event_date: string | null;
  location: string | null;
  status: ProductionStatus;
  concept: string | null;
  story_beats: string | null;
  refs: string | null;
  hooks: string | null;
  shot_list: string | null;
  gear: string | null;
  planned_outputs: string | null;
  learnings: string | null;
  review_failed: string | null;
  review_missing_shot: string | null;
  review_repeat: string | null;
  review_differently: string | null;
  review_next_skill_id: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProductionTask {
  id: string;
  production_id: string;
  user_id: string;
  phase: Phase;
  title: string;
  done: boolean;
  sort_order: number;
}

export interface Milestone {
  id: string;
  user_id: string;
  area: "monse" | "luis";
  period_label: string;
  target_date: string | null;
  title: string;
  description: string | null;
  done: boolean;
}

export type ContentFormat =
  | "reel"
  | "tiktok"
  | "short"
  | "carrusel"
  | "foto"
  | "stories"
  | "video"
  | "vlog"
  | "mini_doc";

// ---------------------------------------------------------------------------
// Skills
// ---------------------------------------------------------------------------
export interface SkillCategory {
  id: string;
  user_id: string;
  key: string;
  name: string;
  sort_order: number;
  domain: "creative" | "engineering" | "languages" | "business" | "spiritual" | "general";
}

export interface Skill {
  id: string;
  user_id: string;
  category_id: string;
  key: string;
  name: string;
  level: number;
  next_goal: string | null;
  notes: string | null;
  sort_order: number;
  archived: boolean;
}

export interface SkillEvidence {
  id: string;
  user_id: string;
  skill_id: string;
  kind: "learn" | "practice" | "apply" | "reflect";
  occurred_on: string;
  minutes: number | null;
  title: string | null;
  notes: string | null;
  url: string | null;
  content_id: string | null;
  production_id: string | null;
  project_id: string | null;
  subtype: string | null;
  created_at: string;
}

export interface SkillResource {
  id: string;
  user_id: string;
  skill_id: string;
  kind: "youtube" | "curso" | "libro" | "articulo" | "notas" | "ejercicio";
  title: string;
  url: string | null;
  active: boolean;
}

export interface LearningPath {
  id: string;
  user_id: string;
  key: string | null;
  title: string;
  goal: string | null;
  practice_project: string | null;
  expected_result: string | null;
  target_level: number;
  sort_order: number;
}

export interface SkillProject {
  id: string;
  user_id: string;
  key: string | null;
  title: string;
  objective: string | null;
  sequence: number | null;
  path_key: string | null;
  status: "sugerido" | "activo" | "terminado";
  production_id: string | null;
  started_on: string | null;
  completed_on: string | null;
}

export interface SkillWeek {
  id: string;
  user_id: string;
  week_start: string;
  track: "general" | "engineering";
  skill_id: string;
  objective: string | null;
  micro_lesson: string | null;
  exercise: string | null;
  apply_to: string | null;
}

// ---------------------------------------------------------------------------
// Idiomas, enfoque y Mecatrónica
// ---------------------------------------------------------------------------
export type LanguageStatus = "native" | "primary" | "secondary" | "maintenance" | "paused" | "future";

export interface Language {
  id: string;
  user_id: string;
  code: string;
  name: string;
  flag: string | null;
  status: LanguageStatus;
  cefr: "A1" | "A2" | "B1" | "B2" | "C1" | "C2" | null;
  cefr_evidence: string | null;
  category_id: string | null;
  sort_order: number;
}

export interface FocusSeason {
  id: string;
  user_id: string;
  name: string;
  starts_on: string;
  ends_on: string;
  notes: string | null;
}

export interface FocusItem {
  id: string;
  season_id: string;
  user_id: string;
  label: string;
  level: "primary" | "secondary" | "maintenance" | "future";
  sort_order: number;
}

export interface LabProject extends SkillProject {
  domain: string;
  difficulty: number | null;
  problem: string | null;
  components: string | null;
  theory: string | null;
  diagram: string | null;
  steps: string | null;
  safety: string | null;
  code: string | null;
  results: string | null;
  lessons: string | null;
  tools: string | null;
  visibility: "private" | "public";
}
