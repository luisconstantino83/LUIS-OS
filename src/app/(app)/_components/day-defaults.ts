import type { DailyLog } from "@/lib/types";

export type DayState = Pick<
  DailyLog,
  | "sleep_hours"
  | "water_glasses"
  | "food_quality"
  | "energy"
  | "pages_read"
  | "meditation_min"
  | "exhausted"
  | "basic_hygiene"
  | "ate_decently"
  | "going_to_sleep"
>;

export const EMPTY_DAY: DayState = {
  sleep_hours: null,
  water_glasses: 0,
  food_quality: null,
  energy: null,
  pages_read: 0,
  meditation_min: 0,
  exhausted: false,
  basic_hygiene: false,
  ate_decently: false,
  going_to_sleep: false,
};

