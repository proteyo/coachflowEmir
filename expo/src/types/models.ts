export type Role = "coach" | "client";

export interface User {
  id: string;
  email: string;
  password?: string;
  name: string;
  role: Role;
  phone?: string | null;
  avatarUrl?: string | null;

  /** Short shareable code for clients, for example "CFL-AB12CD". */
  clientCode?: string | null;

  createdAt: string;

  /** Last authenticated activity time from backend. */
  lastSeenAt?: string | null;

  /** True if the user was active recently. */
  isOnline?: boolean;
}

export interface CoachProfile {
  userId: string;
  specialty: string;
  bio: string;
  experienceYears: number;
  achievements: string[];
  certificates: string[];
  rating: number;
  profileImageUrl?: string | null;
  coverImageUrl?: string | null;
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

  /** Empty string when the client has not yet been linked to a coach. */
  coachId: string;

  goal: string;
  goalType?: GoalType;
  startWeight: number;
  currentWeight: number;
  height: number;
  age?: number;
  fitnessLevel: FitnessLevel;
  healthNotes?: string | null;
  createdAt: string;
}

export type SubscriptionStatus =
  | "inactive"
  | "active"
  | "expired"
  | "cancelled";

export type SubscriptionPlanCode =
  | "free"
  | "starter"
  | "pro"
  | "unlimited";

export interface Subscription {
  id: string;
  coachId: string;
  planCode: SubscriptionPlanCode;
  planName: string;
  price: number;
  currency: string;
  clientLimit: number;
  status: SubscriptionStatus;
  startDate?: string | null;
  endDate?: string | null;
  createdAt: string;
}

export type WorkoutSource =
  | "manual"
  | "weekly_template"
  | "ai_generated"
  | "imported";

export interface Exercise {
  id: string;
  workoutId: string;

  /** Optional link to exerciseLibrary.ts item id. */
  libraryExerciseId?: string | null;

  name: string;
  nameRu?: string | null;
  nameKk?: string | null;

  sets: number;
  reps: number;
  restSeconds: number;
  weight?: number | null;

  notes?: string | null;
  notesRu?: string | null;
  notesKk?: string | null;

  imageUrl?: string | null;

  /** Optional animated media support. */
  gifUrl?: string | null;
  animationFrames?: string[];

  muscleGroup?: string | null;

  /** Extra professional programming fields. */
  tempo?: string | null;
  targetRpe?: number | null;
  order?: number | null;
}

export interface WorkoutAssignment {
  id: string;
  coachId: string;
  clientId: string;
  date: string; // YYYY-MM-DD

  /** Optional time of day in 24h format, for example "18:00". */
  time?: string | null;

  name: string;
  nameRu?: string | null;
  nameKk?: string | null;

  description?: string | null;
  descriptionRu?: string | null;
  descriptionKk?: string | null;

  category?: string | null;
  categoryRu?: string | null;
  categoryKk?: string | null;

  completed: boolean;
  completedAt?: string | null;
  durationMinutes?: number | null;

  /** These fields are optional so old workouts continue working. */
  source?: WorkoutSource | null;
  weeklyPlanId?: string | null;
  weeklyPlanTitle?: string | null;
  weeklyPlanTitleRu?: string | null;
  weeklyPlanTitleKk?: string | null;
  weeklyPlanDayIndex?: number | null;
  difficulty?: FitnessLevel | null;
  focus?: string | null;
  focusRu?: string | null;
  focusKk?: string | null;
  coachNotes?: string | null;
  coachNotesRu?: string | null;
  coachNotesKk?: string | null;
}

export type SupplementDay =
  | "Mon"
  | "Tue"
  | "Wed"
  | "Thu"
  | "Fri"
  | "Sat"
  | "Sun";

export interface SupplementItem {
  id: string;
  planId: string;
  name: string;
  dosage: string;
  timesPerDay: number;
  specificTimes: string[]; // ["08:00", "13:00"]
  daysOfWeek?: SupplementDay[];
  notes?: string | null;
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
  notes?: string | null;
  addedBy: string;

  /** Optional progress fields for a stronger results screen. */
  bodyFatPercent?: number | null;
  waistCm?: number | null;
  chestCm?: number | null;
  hipsCm?: number | null;
  armCm?: number | null;
  thighCm?: number | null;
  mood?: number | null;
  energy?: number | null;
  sleepHours?: number | null;
  steps?: number | null;
  progressPhotoUrl?: string | null;
}

