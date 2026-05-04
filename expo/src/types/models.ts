export type Role = "coach" | "client";

export interface User {
  id: string;
  email: string;
  password?: string;
  name: string;
  role: Role;
  phone?: string;
  avatarUrl?: string;
  /** Short shareable code (clients only) — e.g. "CFL-AB12CD" */
  clientCode?: string;
  createdAt: string;
}

export interface CoachProfile {
  userId: string;
  specialty: string;
  bio: string;
  experienceYears: number;
  achievements: string[];
  certificates: string[];
  rating: number;
  profileImageUrl?: string;
  coverImageUrl?: string;
}

export type FitnessLevel = "beginner" | "intermediate" | "advanced";

export type GoalType =
  | "lose_weight"
  | "gain_muscle"
  | "improve_mobility"
  | "maintain_shape"
  | "custom";

export interface ClientProfile {
  userId: string;
  /** Empty string when client has not yet been linked to a coach. */
  coachId: string;
  goal: string;
  goalType?: GoalType;
  startWeight: number;
  currentWeight: number;
  height: number;
  age?: number;
  fitnessLevel: FitnessLevel;
  healthNotes?: string;
  createdAt: string;
}

export type SubscriptionStatus = "inactive" | "active" | "expired" | "cancelled";

export interface Subscription {
  id: string;
  coachId: string;
  planName: string;
  price: number;
  currency: string;
  status: SubscriptionStatus;
  startDate?: string;
  endDate?: string;
  createdAt: string;
}

export interface Exercise {
  id: string;
  workoutId: string;
  name: string;
  sets: number;
  reps: number;
  restSeconds: number;
  weight?: number;
  notes?: string;
  imageUrl?: string;
  muscleGroup?: string;
}

export interface WorkoutAssignment {
  id: string;
  coachId: string;
  clientId: string;
  date: string; // YYYY-MM-DD
  /** Optional time of day in 24h format "HH:MM". */
  time?: string;
  name: string;
  description?: string;
  category?: string;
  completed: boolean;
  completedAt?: string;
  durationMinutes?: number;
}

export interface SupplementItem {
  id: string;
  planId: string;
  name: string;
  dosage: string;
  timesPerDay: number;
  specificTimes: string[]; // ["08:00", "13:00"]
  notes?: string;
}

export interface SupplementPlan {
  id: string;
  coachId: string;
  clientId: string;
  startDate: string;
}

export interface SupplementLog {
  id: string;
  clientId: string;
  supplementItemId: string;
  date: string;
  time: string;
  taken: boolean;
}

export interface ProgressEntry {
  id: string;
  clientId: string;
  weight: number;
  date: string;
  notes?: string;
  addedBy: string;
}

export interface Message {
  id: string;
  senderId: string;
  receiverId: string;
  content: string;
  messageType: "text" | "voice";
  voiceUrl?: string;
  voiceDurationMs?: number;
  read: boolean;
  createdAt: string;
}

export interface WeeklyGoal {
  id: string;
  clientId: string;
  weekStart: string;
  targetMinutes: number;
  completedMinutes: number;
  targetWorkouts: number;
  completedWorkouts: number;
}

export interface Streak {
  clientId: string;
  currentStreak: number;
  bestStreak: number;
  lastActivityDate?: string;
}

export interface Attendance {
  id: string;
  clientId: string;
  coachId: string;
  date: string;
  status: "attended" | "missed" | "rest";
  notes?: string;
}

export interface Place {
  id: string;
  type: "gym" | "nutrition" | "shop";
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  description?: string;
  imageUrl?: string;
  rating?: number;
}

export interface NotificationSetting {
  userId: string;
  workoutReminders: boolean;
  supplementReminders: boolean;
  messageNotifications: boolean;
  weeklyGoalReminders: boolean;
}

export interface DBShape {
  users: User[];
  coachProfiles: CoachProfile[];
  clientProfiles: ClientProfile[];
  subscriptions: Subscription[];
  workouts: WorkoutAssignment[];
  exercises: Exercise[];
  supplementPlans: SupplementPlan[];
  supplementItems: SupplementItem[];
  supplementLogs: SupplementLog[];
  progress: ProgressEntry[];
  messages: Message[];
  weeklyGoals: WeeklyGoal[];
  streaks: Streak[];
  attendance: Attendance[];
  places: Place[];
  notifications: NotificationSetting[];
  meta: { seeded: boolean; version: number };
}
