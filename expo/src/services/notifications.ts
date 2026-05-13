/**
 * Notifications service.
 *
 * Production-ready local notifications via expo-notifications.
 *
 * What this file does:
 * - Requests notification permission from the user.
 * - Creates Android notification channel.
 * - Builds reminders for workouts and supplements.
 * - Cancels previously scheduled CoachFlow reminders.
 * - Schedules new local notifications on the phone.
 *
 * Current scope:
 * - Local notifications only.
 * - Backend push notifications for new messages can be added later.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import {
  NotificationSetting,
  SupplementItem,
  WorkoutAssignment,
} from "@/src/types/models";

export interface ScheduledReminder {
  id: string;
  kind: "workout-daily" | "workout-time" | "supplement";
  /** ISO string the reminder should fire at. */
  fireAt: string;
  title: string;
  body: string;
}

const STORAGE_KEY = "coachflow:scheduled_notification_ids";
const ANDROID_CHANNEL_ID = "coachflow-reminders";

const MORNING_HOUR = 8;
const MORNING_MIN = 0;

const MAX_SCHEDULED_REMINDERS = 64;

/**
 * Shows notifications while app is foregrounded.
 */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

function nextOccurrence(hours: number, minutes: number): Date {
  const date = new Date();

  date.setSeconds(0, 0);
  date.setHours(hours, minutes, 0, 0);

  if (date.getTime() <= Date.now()) {
    date.setDate(date.getDate() + 1);
  }

  return date;
}

function parseHHMM(time: string): { h: number; m: number } | null {
  const match = /^([0-2]?\d):([0-5]\d)$/.exec(time.trim());

  if (!match) {
    return null;
  }

  const h = Number.parseInt(match[1], 10);
  const m = Number.parseInt(match[2], 10);

  if (Number.isNaN(h) || Number.isNaN(m)) {
    return null;
  }

  if (h < 0 || h > 23) {
    return null;
  }

  return { h, m };
}

function subtractOneHour(hours: number, minutes: number): { h: number; m: number } {
  let h = hours - 1;

  if (h < 0) {
    h += 24;
  }

  return {
    h,
    m: minutes,
  };
}

function sanitizeText(value: string | undefined | null, fallback: string): string {
  const cleaned = String(value ?? "").trim();

  return cleaned.length > 0 ? cleaned : fallback;
}

function buildReminderDateFromISO(value: string): Date | null {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  if (date.getTime() <= Date.now()) {
    return null;
  }

  return date;
}

async function setupAndroidChannel(): Promise<void> {
  if (Platform.OS !== "android") {
    return;
  }

  await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
    name: "CoachFlow reminders",
    importance: Notifications.AndroidImportance.HIGH,
    sound: "default",
    vibrationPattern: [0, 250, 250, 250],
    lightColor: "#2563EB",
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  });
}

export async function requestNotificationPermission(): Promise<boolean> {
  try {
    await setupAndroidChannel();

    const current = await Notifications.getPermissionsAsync();

    if (current.granted) {
      return true;
    }

    const requested = await Notifications.requestPermissionsAsync();

    return requested.granted;
  } catch (error) {
    console.log("[notifications] permission error", error);
    return false;
  }
}

async function getStoredNotificationIds(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);

    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter((item) => typeof item === "string");
  } catch (error) {
    console.log("[notifications] could not read stored ids", error);
    return [];
  }
}

async function storeNotificationIds(ids: string[]): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  } catch (error) {
    console.log("[notifications] could not store ids", error);
  }
}

export async function cancelCoachFlowReminders(): Promise<void> {
  const ids = await getStoredNotificationIds();

  if (ids.length === 0) {
    return;
  }

  await Promise.allSettled(
    ids.map((id) => Notifications.cancelScheduledNotificationAsync(id)),
  );

  await AsyncStorage.removeItem(STORAGE_KEY);
}

/**
 * Builds the user's local reminders.
 *
 * Workouts:
 * - Daily morning reminder at 08:00.
 * - At-time reminder for every workout with time.
 *
 * Supplements:
 * - Reminder 1 hour before each supplement time.
 */
export function buildClientReminders(input: {
  settings: NotificationSetting | undefined;
  workoutsToday: WorkoutAssignment[];
  supplements: SupplementItem[];
}): ScheduledReminder[] {
  const out: ScheduledReminder[] = [];
  const settings = input.settings;

  if (settings?.workoutReminders !== false) {
    out.push({
      id: "workout-daily",
      kind: "workout-daily",
      fireAt: nextOccurrence(MORNING_HOUR, MORNING_MIN).toISOString(),
      title: "Time to train",
      body: "Do not forget your workout today.",
    });

    for (const workout of input.workoutsToday) {
      if (!workout.time) {
        continue;
      }

      const parsedTime = parseHHMM(workout.time);

      if (!parsedTime) {
        continue;
      }

      out.push({
        id: `workout-${workout.id}`,
        kind: "workout-time",
        fireAt: nextOccurrence(parsedTime.h, parsedTime.m).toISOString(),
        title: sanitizeText(workout.name, "Workout reminder"),
        body: `Workout at ${workout.time}`,
      });
    }
  }

  if (settings?.supplementReminders !== false) {
    for (const item of input.supplements) {
      const times = Array.isArray(item.specificTimes) ? item.specificTimes : [];

      for (const time of times) {
        const parsedTime = parseHHMM(time);

        if (!parsedTime) {
          continue;
        }

        const reminderTime = subtractOneHour(parsedTime.h, parsedTime.m);

        out.push({
          id: `supplement-${item.id}-${time}`,
          kind: "supplement",
          fireAt: nextOccurrence(reminderTime.h, reminderTime.m).toISOString(),
          title: sanitizeText(item.name, "Supplement reminder"),
          body: `${sanitizeText(item.dosage, "Supplement")} in 1 hour (${time})`,
        });
      }
    }
  }

  const unique = new Map<string, ScheduledReminder>();

  for (const reminder of out) {
    unique.set(reminder.id, reminder);
  }

  return Array.from(unique.values())
    .sort((a, b) => a.fireAt.localeCompare(b.fireAt))
    .slice(0, MAX_SCHEDULED_REMINDERS);
}

/**
 * Sync the user's reminders with the OS scheduler.
 *
 * It cancels previous CoachFlow reminders and schedules fresh ones.
 */
export async function syncReminders(
  reminders: ScheduledReminder[],
): Promise<void> {
  try {
    await cancelCoachFlowReminders();

    if (reminders.length === 0) {
      return;
    }

    const permissionGranted = await requestNotificationPermission();

    if (!permissionGranted) {
      console.log("[notifications] permission not granted");
      return;
    }

    const scheduledIds: string[] = [];

    for (const reminder of reminders) {
      const fireDate = buildReminderDateFromISO(reminder.fireAt);

      if (!fireDate) {
        continue;
      }

      const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title: reminder.title,
          body: reminder.body,
          sound: "default",
          data: {
            reminderId: reminder.id,
            kind: reminder.kind,
          },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: fireDate,
          channelId: Platform.OS === "android" ? ANDROID_CHANNEL_ID : undefined,
        },
      });

      scheduledIds.push(notificationId);
    }

    await storeNotificationIds(scheduledIds);

    console.log(
      "[notifications] scheduled",
      scheduledIds.length,
      "reminders",
    );
  } catch (error) {
    console.log("[notifications] sync error", error);
  }
}

export async function getScheduledCoachFlowReminderCount(): Promise<number> {
  const ids = await getStoredNotificationIds();

  return ids.length;
}