export interface Message {
  id: string;
  senderId: string;

  /**
   * Can be null if the receiver was deleted on backend,
   * because backend model can use ondelete="SET NULL".
   */
  receiverId: string | null;

  content: string;
  messageType: "text" | "voice";
  voiceUrl?: string | null;
  voiceDurationMs?: number | null;

  /**
   * false = sent but not read
   * true = partner opened chat and backend marked it as read
   */
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
  lastActivityDate?: string | null;
}

export interface Attendance {
  id: string;
  clientId: string;
  coachId: string;
  date: string;
  status: "attended" | "missed" | "rest";
  notes?: string | null;
}

export interface Place {
  id: string;
  type: "gym" | "nutrition" | "shop";
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  description?: string | null;
  imageUrl?: string | null;
  rating?: number | null;
}

export interface NotificationSetting {
  userId: string;
  workoutReminders: boolean;
  supplementReminders: boolean;
  messageNotifications: boolean;
  weeklyGoalReminders: boolean;
}

export type WeeklyPlanGoal =
  | "fat_loss"
  | "muscle_gain"
  | "strength"
  | "mobility"
  | "endurance"
  | "general_fitness"
  | "glutes_legs"
  | "home_training"
  | "posture_back"
  | "recomposition"
  | "upper_body"
  | "dumbbell_home"
  | "beginner_gym";

export type WeeklyPlanEquipment =
  | "gym"
  | "home"
  | "bodyweight"
  | "dumbbells"
  | "mixed";

export interface WeeklyPlanExercise {
  id: string;

  /** Exercise id from exerciseLibrary.ts. */
  exerciseId?: string | null;

  name: string;
  nameRu?: string | null;
  nameKk?: string | null;

  sets: number;
  reps: number;
  restSeconds: number;
  weight?: number | null;

  notes?: string | null;
  notesRu?: string | null;
  notesKk?: string | null;

  tempo?: string | null;
  targetRpe?: number | null;
  muscleGroup?: string | null;

  imageUrl?: string | null;

  /** Used later for clickable GIF / animation preview. */
  gifUrl?: string | null;
  animationFrames?: string[];
}

export interface WeeklyPlanDay {
  id: string;
  dayOffset: number;

  name: string;
  nameRu?: string | null;
  nameKk?: string | null;

  description?: string | null;
  descriptionRu?: string | null;
  descriptionKk?: string | null;

  category?: string | null;
  categoryRu?: string | null;
  categoryKk?: string | null;

  durationMinutes: number;
  time?: string | null;
  exercises: WeeklyPlanExercise[];
}

export interface WeeklyTrainingPlan {
  id: string;

  title: string;
  titleRu?: string | null;
  titleKk?: string | null;

  subtitle?: string | null;
  subtitleRu?: string | null;
  subtitleKk?: string | null;

  goal: WeeklyPlanGoal;

  goalLabel: string;
  goalLabelRu?: string | null;
  goalLabelKk?: string | null;

  description: string;
  descriptionRu?: string | null;
  descriptionKk?: string | null;

  level: FitnessLevel;
  equipment: WeeklyPlanEquipment;
  sessionsPerWeek: number;
  estimatedMinutesPerSession: number;
  tags: string[];

  coachAnalysis: string;
  coachAnalysisRu?: string | null;
  coachAnalysisKk?: string | null;

  safetyNotes: string[];
  safetyNotesRu?: string[];
  safetyNotesKk?: string[];

  progressionNotes: string[];
  progressionNotesRu?: string[];
  progressionNotesKk?: string[];

  days: WeeklyPlanDay[];
}

export interface ClientProgressInsight {
  id: string;
  clientId: string;
  title: string;
  titleRu?: string | null;
  titleKk?: string | null;

  description: string;
  descriptionRu?: string | null;
  descriptionKk?: string | null;

  type: "positive" | "warning" | "neutral" | "recommendation";
  createdAt: string;
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

  /**
   * Optional local AI/progress insights.
   * It is optional so existing seed data will not break.
   */
  progressInsights?: ClientProgressInsight[];

  meta: {
    seeded: boolean;
    version: number;
  };
}