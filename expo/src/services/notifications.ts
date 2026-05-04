/**
 * Notifications service.
 *
 * Structured to support real local push notifications via `expo-notifications`
 * later. Today we keep it as a no-op + console log so the rest of the app can
 * call into a stable API without breaking Expo Go.
 *
 * Behavior contract (when wired up):
 * - Workouts: daily morning reminder (default 08:00), plus an at-time reminder
 *   if a workout has a `time` set.
 * - Supplements: 1 hour BEFORE each scheduled supplement time.
 *
 * Settings respect the user's `NotificationSetting` toggles
 * (workoutReminders / supplementReminders).
 */
import { NotificationSetting, SupplementItem, WorkoutAssignment } from "@/src/types/models";

export interface ScheduledReminder {
  id: string;
  kind: "workout-daily" | "workout-time" | "supplement";
  /** ISO string the reminder should fire at (next occurrence). */
  fireAt: string;
  title: string;
  body: string;
}

const MORNING_HOUR = 8;
const MORNING_MIN = 0;

function nextOccurrence(hours: number, minutes: number): Date {
  const d = new Date();
  d.setSeconds(0, 0);
  d.setHours(hours, minutes, 0, 0);
  if (d.getTime() <= Date.now()) d.setDate(d.getDate() + 1);
  return d;
}

function parseHHMM(time: string): { h: number; m: number } | null {
  const m = /^([0-2]?\d):([0-5]\d)$/.exec(time.trim());
  if (!m) return null;
  const h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  if (h < 0 || h > 23) return null;
  return { h, m: min };
}

export function buildClientReminders(input: {
  settings: NotificationSetting | undefined;
  workoutsToday: WorkoutAssignment[];
  supplements: SupplementItem[];
}): ScheduledReminder[] {
  const out: ScheduledReminder[] = [];
  const s = input.settings;

  if (s?.workoutReminders !== false) {
    out.push({
      id: "workout-daily",
      kind: "workout-daily",
      fireAt: nextOccurrence(MORNING_HOUR, MORNING_MIN).toISOString(),
      title: "Time to train",
      body: "Don't forget your workout today.",
    });
    for (const w of input.workoutsToday) {
      if (!w.time) continue;
      const p = parseHHMM(w.time);
      if (!p) continue;
      out.push({
        id: `workout-${w.id}`,
        kind: "workout-time",
        fireAt: nextOccurrence(p.h, p.m).toISOString(),
        title: w.name,
        body: `Workout at ${w.time}`,
      });
    }
  }

  if (s?.supplementReminders !== false) {
    for (const item of input.supplements) {
      for (const time of item.specificTimes) {
        const p = parseHHMM(time);
        if (!p) continue;
        // 1 hour before
        let h = p.h - 1;
        let m = p.m;
        if (h < 0) h += 24;
        out.push({
          id: `supp-${item.id}-${time}`,
          kind: "supplement",
          fireAt: nextOccurrence(h, m).toISOString(),
          title: item.name,
          body: `${item.dosage} in 1 hour (${time})`,
        });
      }
    }
  }

  return out.sort((a, b) => a.fireAt.localeCompare(b.fireAt));
}

/**
 * Sync the user's reminders with the OS scheduler.
 * Currently a logging stub. When `expo-notifications` is wired up,
 * cancel previous identifiers and call `scheduleNotificationAsync` here.
 */
export async function syncReminders(reminders: ScheduledReminder[]): Promise<void> {
  if (reminders.length === 0) return;
  console.log(
    "[notifications] would schedule",
    reminders.length,
    "reminders →",
    reminders.slice(0, 3).map((r) => `${r.kind}@${r.fireAt}`).join(", "),
  );
}
