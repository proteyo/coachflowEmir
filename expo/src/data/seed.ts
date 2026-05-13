import { DBShape } from "@/src/types/models";

export function buildSeed(): DBShape {
  return {
    users: [],

    coachProfiles: [],

    clientProfiles: [],

    subscriptions: [],

    workouts: [],

    exercises: [],

    supplementPlans: [],

    supplementItems: [],

    supplementLogs: [],

    progress: [],

    messages: [],

    weeklyGoals: [],

    streaks: [],

    attendance: [],

    places: [],

    notifications: [],

    meta: {
      seeded: true,
      version: 3,
    },
  };
}

export const DEMO_IDS = {
  COACH_ID: "",
  C1: "",
  C2: "",
  C3: "",
};