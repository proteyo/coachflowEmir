import {
  ClientProfile,
  FitnessLevel,
  ProgressEntry,
  WeeklyPlanDay,
  WeeklyPlanEquipment,
  WeeklyPlanExercise,
  WeeklyPlanGoal,
  WeeklyTrainingPlan,
  WorkoutAssignment,
} from "@/src/types/models";
import {
  EXERCISE_LIBRARY,
  getExerciseAnimationFrames,
  getExerciseById,
} from "@/src/data/exerciseLibrary";

type ExercisePrescription = {
  exerciseId: string;
  sets?: number;
  reps?: number;
  restSeconds?: number;
  weight?: number | null;
  notes?: string;
  tempo?: string;
  targetRpe?: number;
};

type DayPrescription = {
  id: string;
  dayOffset: number;
  name: string;
  description: string;
  category: string;
  durationMinutes: number;
  time?: string;
  exercises: ExercisePrescription[];
};

type PlanPrescription = {
  id: string;
  title: string;
  subtitle: string;
  goal: WeeklyPlanGoal;
  goalLabel: string;
  description: string;
  level: FitnessLevel;
  equipment: WeeklyPlanEquipment;
  sessionsPerWeek: number;
  estimatedMinutesPerSession: number;
  tags: string[];
  coachAnalysis: string;
  safetyNotes: string[];
  progressionNotes: string[];
  days: DayPrescription[];
};

export type TemplateRecommendationReason = {
  label: string;
  score: number;
  reason: string;
};

export type TemplateRecommendation = {
  plan: WeeklyTrainingPlan;
  score: number;
  reasons: TemplateRecommendationReason[];
};

function fallbackExerciseName(exerciseId: string): string {
  return exerciseId
    .replace(/^lib_/, "")
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function buildExercise(input: ExercisePrescription, index: number): WeeklyPlanExercise {
  const libraryExercise = getExerciseById(input.exerciseId);
  const name = libraryExercise?.name ?? fallbackExerciseName(input.exerciseId);
  const animationFrames = libraryExercise
    ? getExerciseAnimationFrames(libraryExercise)
    : [];

  return {
    id: `${input.exerciseId}_${index + 1}`,
    exerciseId: input.exerciseId,
    name,
    nameRu: libraryExercise?.nameRu ?? null,
    nameKk: libraryExercise?.nameKk ?? null,
    sets: input.sets ?? libraryExercise?.defaultSets ?? 3,
    reps: input.reps ?? libraryExercise?.defaultReps ?? 10,
    restSeconds: input.restSeconds ?? libraryExercise?.defaultRestSeconds ?? 60,
    weight: input.weight ?? null,
    notes: input.notes ?? libraryExercise?.description ?? null,
    notesRu: libraryExercise?.descriptionRu ?? null,
    notesKk: libraryExercise?.descriptionKk ?? null,
    tempo: input.tempo ?? null,
    targetRpe: input.targetRpe ?? null,
    muscleGroup: libraryExercise?.muscleGroup ?? null,
    imageUrl: libraryExercise?.imageUrl ?? null,
    gifUrl: libraryExercise?.gifUrl ?? null,
    animationFrames,
  };
}

function buildPlan(input: PlanPrescription): WeeklyTrainingPlan {
  return {
    id: input.id,
    title: input.title,
    subtitle: input.subtitle,
    goal: input.goal,
    goalLabel: input.goalLabel,
    description: input.description,
    level: input.level,
    equipment: input.equipment,
    sessionsPerWeek: input.sessionsPerWeek,
    estimatedMinutesPerSession: input.estimatedMinutesPerSession,
    tags: input.tags,
    coachAnalysis: input.coachAnalysis,
    safetyNotes: input.safetyNotes,
    progressionNotes: input.progressionNotes,
    days: input.days.map((day) => ({
      id: day.id,
      dayOffset: day.dayOffset,
      name: day.name,
      description: day.description,
      category: day.category,
      durationMinutes: day.durationMinutes,
      time: day.time ?? "18:00",
      exercises: day.exercises.map(buildExercise),
    })),
  };
}

type PlanLocalization = {
  titleRu: string;
  titleKk: string;
  subtitleRu: string;
  subtitleKk: string;
  goalLabelRu: string;
  goalLabelKk: string;
  descriptionRu: string;
  descriptionKk: string;
  coachAnalysisRu: string;
  coachAnalysisKk: string;
  dayRu: string[];
  dayKk: string[];
  dayDescriptionRu: string[];
  dayDescriptionKk: string[];
};

const DEFAULT_SAFETY_RU = [
  "Перед тренировкой сделай 5–8 минут разминки и 1–2 лёгких подготовительных подхода.",
  "Если техника ломается или появляется боль, подход нужно остановить.",
  "Основные упражнения должны быть сложными, но не похожими на попытку на максимум.",
];

const DEFAULT_SAFETY_KK = [
  "Жаттығу алдында 5–8 минут қыздыру және 1–2 жеңіл дайындық сет жаса.",
  "Техника бұзылса немесе ауырсыну пайда болса, сет тоқтатылуы керек.",
  "Негізгі жаттығулар қиын болуы керек, бірақ максимумға ұқсамауы керек.",
];

const DEFAULT_PROGRESSION_RU = [
  "Когда все подходы выполнены чисто, сначала добавь 1–2 повтора, затем повышай вес.",
  "Каждую неделю отслеживай посещаемость, восстановление, сон и рабочие веса.",
  "После первой недели тренер должен скорректировать объём по технике, боли и усталости клиента.",
];

const DEFAULT_PROGRESSION_KK = [
  "Барлық сет таза орындалса, алдымен 1–2 қайталау қосып, содан кейін салмақты арттыр.",
  "Әр аптада қатысу, қалпына келу, ұйқы және жұмыс салмақтарын бақыла.",
  "Бірінші аптадан кейін жаттықтырушы техниканы, ауырсынуды және шаршауды қарап көлемді түзетуі керек.",
];

function applyPlanLocalization(plan: WeeklyTrainingPlan, loc: PlanLocalization) {
  plan.titleRu = loc.titleRu;
  plan.titleKk = loc.titleKk;
  plan.subtitleRu = loc.subtitleRu;
  plan.subtitleKk = loc.subtitleKk;
  plan.goalLabelRu = loc.goalLabelRu;
  plan.goalLabelKk = loc.goalLabelKk;
  plan.descriptionRu = loc.descriptionRu;
  plan.descriptionKk = loc.descriptionKk;
  plan.coachAnalysisRu = loc.coachAnalysisRu;
  plan.coachAnalysisKk = loc.coachAnalysisKk;
  plan.safetyNotesRu = DEFAULT_SAFETY_RU;
  plan.safetyNotesKk = DEFAULT_SAFETY_KK;
  plan.progressionNotesRu = DEFAULT_PROGRESSION_RU;
  plan.progressionNotesKk = DEFAULT_PROGRESSION_KK;

  plan.days.forEach((day, index) => {
    day.nameRu = loc.dayRu[index] ?? day.name;
    day.nameKk = loc.dayKk[index] ?? day.name;
    day.descriptionRu = loc.dayDescriptionRu[index] ?? day.description ?? null;
    day.descriptionKk = loc.dayDescriptionKk[index] ?? day.description ?? null;
  });
}

export const WORKOUT_TEMPLATES: WeeklyTrainingPlan[] = [
  buildPlan({
    id: "fat_loss_beginner_3x",
    title: "Fat Loss Foundation",
    subtitle: "3 sessions per week for safe fat loss",
    goal: "fat_loss",
    goalLabel: "Fat loss",
    description:
      "Balanced weekly plan for beginners who want to lose weight safely while keeping muscle. It combines full-body strength, moderate conditioning and mobility so the client burns calories without excessive joint stress.",
    level: "beginner",
    equipment: "gym",
    sessionsPerWeek: 3,
    estimatedMinutesPerSession: 55,
    tags: ["3x/week", "fat loss", "beginner", "full body", "low impact"],
    coachAnalysis:
      "This plan is ideal for clients who are new to structured training or returning after a break. The weekly volume is moderate, exercises are technically simple, and cardio is placed after strength work so the client can first learn proper movement patterns.",
    safetyNotes: [
      "Keep all sets at RPE 6–7 during the first week.",
      "Do not chase failure on squats, presses or rows.",
      "If the client has knee pain, replace jump squats with bike intervals.",
      "Use 5–8 minutes of light cardio before each session.",
    ],
    progressionNotes: [
      "When all sets feel easy, add 1–2 reps before increasing weight.",
      "Increase cardio duration by 3–5 minutes only if recovery is good.",
      "Track weight, waist and attendance weekly, not daily emotions.",
    ],
    days: [
      {
        id: "fat_loss_beginner_day_1",
        dayOffset: 0,
        name: "Day 1 · Full Body Strength",
        description:
          "Main learning session. Focus on clean technique, controlled tempo and stable breathing.",
        category: "Full body",
        durationMinutes: 55,
        exercises: [
          {
            exerciseId: "lib_legs_leg_press",
            sets: 3,
            reps: 12,
            restSeconds: 75,
            notes: "Controlled depth. Do not lock knees aggressively.",
            tempo: "3-1-1",
            targetRpe: 7,
          },
          {
            exerciseId: "lib_chest_dumbbell_bench_press",
            sets: 3,
            reps: 10,
            restSeconds: 75,
            notes: "Shoulder blades stable. Smooth range of motion.",
            tempo: "2-1-1",
            targetRpe: 7,
          },
          {
            exerciseId: "lib_back_seated_cable_rows",
            sets: 3,
            reps: 12,
            restSeconds: 60,
            notes: "Pull elbows back, pause shortly, avoid swinging.",
            tempo: "2-1-2",
            targetRpe: 7,
          },
          {
            exerciseId: "lib_glutes_butt_lift_bridge",
            sets: 3,
            reps: 15,
            restSeconds: 45,
            notes: "Squeeze glutes at the top for 1 second.",
            targetRpe: 7,
          },
          {
            exerciseId: "lib_abs_dead_bug",
            sets: 3,
            reps: 10,
            restSeconds: 30,
            notes: "Slow controlled reps. Keep lower back stable.",
            targetRpe: 6,
          },
          {
            exerciseId: "lib_cardio_bicycling_stationary",
            sets: 1,
            reps: 15,
            restSeconds: 0,
            notes: "Moderate pace. Client should still be able to speak.",
            targetRpe: 6,
          },
        ],
      },
      {
        id: "fat_loss_beginner_day_2",
        dayOffset: 2,
        name: "Day 2 · Upper Body + Cardio",
        description:
          "Upper-body strength with gentle cardio finish. Useful for calorie burn without overloading legs.",
        category: "Upper body",
        durationMinutes: 50,
        exercises: [
          {
            exerciseId: "lib_back_wide_grip_lat_pulldown",
            sets: 3,
            reps: 12,
            restSeconds: 60,
            notes: "Pull to upper chest, avoid using momentum.",
            targetRpe: 7,
          },
          {
            exerciseId: "lib_chest_pushups",
            sets: 3,
            reps: 10,
            restSeconds: 60,
            notes: "Use incline pushups if regular reps are too hard.",
            targetRpe: 7,
          },
          {
            exerciseId: "lib_shoulders_dumbbell_shoulder_press",
            sets: 3,
            reps: 10,
            restSeconds: 60,
            notes: "Keep ribs down. Do not overarch lower back.",
            targetRpe: 7,
          },
          {
            exerciseId: "lib_biceps_dumbbell_bicep_curl",
            sets: 2,
            reps: 12,
            restSeconds: 45,
            notes: "Strict control, no swinging.",
            targetRpe: 7,
          },
          {
            exerciseId: "lib_triceps_rope_pushdown",
            sets: 2,
            reps: 12,
            restSeconds: 45,
            notes: "Full elbow extension with controlled return.",
            targetRpe: 7,
          },
          {
            exerciseId: "lib_cardio_elliptical_trainer",
            sets: 1,
            reps: 18,
            restSeconds: 0,
            notes: "Low-impact steady cardio.",
            targetRpe: 6,
          },
        ],
      },
      {
        id: "fat_loss_beginner_day_3",
        dayOffset: 4,
        name: "Day 3 · Lower Body + Conditioning",
        description:
          "Lower body and conditioning day. The goal is consistent work, not exhaustion.",
        category: "Lower body",
        durationMinutes: 55,
        exercises: [
          {
            exerciseId: "lib_legs_bodyweight_squat",
            sets: 3,
            reps: 15,
            restSeconds: 45,
            notes: "Use this as movement preparation before loaded work.",
            targetRpe: 6,
          },
          {
            exerciseId: "lib_legs_dumbbell_lunges",
            sets: 3,
            reps: 10,
            restSeconds: 75,
            notes: "10 reps per leg. Keep knee tracking over toes.",
            targetRpe: 7,
          },
          {
            exerciseId: "lib_glutes_stiff_legged_dumbbell_deadlift",
            sets: 3,
            reps: 10,
            restSeconds: 75,
            notes: "Hip hinge, neutral spine, hamstring stretch.",
            tempo: "3-1-1",
            targetRpe: 7,
          },
          {
            exerciseId: "lib_legs_standing_calf_raises",
            sets: 3,
            reps: 15,
            restSeconds: 45,
            notes: "Full range, pause at the top.",
            targetRpe: 7,
          },
          {
            exerciseId: "lib_abs_crunches",
            sets: 3,
            reps: 18,
            restSeconds: 30,
            notes: "Exhale at the top.",
            targetRpe: 7,
          },
          {
            exerciseId: "lib_cardio_rope_jumping",
            sets: 5,
            reps: 45,
            restSeconds: 30,
            notes: "If jumping is uncomfortable, replace with bike intervals.",
            targetRpe: 7,
          },
        ],
      },
    ],
  }),

  buildPlan({
    id: "muscle_gain_intermediate_3x",
    title: "Lean Muscle Builder",
    subtitle: "Hypertrophy plan for consistent muscle gain",
    goal: "muscle_gain",
    goalLabel: "Muscle gain",
    description:
      "A 3-day hypertrophy split for intermediate clients. It balances heavy compound lifts, controlled accessory work and enough recovery to grow without overwhelming the client.",
    level: "intermediate",
    equipment: "gym",
    sessionsPerWeek: 3,
    estimatedMinutesPerSession: 65,
    tags: ["hypertrophy", "muscle gain", "intermediate", "gym"],
    coachAnalysis:
      "This plan is best for clients who already know basic technique and need structured progressive overload. Each session has one or two main lifts followed by accessories for balanced development.",
    safetyNotes: [
      "Warm up with lighter sets before the first compound lift.",
      "Stop 1–2 reps before technical failure on main lifts.",
      "If recovery drops, reduce one accessory set per exercise.",
    ],
    progressionNotes: [
      "Use double progression: first increase reps, then weight.",
      "When the client completes the top rep range on all sets, increase load by 2.5–5%.",
      "Keep notes for RPE and form quality after each session.",
    ],
    days: [
      {
        id: "muscle_gain_day_1",
        dayOffset: 0,
        name: "Day 1 · Push Hypertrophy",
        description:
          "Chest, shoulders and triceps with a moderate-heavy press focus.",
        category: "Push",
        durationMinutes: 65,
        exercises: [
          {
            exerciseId: "lib_chest_barbell_bench_press",
            sets: 4,
            reps: 8,
            restSeconds: 120,
            notes: "Main lift. Keep 1–2 reps in reserve.",
            tempo: "2-1-1",
            targetRpe: 8,
          },
          {
            exerciseId: "lib_chest_incline_dumbbell_press",
            sets: 3,
            reps: 10,
            restSeconds: 90,
            notes: "Deep controlled stretch, no bouncing.",
            targetRpe: 8,
          },
          {
            exerciseId: "lib_shoulders_dumbbell_shoulder_press",
            sets: 3,
            reps: 10,
            restSeconds: 75,
            notes: "Smooth reps, keep core tight.",
            targetRpe: 8,
          },
          {
            exerciseId: "lib_shoulders_side_lateral_raise",
            sets: 4,
            reps: 15,
            restSeconds: 45,
            notes: "Controlled isolation. Do not swing.",
            targetRpe: 8,
          },
          {
            exerciseId: "lib_triceps_rope_pushdown",
            sets: 3,
            reps: 12,
            restSeconds: 45,
            notes: "Spread rope at the bottom.",
            targetRpe: 8,
          },
        ],
      },
      {
        id: "muscle_gain_day_2",
        dayOffset: 2,
        name: "Day 2 · Pull Hypertrophy",
        description:
          "Back and biceps session focused on width, thickness and clean pulling mechanics.",
        category: "Pull",
        durationMinutes: 65,
        exercises: [
          {
            exerciseId: "lib_back_pullups",
            sets: 4,
            reps: 8,
            restSeconds: 120,
            notes: "Use assisted pullups if needed. Full control.",
            targetRpe: 8,
          },
          {
            exerciseId: "lib_back_bent_over_barbell_row",
            sets: 4,
            reps: 8,
            restSeconds: 120,
            notes: "Neutral spine. Pull toward lower ribs.",
            targetRpe: 8,
          },
          {
            exerciseId: "lib_back_seated_cable_rows",
            sets: 3,
            reps: 10,
            restSeconds: 75,
            notes: "Pause at contraction.",
            targetRpe: 8,
          },
          {
            exerciseId: "lib_shoulders_face_pull",
            sets: 3,
            reps: 15,
            restSeconds: 45,
            notes: "Rear delts and posture. Keep elbows high.",
            targetRpe: 7,
          },
          {
            exerciseId: "lib_biceps_barbell_curl",
            sets: 3,
            reps: 10,
            restSeconds: 60,
            notes: "Strict reps. Avoid hip swing.",
            targetRpe: 8,
          },
          {
            exerciseId: "lib_biceps_alternate_hammer_curl",
            sets: 2,
            reps: 12,
            restSeconds: 45,
            notes: "Control each arm separately.",
            targetRpe: 8,
          },
        ],
      },
      {
        id: "muscle_gain_day_3",
        dayOffset: 4,
        name: "Day 3 · Legs & Glutes",
        description:
          "Lower-body hypertrophy with squat pattern, hip hinge and glute focus.",
        category: "Legs",
        durationMinutes: 70,
        exercises: [
          {
            exerciseId: "lib_legs_barbell_squat",
            sets: 4,
            reps: 8,
            restSeconds: 150,
            notes: "Main lift. Keep consistent depth.",
            targetRpe: 8,
          },
          {
            exerciseId: "lib_legs_leg_press",
            sets: 3,
            reps: 12,
            restSeconds: 90,
            notes: "Controlled range. Do not lock knees hard.",
            targetRpe: 8,
          },
          {
            exerciseId: "lib_glutes_romanian_deadlift",
            sets: 4,
            reps: 8,
            restSeconds: 120,
            notes: "Hinge movement. Feel hamstrings and glutes.",
            tempo: "3-1-1",
            targetRpe: 8,
          },
          {
            exerciseId: "lib_glutes_barbell_hip_thrust",
            sets: 4,
            reps: 10,
            restSeconds: 90,
            notes: "Pause at top. Do not hyperextend lower back.",
            targetRpe: 8,
          },
          {
            exerciseId: "lib_legs_lying_leg_curls",
            sets: 3,
            reps: 12,
            restSeconds: 60,
            notes: "Controlled hamstring isolation.",
            targetRpe: 8,
          },
          {
            exerciseId: "lib_legs_standing_calf_raises",
            sets: 4,
            reps: 15,
            restSeconds: 45,
            notes: "Full stretch and full contraction.",
            targetRpe: 8,
          },
        ],
      },
    ],
  }),

  buildPlan({
    id: "strength_advanced_3x",
    title: "Advanced Strength Base",
    subtitle: "Strength-focused plan with controlled volume",
    goal: "strength",
    goalLabel: "Strength",
    description:
      "A 3-day strength plan for advanced clients who need heavy compound work, enough rest, and smart accessory training. The plan is intense but not random — each day has a clear performance focus.",
    level: "advanced",
    equipment: "gym",
    sessionsPerWeek: 3,
    estimatedMinutesPerSession: 75,
    tags: ["strength", "advanced", "compound lifts", "performance"],
    coachAnalysis:
      "This plan should be used only for clients with solid technique and recovery habits. It prioritizes squat, bench and deadlift strength while using accessories to protect joints and improve weak links.",
    safetyNotes: [
      "Do not use this plan for beginners.",
      "Main lifts must be done with full warm-up sets.",
      "If form breaks, reduce weight immediately.",
      "Avoid testing one-rep maxes during this week.",
    ],
    progressionNotes: [
      "Use RPE 7–8 on week one.",
      "Add 2.5 kg to upper-body lifts and 5 kg to lower-body lifts only when all sets are strong.",
      "Track sleep and soreness before increasing intensity.",
    ],
    days: [
      {
        id: "strength_day_1",
        dayOffset: 0,
        name: "Day 1 · Squat Strength",
        description:
          "Heavy lower-body session built around squat strength and posterior chain support.",
        category: "Strength",
        durationMinutes: 75,
        exercises: [
          {
            exerciseId: "lib_legs_barbell_squat",
            sets: 5,
            reps: 5,
            restSeconds: 180,
            notes: "Main strength lift. RPE 7–8. No grinders.",
            targetRpe: 8,
          },
          {
            exerciseId: "lib_legs_front_barbell_squat",
            sets: 3,
            reps: 5,
            restSeconds: 150,
            notes: "Technique and quad strength.",
            targetRpe: 7,
          },
          {
            exerciseId: "lib_glutes_romanian_deadlift",
            sets: 4,
            reps: 6,
            restSeconds: 150,
            notes: "Posterior chain accessory. Controlled eccentric.",
            tempo: "3-1-1",
            targetRpe: 8,
          },
          {
            exerciseId: "lib_legs_lying_leg_curls",
            sets: 3,
            reps: 10,
            restSeconds: 60,
            notes: "Hamstring protection and balance.",
            targetRpe: 8,
          },
          {
            exerciseId: "lib_abs_ab_roller",
            sets: 3,
            reps: 10,
            restSeconds: 60,
            notes: "Core anti-extension strength.",
            targetRpe: 7,
          },
        ],
      },
      {
        id: "strength_day_2",
        dayOffset: 2,
        name: "Day 2 · Bench & Upper Strength",
        description:
          "Upper-body strength with bench press as the main lift and back work for shoulder balance.",
        category: "Strength",
        durationMinutes: 70,
        exercises: [
          {
            exerciseId: "lib_chest_barbell_bench_press",
            sets: 5,
            reps: 5,
            restSeconds: 180,
            notes: "Main bench work. Stable setup and clean pauses.",
            targetRpe: 8,
          },
          {
            exerciseId: "lib_shoulders_barbell_shoulder_press",
            sets: 4,
            reps: 6,
            restSeconds: 150,
            notes: "Overhead strength. Keep ribs down.",
            targetRpe: 8,
          },
          {
            exerciseId: "lib_back_bent_over_barbell_row",
            sets: 4,
            reps: 6,
            restSeconds: 120,
            notes: "Heavy row for pressing balance.",
            targetRpe: 8,
          },
          {
            exerciseId: "lib_chest_close_grip_barbell_bench_press",
            sets: 3,
            reps: 8,
            restSeconds: 90,
            notes: "If this id is unavailable, use close-grip bench from triceps section.",
            targetRpe: 8,
          },
          {
            exerciseId: "lib_shoulders_face_pull",
            sets: 3,
            reps: 15,
            restSeconds: 45,
            notes: "Shoulder health and rear delts.",
            targetRpe: 7,
          },
        ],
      },
      {
        id: "strength_day_3",
        dayOffset: 4,
        name: "Day 3 · Deadlift Strength",
        description:
          "Posterior-chain strength session with deadlift focus and controlled accessory volume.",
        category: "Strength",
        durationMinutes: 75,
        exercises: [
          {
            exerciseId: "lib_back_deadlift",
            sets: 5,
            reps: 3,
            restSeconds: 210,
            notes: "Heavy but clean triples. Stop before form breakdown.",
            targetRpe: 8,
          },
          {
            exerciseId: "lib_back_t_bar_row",
            sets: 4,
            reps: 8,
            restSeconds: 120,
            notes: "Back thickness and deadlift support.",
            targetRpe: 8,
          },
          {
            exerciseId: "lib_glutes_barbell_hip_thrust",
            sets: 4,
            reps: 8,
            restSeconds: 120,
            notes: "Glute lockout strength.",
            targetRpe: 8,
          },
          {
            exerciseId: "lib_back_hyperextensions",
            sets: 3,
            reps: 12,
            restSeconds: 60,
            notes: "Controlled posterior chain work.",
            targetRpe: 7,
          },
          {
            exerciseId: "lib_abs_hanging_leg_raise",
            sets: 3,
            reps: 12,
            restSeconds: 60,
            notes: "Core control.",
            targetRpe: 7,
          },
        ],
      },
    ],
  }),

  buildPlan({
    id: "home_bodyweight_3x",
    title: "Home Bodyweight Reset",
    subtitle: "No gym needed, 3 sessions per week",
    goal: "home_training",
    goalLabel: "Home training",
    description:
      "A simple but effective home plan for clients who train without machines. It improves consistency, endurance, mobility and basic strength using bodyweight movements.",
    level: "beginner",
    equipment: "bodyweight",
    sessionsPerWeek: 3,
    estimatedMinutesPerSession: 40,
    tags: ["home", "bodyweight", "beginner", "no equipment"],
    coachAnalysis:
      "This plan is useful when the client cannot visit the gym but still needs structure. It is not random home cardio — it includes squat, push, pull/core, glute and mobility patterns.",
    safetyNotes: [
      "Use slow tempo to make bodyweight work effective.",
      "Avoid jumping movements if the client has knee or ankle pain.",
      "Keep rest short but never sacrifice technique.",
    ],
    progressionNotes: [
      "Add reps before adding intensity.",
      "Move from incline pushups to floor pushups when ready.",
      "Add one extra round only after the client completes all reps with good form.",
    ],
    days: [
      {
        id: "home_day_1",
        dayOffset: 0,
        name: "Day 1 · Bodyweight Full Body",
        description:
          "Simple full-body home session with controlled movement and short rest.",
        category: "Home",
        durationMinutes: 40,
        exercises: [
          {
            exerciseId: "lib_legs_bodyweight_squat",
            sets: 4,
            reps: 15,
            restSeconds: 45,
            notes: "Controlled depth. Keep chest tall.",
            targetRpe: 7,
          },
          {
            exerciseId: "lib_chest_pushups",
            sets: 4,
            reps: 10,
            restSeconds: 60,
            notes: "Use incline pushups if needed.",
            targetRpe: 7,
          },
          {
            exerciseId: "lib_glutes_butt_lift_bridge",
            sets: 4,
            reps: 15,
            restSeconds: 45,
            notes: "Pause and squeeze at the top.",
            targetRpe: 7,
          },
          {
            exerciseId: "lib_abs_dead_bug",
            sets: 3,
            reps: 10,
            restSeconds: 30,
            notes: "Slow and controlled.",
            targetRpe: 6,
          },
          {
            exerciseId: "lib_stretching_cat_stretch",
            sets: 2,
            reps: 10,
            restSeconds: 15,
            notes: "Use as cooldown mobility.",
            targetRpe: 4,
          },
        ],
      },
      {
        id: "home_day_2",
        dayOffset: 2,
        name: "Day 2 · Conditioning & Core",
        description:
          "Cardio/core session for energy, calorie burn and coordination.",
        category: "Conditioning",
        durationMinutes: 38,
        exercises: [
          {
            exerciseId: "lib_cardio_mountain_climbers",
            sets: 5,
            reps: 30,
            restSeconds: 30,
            notes: "Seconds per round. Keep hips stable.",
            targetRpe: 7,
          },
          {
            exerciseId: "lib_legs_freehand_jump_squat",
            sets: 4,
            reps: 10,
            restSeconds: 45,
            notes: "Replace with normal squats if jumping hurts.",
            targetRpe: 7,
          },
          {
            exerciseId: "lib_abs_air_bike",
            sets: 4,
            reps: 20,
            restSeconds: 30,
            notes: "Controlled rotation, do not pull neck.",
            targetRpe: 7,
          },
          {
            exerciseId: "lib_abs_alternate_heel_touchers",
            sets: 3,
            reps: 20,
            restSeconds: 30,
            notes: "Side core control.",
            targetRpe: 7,
          },
          {
            exerciseId: "lib_stretching_childs_pose",
            sets: 2,
            reps: 60,
            restSeconds: 15,
            notes: "Cooldown and breathing.",
            targetRpe: 3,
          },
        ],
      },
      {
        id: "home_day_3",
        dayOffset: 4,
        name: "Day 3 · Legs, Glutes & Mobility",
        description:
          "Home lower-body and mobility day with glute activation and hip control.",
        category: "Home lower body",
        durationMinutes: 42,
        exercises: [
          {
            exerciseId: "lib_glutes_bodyweight_walking_lunge",
            sets: 4,
            reps: 12,
            restSeconds: 60,
            notes: "12 reps per leg if space allows.",
            targetRpe: 7,
          },
          {
            exerciseId: "lib_glutes_butt_lift_bridge",
            sets: 4,
            reps: 20,
            restSeconds: 45,
            notes: "Focus on glutes, not lower back.",
            targetRpe: 8,
          },
          {
            exerciseId: "lib_legs_bodyweight_squat",
            sets: 3,
            reps: 20,
            restSeconds: 45,
            notes: "Smooth high-rep work.",
            targetRpe: 7,
          },
          {
            exerciseId: "lib_stretching_kneeling_hip_flexor",
            sets: 2,
            reps: 45,
            restSeconds: 15,
            notes: "Seconds per side.",
            targetRpe: 3,
          },
          {
            exerciseId: "lib_stretching_standing_hamstring_calf",
            sets: 2,
            reps: 45,
            restSeconds: 15,
            notes: "Posterior chain cooldown.",
            targetRpe: 3,
          },
        ],
      },
    ],
  }),

  buildPlan({
    id: "glutes_legs_intermediate_3x",
    title: "Glutes & Legs Focus",
    subtitle: "Lower-body shape and strength",
    goal: "glutes_legs",
    goalLabel: "Glutes & legs",
    description:
      "A focused 3-day plan for clients who want stronger legs and more developed glutes. It includes hip thrust, hinge, squat/lunge patterns and smart accessory work.",
    level: "intermediate",
    equipment: "gym",
    sessionsPerWeek: 3,
    estimatedMinutesPerSession: 60,
    tags: ["glutes", "legs", "shape", "hypertrophy"],
    coachAnalysis:
      "This is a strong plan for clients whose priority is lower-body development. Volume is high enough to stimulate glutes and legs but split across the week so recovery stays realistic.",
    safetyNotes: [
      "Prioritize hip and knee alignment.",
      "Do not overload hip thrust if the client feels lower back pressure.",
      "Keep at least one rest day between lower-body sessions.",
    ],
    progressionNotes: [
      "Progress hip thrusts and Romanian deadlifts slowly.",
      "Increase reps first on lunges and isolation movements.",
      "Use photos, measurements and strength logs, not scale weight only.",
    ],
    days: [
      {
        id: "glutes_legs_day_1",
        dayOffset: 0,
        name: "Day 1 · Glute Strength",
        description:
          "Main glute strength day with hip thrust and hinge pattern.",
        category: "Glutes",
        durationMinutes: 60,
        exercises: [
          {
            exerciseId: "lib_glutes_barbell_hip_thrust",
            sets: 5,
            reps: 8,
            restSeconds: 120,
            notes: "Main lift. Pause at top for 1 second.",
            targetRpe: 8,
          },
          {
            exerciseId: "lib_glutes_romanian_deadlift",
            sets: 4,
            reps: 8,
            restSeconds: 120,
            notes: "Feel hamstrings and glutes. Control the lowering.",
            tempo: "3-1-1",
            targetRpe: 8,
          },
          {
            exerciseId: "lib_glutes_step_up_with_knee_raise",
            sets: 3,
            reps: 10,
            restSeconds: 75,
            notes: "10 reps per leg. Push through full foot.",
            targetRpe: 7,
          },
          {
            exerciseId: "lib_glutes_glute_kickback",
            sets: 3,
            reps: 15,
            restSeconds: 45,
            notes: "Slow isolation, no lower-back swing.",
            targetRpe: 8,
          },
          {
            exerciseId: "lib_abs_dead_bug",
            sets: 3,
            reps: 10,
            restSeconds: 30,
            notes: "Core stability for hip control.",
            targetRpe: 6,
          },
        ],
      },
      {
        id: "glutes_legs_day_2",
        dayOffset: 2,
        name: "Day 2 · Quads & Shape",
        description:
          "Quad-dominant session with controlled knee mechanics and accessory work.",
        category: "Legs",
        durationMinutes: 60,
        exercises: [
          {
            exerciseId: "lib_legs_front_barbell_squat",
            sets: 4,
            reps: 6,
            restSeconds: 150,
            notes: "Upright posture, controlled depth.",
            targetRpe: 8,
          },
          {
            exerciseId: "lib_legs_leg_press",
            sets: 4,
            reps: 12,
            restSeconds: 90,
            notes: "Quad focus. Do not bounce at bottom.",
            targetRpe: 8,
          },
          {
            exerciseId: "lib_legs_leg_extensions",
            sets: 3,
            reps: 15,
            restSeconds: 45,
            notes: "Pause at top. Slow return.",
            targetRpe: 8,
          },
          {
            exerciseId: "lib_legs_dumbbell_lunges",
            sets: 3,
            reps: 10,
            restSeconds: 75,
            notes: "10 reps per leg.",
            targetRpe: 7,
          },
          {
            exerciseId: "lib_legs_seated_calf_raise",
            sets: 4,
            reps: 15,
            restSeconds: 45,
            notes: "Full stretch and full squeeze.",
            targetRpe: 8,
          },
        ],
      },
      {
        id: "glutes_legs_day_3",
        dayOffset: 4,
        name: "Day 3 · Glute Pump & Mobility",
        description:
          "Higher-rep glute session with mobility to improve recovery and shape.",
        category: "Glutes",
        durationMinutes: 55,
        exercises: [
          {
            exerciseId: "lib_glutes_stiff_legged_dumbbell_deadlift",
            sets: 3,
            reps: 12,
            restSeconds: 75,
            notes: "Dumbbell hinge with hamstring stretch.",
            targetRpe: 8,
          },
          {
            exerciseId: "lib_glutes_plie_dumbbell_squat",
            sets: 4,
            reps: 12,
            restSeconds: 75,
            notes: "Wide stance, controlled knees.",
            targetRpe: 8,
          },
          {
            exerciseId: "lib_glutes_bodyweight_walking_lunge",
            sets: 3,
            reps: 14,
            restSeconds: 60,
            notes: "Smooth walking lunges.",
            targetRpe: 7,
          },
          {
            exerciseId: "lib_glutes_glute_kickback",
            sets: 4,
            reps: 15,
            restSeconds: 45,
            notes: "Pump work. Full glute squeeze.",
            targetRpe: 8,
          },
          {
            exerciseId: "lib_stretching_kneeling_hip_flexor",
            sets: 2,
            reps: 45,
            restSeconds: 15,
            notes: "Hip flexor cooldown.",
            targetRpe: 3,
          },
          {
            exerciseId: "lib_stretching_adductor_groin",
            sets: 2,
            reps: 45,
            restSeconds: 15,
            notes: "Adductor and hip mobility.",
            targetRpe: 3,
          },
        ],
      },
    ],
  }),

  buildPlan({
    id: "mobility_recovery_3x",
    title: "Mobility & Recovery Base",
    subtitle: "For posture, movement quality and recovery",
    goal: "mobility",
    goalLabel: "Mobility",
    description:
      "A low-impact plan for clients who need better mobility, posture, joint control and recovery. It can be used after stressful weeks or alongside fat-loss work.",
    level: "beginner",
    equipment: "bodyweight",
    sessionsPerWeek: 3,
    estimatedMinutesPerSession: 35,
    tags: ["mobility", "recovery", "posture", "low impact"],
    coachAnalysis:
      "This plan is useful for clients with low recovery, poor mobility or high stress. It keeps them active without adding heavy fatigue, while improving movement quality.",
    safetyNotes: [
      "No stretch should create sharp pain.",
      "Breathe slowly during recovery poses.",
      "Use small ranges first and increase gradually.",
    ],
    progressionNotes: [
      "Increase time under stretch only when the client feels better after sessions.",
      "Use this plan for deload weeks or as a restart week.",
      "Track pain level, sleep and energy.",
    ],
    days: [
      {
        id: "mobility_day_1",
        dayOffset: 0,
        name: "Day 1 · Spine & Hips",
        description:
          "Gentle mobility for spine, hips and posterior chain.",
        category: "Mobility",
        durationMinutes: 35,
        exercises: [
          {
            exerciseId: "lib_stretching_cat_stretch",
            sets: 3,
            reps: 10,
            restSeconds: 15,
            notes: "Slow breathing with each rep.",
            targetRpe: 3,
          },
          {
            exerciseId: "lib_stretching_childs_pose",
            sets: 3,
            reps: 60,
            restSeconds: 15,
            notes: "Relax shoulders and breathe deeply.",
            targetRpe: 2,
          },
          {
            exerciseId: "lib_stretching_kneeling_hip_flexor",
            sets: 3,
            reps: 45,
            restSeconds: 15,
            notes: "Seconds per side.",
            targetRpe: 3,
          },
          {
            exerciseId: "lib_stretching_90_90_hamstring",
            sets: 3,
            reps: 10,
            restSeconds: 15,
            notes: "Controlled hamstring mobility.",
            targetRpe: 3,
          },
          {
            exerciseId: "lib_abs_dead_bug",
            sets: 3,
            reps: 10,
            restSeconds: 30,
            notes: "Core stability after mobility.",
            targetRpe: 5,
          },
        ],
      },
      {
        id: "mobility_day_2",
        dayOffset: 2,
        name: "Day 2 · Shoulders & Posture",
        description:
          "Upper-body mobility and posture work for shoulders and chest.",
        category: "Mobility",
        durationMinutes: 35,
        exercises: [
          {
            exerciseId: "lib_shoulders_arm_circles",
            sets: 3,
            reps: 20,
            restSeconds: 15,
            notes: "Warm up shoulders gently.",
            targetRpe: 3,
          },
          {
            exerciseId: "lib_stretching_round_world_shoulder",
            sets: 3,
            reps: 10,
            restSeconds: 15,
            notes: "Controlled shoulder range.",
            targetRpe: 3,
          },
          {
            exerciseId: "lib_shoulders_face_pull",
            sets: 3,
            reps: 15,
            restSeconds: 45,
            notes: "Light load only. Posture focus.",
            targetRpe: 6,
          },
          {
            exerciseId: "lib_back_bodyweight_mid_row",
            sets: 3,
            reps: 10,
            restSeconds: 60,
            notes: "Scapular control and upper back.",
            targetRpe: 6,
          },
          {
            exerciseId: "lib_stretching_childs_pose",
            sets: 2,
            reps: 60,
            restSeconds: 15,
            notes: "Cooldown breathing.",
            targetRpe: 2,
          },
        ],
      },
      {
        id: "mobility_day_3",
        dayOffset: 4,
        name: "Day 3 · Ankles, Hips & Core",
        description:
          "Lower-body mobility with light strength to keep joints active.",
        category: "Mobility",
        durationMinutes: 35,
        exercises: [
          {
            exerciseId: "lib_stretching_ankle_circles",
            sets: 3,
            reps: 15,
            restSeconds: 15,
            notes: "Both directions, both ankles.",
            targetRpe: 2,
          },
          {
            exerciseId: "lib_stretching_adductor",
            sets: 3,
            reps: 45,
            restSeconds: 15,
            notes: "Gentle inner-thigh stretch.",
            targetRpe: 3,
          },
          {
            exerciseId: "lib_glutes_butt_lift_bridge",
            sets: 3,
            reps: 15,
            restSeconds: 45,
            notes: "Glute activation, not fatigue.",
            targetRpe: 5,
          },
          {
            exerciseId: "lib_legs_bodyweight_squat",
            sets: 3,
            reps: 12,
            restSeconds: 45,
            notes: "Use as controlled mobility squat.",
            targetRpe: 5,
          },
          {
            exerciseId: "lib_abs_crunches",
            sets: 2,
            reps: 15,
            restSeconds: 30,
            notes: "Light core finish.",
            targetRpe: 5,
          },
        ],
      },
    ],
  }),

  buildPlan({
    id: "busy_45min_3x",
    title: "Busy Client 45-Min Plan",
    subtitle: "Efficient sessions for clients with limited time",
    goal: "general_fitness",
    goalLabel: "General fitness",
    description:
      "A compact plan for busy clients who can train only 45 minutes. Each session includes the biggest return-on-time movements and avoids unnecessary complexity.",
    level: "intermediate",
    equipment: "gym",
    sessionsPerWeek: 3,
    estimatedMinutesPerSession: 45,
    tags: ["45 minutes", "busy client", "efficient", "full body"],
    coachAnalysis:
      "This plan is useful when the main problem is time and consistency. It uses fewer exercises but keeps quality high: compound movements, short accessories and simple progression.",
    safetyNotes: [
      "Use short but complete warm-ups.",
      "Do not rush heavy sets.",
      "Keep rest times honest to finish within 45 minutes.",
    ],
    progressionNotes: [
      "Add weight only when all sets are completed cleanly within the time limit.",
      "If the session takes too long, remove one accessory set, not the main lift.",
      "Track attendance as the main KPI for this type of client.",
    ],
    days: [
      {
        id: "busy_day_1",
        dayOffset: 0,
        name: "Day 1 · Efficient Full Body A",
        description:
          "Squat, press, row and core. Minimal but effective.",
        category: "Full body",
        durationMinutes: 45,
        exercises: [
          {
            exerciseId: "lib_legs_barbell_squat",
            sets: 3,
            reps: 6,
            restSeconds: 120,
            notes: "Main lift. Quality over speed.",
            targetRpe: 8,
          },
          {
            exerciseId: "lib_chest_dumbbell_bench_press",
            sets: 3,
            reps: 10,
            restSeconds: 75,
            notes: "Controlled press.",
            targetRpe: 8,
          },
          {
            exerciseId: "lib_back_seated_cable_rows",
            sets: 3,
            reps: 10,
            restSeconds: 75,
            notes: "Strong posture and pause.",
            targetRpe: 8,
          },
          {
            exerciseId: "lib_abs_dead_bug",
            sets: 3,
            reps: 10,
            restSeconds: 30,
            notes: "Core stability finish.",
            targetRpe: 6,
          },
        ],
      },
      {
        id: "busy_day_2",
        dayOffset: 2,
        name: "Day 2 · Efficient Full Body B",
        description:
          "Hinge, vertical pull, shoulder press and conditioning.",
        category: "Full body",
        durationMinutes: 45,
        exercises: [
          {
            exerciseId: "lib_glutes_romanian_deadlift",
            sets: 3,
            reps: 8,
            restSeconds: 120,
            notes: "Hinge quality. Do not rush.",
            targetRpe: 8,
          },
          {
            exerciseId: "lib_back_wide_grip_lat_pulldown",
            sets: 3,
            reps: 10,
            restSeconds: 75,
            notes: "Vertical pull focus.",
            targetRpe: 8,
          },
          {
            exerciseId: "lib_shoulders_dumbbell_shoulder_press",
            sets: 3,
            reps: 10,
            restSeconds: 75,
            notes: "Controlled overhead press.",
            targetRpe: 8,
          },
          {
            exerciseId: "lib_cardio_bicycling_stationary",
            sets: 1,
            reps: 12,
            restSeconds: 0,
            notes: "Moderate finish, not all-out.",
            targetRpe: 7,
          },
        ],
      },
      {
        id: "busy_day_3",
        dayOffset: 4,
        name: "Day 3 · Efficient Full Body C",
        description:
          "Leg press, pushups, rows and glute work for a quick complete session.",
        category: "Full body",
        durationMinutes: 45,
        exercises: [
          {
            exerciseId: "lib_legs_leg_press",
            sets: 3,
            reps: 12,
            restSeconds: 90,
            notes: "Stable lower body work.",
            targetRpe: 8,
          },
          {
            exerciseId: "lib_chest_pushups",
            sets: 3,
            reps: 12,
            restSeconds: 60,
            notes: "Use incline if needed.",
            targetRpe: 8,
          },
          {
            exerciseId: "lib_back_one_arm_dumbbell_row",
            sets: 3,
            reps: 10,
            restSeconds: 75,
            notes: "10 reps per side.",
            targetRpe: 8,
          },
          {
            exerciseId: "lib_glutes_barbell_hip_thrust",
            sets: 3,
            reps: 10,
            restSeconds: 90,
            notes: "Glute strength, pause at top.",
            targetRpe: 8,
          },
        ],
      },
    ],
  }),
];


const EXTRA_WORKOUT_TEMPLATES: WeeklyTrainingPlan[] = [
  buildPlan({
    id: "fat_loss_intermediate_3x",
    title: "Fat Loss Accelerator",
    subtitle: "Stronger fat-loss plan for trained clients",
    goal: "fat_loss",
    goalLabel: "Fat loss",
    description: "Intermediate plan that combines strength, supersets and conditioning to improve body composition.",
    level: "intermediate",
    equipment: "gym",
    sessionsPerWeek: 3,
    estimatedMinutesPerSession: 60,
    tags: ["fat loss", "intermediate", "conditioning"],
    coachAnalysis: "Use this when the client already trains consistently and needs more training density without losing strength.",
    safetyNotes: ["Keep conditioning hard but technically clean.", "Replace jumping drills if knees are sensitive."],
    progressionNotes: ["Increase density before increasing load.", "If adherence drops, reduce conditioning first."],
    days: [
      { id: "fat_loss_intermediate_day_1", dayOffset: 0, name: "Day 1 · Strength Density", description: "Compound lifts with moderate rest.", category: "Full body", durationMinutes: 60, exercises: [
        { exerciseId: "lib_legs_barbell_squat", sets: 4, reps: 8, restSeconds: 120, targetRpe: 8 },
        { exerciseId: "lib_chest_barbell_bench_press", sets: 4, reps: 8, restSeconds: 90, targetRpe: 8 },
        { exerciseId: "lib_back_seated_cable_rows", sets: 4, reps: 10, restSeconds: 75, targetRpe: 8 },
        { exerciseId: "lib_glutes_romanian_deadlift", sets: 3, reps: 10, restSeconds: 90, targetRpe: 8 },
        { exerciseId: "lib_cardio_rowing_stationary", sets: 1, reps: 12, restSeconds: 0, targetRpe: 7 },
      ] },
      { id: "fat_loss_intermediate_day_2", dayOffset: 2, name: "Day 2 · Upper + Intervals", description: "Upper body with short cardio intervals.", category: "Upper body", durationMinutes: 58, exercises: [
        { exerciseId: "lib_back_pullups", sets: 4, reps: 8, restSeconds: 90, targetRpe: 8 },
        { exerciseId: "lib_chest_incline_dumbbell_press", sets: 3, reps: 10, restSeconds: 75, targetRpe: 8 },
        { exerciseId: "lib_shoulders_side_lateral_raise", sets: 4, reps: 15, restSeconds: 45, targetRpe: 8 },
        { exerciseId: "lib_shoulders_face_pull", sets: 3, reps: 15, restSeconds: 45, targetRpe: 7 },
        { exerciseId: "lib_cardio_mountain_climbers", sets: 6, reps: 30, restSeconds: 30, targetRpe: 8 },
      ] },
      { id: "fat_loss_intermediate_day_3", dayOffset: 4, name: "Day 3 · Legs + Metabolic Finish", description: "Lower body with a calorie-burning finish.", category: "Lower body", durationMinutes: 62, exercises: [
        { exerciseId: "lib_legs_leg_press", sets: 4, reps: 12, restSeconds: 90, targetRpe: 8 },
        { exerciseId: "lib_legs_lying_leg_curls", sets: 3, reps: 12, restSeconds: 60, targetRpe: 8 },
        { exerciseId: "lib_glutes_barbell_hip_thrust", sets: 4, reps: 10, restSeconds: 90, targetRpe: 8 },
        { exerciseId: "lib_legs_dumbbell_lunges", sets: 3, reps: 12, restSeconds: 75, targetRpe: 8 },
        { exerciseId: "lib_cardio_bicycling_stationary", sets: 1, reps: 15, restSeconds: 0, targetRpe: 7 },
      ] },
    ],
  }),
  buildPlan({
    id: "muscle_gain_beginner_3x",
    title: "Beginner Muscle Builder",
    subtitle: "Simple hypertrophy plan for the first months",
    goal: "muscle_gain",
    goalLabel: "Muscle gain",
    description: "Beginner-friendly muscle gain plan with machines, dumbbells and controlled volume.",
    level: "beginner",
    equipment: "gym",
    sessionsPerWeek: 3,
    estimatedMinutesPerSession: 55,
    tags: ["muscle gain", "beginner", "machines"],
    coachAnalysis: "The plan teaches basic movement patterns and keeps recovery realistic.",
    safetyNotes: ["Use conservative weights while learning technique.", "Avoid training to failure in the first weeks."],
    progressionNotes: ["The first goal is clean form and attendance.", "Add reps before load."],
    days: [
      { id: "muscle_beginner_day_1", dayOffset: 0, name: "Day 1 · Full Body A", description: "First full-body hypertrophy session.", category: "Full body", durationMinutes: 55, exercises: [
        { exerciseId: "lib_legs_leg_press", sets: 3, reps: 10, restSeconds: 90, targetRpe: 7 },
        { exerciseId: "lib_chest_dumbbell_bench_press", sets: 3, reps: 10, restSeconds: 75, targetRpe: 7 },
        { exerciseId: "lib_back_wide_grip_lat_pulldown", sets: 3, reps: 10, restSeconds: 75, targetRpe: 7 },
        { exerciseId: "lib_shoulders_dumbbell_shoulder_press", sets: 2, reps: 10, restSeconds: 60, targetRpe: 7 },
        { exerciseId: "lib_abs_crunches", sets: 3, reps: 15, restSeconds: 30, targetRpe: 6 },
      ] },
      { id: "muscle_beginner_day_2", dayOffset: 2, name: "Day 2 · Full Body B", description: "Glute and back focus.", category: "Full body", durationMinutes: 55, exercises: [
        { exerciseId: "lib_glutes_barbell_hip_thrust", sets: 3, reps: 10, restSeconds: 90, targetRpe: 7 },
        { exerciseId: "lib_back_seated_cable_rows", sets: 3, reps: 12, restSeconds: 75, targetRpe: 7 },
        { exerciseId: "lib_chest_incline_dumbbell_press", sets: 3, reps: 10, restSeconds: 75, targetRpe: 7 },
        { exerciseId: "lib_legs_lying_leg_curls", sets: 3, reps: 12, restSeconds: 60, targetRpe: 7 },
        { exerciseId: "lib_biceps_dumbbell_bicep_curl", sets: 2, reps: 12, restSeconds: 45, targetRpe: 7 },
      ] },
      { id: "muscle_beginner_day_3", dayOffset: 4, name: "Day 3 · Full Body C", description: "Balanced session to repeat key patterns.", category: "Full body", durationMinutes: 55, exercises: [
        { exerciseId: "lib_legs_bodyweight_squat", sets: 3, reps: 15, restSeconds: 45, targetRpe: 6 },
        { exerciseId: "lib_chest_pushups", sets: 3, reps: 10, restSeconds: 60, targetRpe: 7 },
        { exerciseId: "lib_back_one_arm_dumbbell_row", sets: 3, reps: 10, restSeconds: 75, targetRpe: 7 },
        { exerciseId: "lib_shoulders_side_lateral_raise", sets: 3, reps: 15, restSeconds: 45, targetRpe: 7 },
        { exerciseId: "lib_triceps_rope_pushdown", sets: 2, reps: 12, restSeconds: 45, targetRpe: 7 },
      ] },
    ],
  }),
  buildPlan({
    id: "dumbbell_home_3x",
    title: "Dumbbell Home Strength",
    subtitle: "For clients with dumbbells at home",
    goal: "dumbbell_home",
    goalLabel: "Dumbbell home",
    description: "Home plan using dumbbells for strength, tone and consistency.",
    level: "intermediate",
    equipment: "dumbbells",
    sessionsPerWeek: 3,
    estimatedMinutesPerSession: 45,
    tags: ["home", "dumbbells", "strength"],
    coachAnalysis: "Good for clients who train at home but need more resistance than bodyweight.",
    safetyNotes: ["Keep core tight during standing dumbbell movements.", "Use controlled tempo."],
    progressionNotes: ["Add reps first, then use heavier dumbbells.", "If dumbbells are light, slow the eccentric phase."],
    days: [
      { id: "dumbbell_home_day_1", dayOffset: 0, name: "Day 1 · Dumbbell Full Body A", description: "Balanced dumbbell strength session.", category: "Dumbbells", durationMinutes: 45, exercises: [
        { exerciseId: "lib_legs_dumbbell_lunges", sets: 3, reps: 10, restSeconds: 75, targetRpe: 8 },
        { exerciseId: "lib_chest_dumbbell_bench_press", sets: 3, reps: 10, restSeconds: 75, targetRpe: 8 },
        { exerciseId: "lib_back_one_arm_dumbbell_row", sets: 3, reps: 10, restSeconds: 75, targetRpe: 8 },
        { exerciseId: "lib_shoulders_dumbbell_shoulder_press", sets: 3, reps: 10, restSeconds: 60, targetRpe: 8 },
        { exerciseId: "lib_abs_crunches", sets: 3, reps: 15, restSeconds: 30, targetRpe: 7 },
      ] },
      { id: "dumbbell_home_day_2", dayOffset: 2, name: "Day 2 · Dumbbell Legs & Glutes", description: "Lower body using simple dumbbell movements.", category: "Lower body", durationMinutes: 45, exercises: [
        { exerciseId: "lib_glutes_stiff_legged_dumbbell_deadlift", sets: 4, reps: 10, restSeconds: 75, targetRpe: 8 },
        { exerciseId: "lib_glutes_plie_dumbbell_squat", sets: 4, reps: 12, restSeconds: 75, targetRpe: 8 },
        { exerciseId: "lib_glutes_step_up_with_knee_raise", sets: 3, reps: 10, restSeconds: 60, targetRpe: 7 },
        { exerciseId: "lib_legs_standing_calf_raises", sets: 3, reps: 15, restSeconds: 45, targetRpe: 7 },
        { exerciseId: "lib_stretching_kneeling_hip_flexor", sets: 2, reps: 45, restSeconds: 15, targetRpe: 3 },
      ] },
      { id: "dumbbell_home_day_3", dayOffset: 4, name: "Day 3 · Dumbbell Upper & Core", description: "Upper-body and core session.", category: "Upper body", durationMinutes: 45, exercises: [
        { exerciseId: "lib_chest_incline_dumbbell_press", sets: 3, reps: 10, restSeconds: 75, targetRpe: 8 },
        { exerciseId: "lib_back_one_arm_dumbbell_row", sets: 3, reps: 10, restSeconds: 75, targetRpe: 8 },
        { exerciseId: "lib_shoulders_side_lateral_raise", sets: 3, reps: 15, restSeconds: 45, targetRpe: 8 },
        { exerciseId: "lib_biceps_dumbbell_bicep_curl", sets: 3, reps: 12, restSeconds: 45, targetRpe: 8 },
        { exerciseId: "lib_abs_dead_bug", sets: 3, reps: 10, restSeconds: 30, targetRpe: 6 },
      ] },
    ],
  }),
  buildPlan({
    id: "beginner_gym_start_3x",
    title: "Beginner Gym Start",
    subtitle: "First confident week in the gym",
    goal: "beginner_gym",
    goalLabel: "Beginner gym",
    description: "Very simple first gym week to teach machines, tempo and routine.",
    level: "beginner",
    equipment: "gym",
    sessionsPerWeek: 3,
    estimatedMinutesPerSession: 45,
    tags: ["beginner", "gym start", "safe"],
    coachAnalysis: "Best when the client is nervous or completely new to the gym.",
    safetyNotes: ["Use light weights and teach setup first.", "The first week is about confidence."],
    progressionNotes: ["Do not rush progression.", "First build the habit."],
    days: [
      { id: "beginner_gym_day_1", dayOffset: 0, name: "Day 1 · Machine Basics", description: "Learn basic machines and comfortable movement.", category: "Beginner", durationMinutes: 45, exercises: [
        { exerciseId: "lib_legs_leg_press", sets: 2, reps: 12, restSeconds: 75, targetRpe: 6 },
        { exerciseId: "lib_chest_butterfly_machine", sets: 2, reps: 12, restSeconds: 60, targetRpe: 6 },
        { exerciseId: "lib_back_wide_grip_lat_pulldown", sets: 2, reps: 12, restSeconds: 60, targetRpe: 6 },
        { exerciseId: "lib_legs_leg_extensions", sets: 2, reps: 12, restSeconds: 45, targetRpe: 6 },
        { exerciseId: "lib_cardio_elliptical_trainer", sets: 1, reps: 10, restSeconds: 0, targetRpe: 5 },
      ] },
      { id: "beginner_gym_day_2", dayOffset: 2, name: "Day 2 · Dumbbell Control", description: "Light dumbbell technique and core.", category: "Beginner", durationMinutes: 45, exercises: [
        { exerciseId: "lib_chest_dumbbell_bench_press", sets: 2, reps: 10, restSeconds: 75, targetRpe: 6 },
        { exerciseId: "lib_back_one_arm_dumbbell_row", sets: 2, reps: 10, restSeconds: 75, targetRpe: 6 },
        { exerciseId: "lib_shoulders_dumbbell_shoulder_press", sets: 2, reps: 10, restSeconds: 60, targetRpe: 6 },
        { exerciseId: "lib_glutes_butt_lift_bridge", sets: 2, reps: 15, restSeconds: 45, targetRpe: 6 },
        { exerciseId: "lib_abs_dead_bug", sets: 2, reps: 10, restSeconds: 30, targetRpe: 5 },
      ] },
      { id: "beginner_gym_day_3", dayOffset: 4, name: "Day 3 · Routine Building", description: "Simple repeatable full-body session.", category: "Beginner", durationMinutes: 45, exercises: [
        { exerciseId: "lib_legs_bodyweight_squat", sets: 2, reps: 12, restSeconds: 45, targetRpe: 5 },
        { exerciseId: "lib_chest_pushups", sets: 2, reps: 8, restSeconds: 60, targetRpe: 6 },
        { exerciseId: "lib_back_seated_cable_rows", sets: 2, reps: 12, restSeconds: 60, targetRpe: 6 },
        { exerciseId: "lib_legs_lying_leg_curls", sets: 2, reps: 12, restSeconds: 45, targetRpe: 6 },
        { exerciseId: "lib_stretching_childs_pose", sets: 2, reps: 45, restSeconds: 15, targetRpe: 2 },
      ] },
    ],
  }),
];

WORKOUT_TEMPLATES.push(...EXTRA_WORKOUT_TEMPLATES);

const PLAN_LOCALIZATIONS: Record<string, PlanLocalization> = {
  fat_loss_beginner_3x: {
    titleRu: "База для похудения",
    titleKk: "Арықтауға арналған база",
    subtitleRu: "Безопасный план 3 раза в неделю для новичков",
    subtitleKk: "Бастапқы деңгейге қауіпсіз 3 күндік жоспар",
    goalLabelRu: "Похудение",
    goalLabelKk: "Арықтау",
    descriptionRu: "Сбалансированный недельный план для безопасного похудения, сохранения мышц и стабильности.",
    descriptionKk: "Қауіпсіз арықтау, бұлшықетті сақтау және тұрақты режим үшін теңгерімді апталық жоспар.",
    coachAnalysisRu: "Подходит клиентам, которые только начинают или возвращаются после перерыва. Объём умеренный, упражнения легко контролировать.",
    coachAnalysisKk: "Жаттығуды енді бастаған немесе үзілістен кейін келген клиенттерге жақсы. Көлемі орташа, жаттығуларды бақылау оңай.",
    dayRu: ["День 1 · Силовая на всё тело", "День 2 · Верх тела + кардио", "День 3 · Ноги + выносливость"],
    dayKk: ["1-күн · Толық денеге күш", "2-күн · Жоғарғы дене + кардио", "3-күн · Аяқ + төзімділік"],
    dayDescriptionRu: ["Силовая тренировка на всё тело с акцентом на технику.", "Верх тела с мягким кардио в конце.", "Низ тела и выносливость. Цель — стабильная работа, не изматывание."],
    dayDescriptionKk: ["Техникаға мән беретін толық дене күш жаттығуы.", "Жоғарғы дене және соңында жеңіл кардио.", "Төменгі дене және төзімділік. Мақсат — тұрақты жұмыс, шаршап құлау емес."],
  },
  muscle_gain_intermediate_3x: {
    titleRu: "Чистый набор мышц",
    titleKk: "Сапалы бұлшықет жинау",
    subtitleRu: "Гипертрофия для стабильного набора мышц",
    subtitleKk: "Тұрақты бұлшықет өсіміне арналған гипертрофия",
    goalLabelRu: "Набор мышц",
    goalLabelKk: "Бұлшықет жинау",
    descriptionRu: "Трёхдневный сплит на гипертрофию с базовыми и дополнительными упражнениями.",
    descriptionKk: "Негізгі және қосымша жаттығулары бар 3 күндік гипертрофия сплиті.",
    coachAnalysisRu: "Подходит клиентам, которые уже знают базовую технику и нуждаются в прогрессии нагрузки.",
    coachAnalysisKk: "Негізгі техниканы білетін және жүктемені біртіндеп арттыру керек клиенттерге арналған.",
    dayRu: ["День 1 · Жимовая гипертрофия", "День 2 · Тяговая гипертрофия", "День 3 · Ноги и ягодицы"],
    dayKk: ["1-күн · Итеру гипертрофиясы", "2-күн · Тарту гипертрофиясы", "3-күн · Аяқ және бөксе"],
    dayDescriptionRu: ["Грудь, плечи и трицепс.", "Спина и бицепс с акцентом на ширину и толщину.", "Гипертрофия низа тела: присед, тяга и ягодицы."],
    dayDescriptionKk: ["Кеуде, иық және трицепс.", "Арқа мен бицепс, ені мен қалыңдығына екпін.", "Төменгі дене гипертрофиясы: отырып-тұру, тарту және бөксе."],
  },
  strength_advanced_3x: {
    titleRu: "Силовая база Advanced",
    titleKk: "Advanced күш базасы",
    subtitleRu: "Силовой план с контролируемым объёмом",
    subtitleKk: "Бақылаулы көлемі бар күш жоспары",
    goalLabelRu: "Сила",
    goalLabelKk: "Күш",
    descriptionRu: "Трёхдневный силовой план для клиентов с уверенной техникой.",
    descriptionKk: "Техникасы жақсы клиенттерге арналған 3 күндік күш жоспары.",
    coachAnalysisRu: "Используй только для клиентов с хорошим восстановлением и стабильной техникой.",
    coachAnalysisKk: "Қалпына келуі жақсы және техникасы тұрақты клиенттерге ғана қолдан.",
    dayRu: ["День 1 · Сила приседа", "День 2 · Жим и верх тела", "День 3 · Сила становой"],
    dayKk: ["1-күн · Отырып-тұру күші", "2-күн · Жим және жоғарғы дене", "3-күн · Өлі тарту күші"],
    dayDescriptionRu: ["Тяжёлый присед и поддержка задней цепи.", "Верх тела с акцентом на жим лёжа.", "Становая тяга и дополнительные упражнения на заднюю цепь."],
    dayDescriptionKk: ["Ауыр отырып-тұру және артқы тізбек қолдауы.", "Жатып сығымдауға екпін беретін жоғарғы дене күші.", "Өлі тарту және артқы тізбекке қосымша жаттығулар."],
  },
  home_bodyweight_3x: {
    titleRu: "Домашний план без инвентаря",
    titleKk: "Үйдегі өз салмағымен жоспар",
    subtitleRu: "Зал не нужен, 3 тренировки в неделю",
    subtitleKk: "Зал керек емес, аптасына 3 жаттығу",
    goalLabelRu: "Домашние тренировки",
    goalLabelKk: "Үй жаттығулары",
    descriptionRu: "Эффективный домашний план для стабильности, выносливости и базовой силы.",
    descriptionKk: "Тұрақтылық, төзімділік және негізгі күш үшін тиімді үй жоспары.",
    coachAnalysisRu: "Полезно, когда клиент не может ходить в зал, но ему нужна структура.",
    coachAnalysisKk: "Клиент залға бара алмаса, бірақ нақты құрылым керек болса пайдалы.",
    dayRu: ["День 1 · Всё тело дома", "День 2 · Выносливость и пресс", "День 3 · Ноги, ягодицы и мобильность"],
    dayKk: ["1-күн · Үйде толық дене", "2-күн · Төзімділік және пресс", "3-күн · Аяқ, бөксе және қозғалыс"],
    dayDescriptionRu: ["Простая домашняя тренировка на всё тело.", "Кардио и пресс для энергии и координации.", "Домашняя тренировка на низ тела и мобильность."],
    dayDescriptionKk: ["Үйде толық денеге қарапайым жаттығу.", "Энергия мен координацияға арналған кардио және пресс.", "Төменгі дене мен қозғалысқа арналған үй жаттығуы."],
  },
};

const AUTO_LOCALIZATION: Record<string, PlanLocalization> = {
  fat_loss_intermediate_3x: {
    titleRu: "Ускорение похудения",
    titleKk: "Арықтауды күшейту",
    subtitleRu: "Более сильный план для подготовленных клиентов",
    subtitleKk: "Дайын клиенттерге арналған күштірек арықтау жоспары",
    goalLabelRu: "Похудение",
    goalLabelKk: "Арықтау",
    descriptionRu: "Средний план, который сочетает силовые упражнения и выносливость для улучшения формы.",
    descriptionKk: "Дене құрамын жақсарту үшін күш пен төзімділікті біріктіретін орта деңгей жоспары.",
    coachAnalysisRu: "Используй, если клиент уже тренируется стабильно и ему нужна большая плотность работы без потери силы.",
    coachAnalysisKk: "Клиент тұрақты жаттығып жүрсе және күшті жоғалтпай тығыз жұмыс керек болса, осы жоспар қолайлы.",
    dayRu: ["День 1 · Плотная силовая", "День 2 · Верх + интервалы", "День 3 · Ноги + метаболический финиш"],
    dayKk: ["1-күн · Тығыз күш жұмысы", "2-күн · Жоғарғы дене + интервал", "3-күн · Аяқ + метаболикалық аяқтау"],
    dayDescriptionRu: ["Базовые упражнения с умеренным отдыхом.", "Верх тела с короткими кардио-интервалами.", "Ноги с финишем для расхода калорий."],
    dayDescriptionKk: ["Орташа демалыспен негізгі жаттығулар.", "Жоғарғы дене және қысқа кардио интервалдар.", "Калория жұмсауға арналған аяқ жаттығуы."],
  },
  muscle_gain_beginner_3x: {
    titleRu: "Набор мышц для новичка",
    titleKk: "Бастапқы бұлшықет жинау",
    subtitleRu: "Простой план гипертрофии для первых месяцев",
    subtitleKk: "Алғашқы айларға арналған қарапайым гипертрофия жоспары",
    goalLabelRu: "Набор мышц",
    goalLabelKk: "Бұлшықет жинау",
    descriptionRu: "План набора мышц для новичка с тренажёрами, гантелями и контролируемым объёмом.",
    descriptionKk: "Тренажёр, гантель және бақылаулы көлем арқылы бұлшықет жинауға арналған бастапқы жоспар.",
    coachAnalysisRu: "План обучает базовым движениям и оставляет реалистичное восстановление.",
    coachAnalysisKk: "Жоспар негізгі қозғалыстарды үйретеді және қалпына келуге жеткілікті уақыт береді.",
    dayRu: ["День 1 · Всё тело A", "День 2 · Всё тело B", "День 3 · Всё тело C"],
    dayKk: ["1-күн · Толық дене A", "2-күн · Толық дене B", "3-күн · Толық дене C"],
    dayDescriptionRu: ["Первая тренировка на всё тело для роста мышц.", "Вторая тренировка с акцентом на ягодицы и спину.", "Сбалансированная тренировка для закрепления движений."],
    dayDescriptionKk: ["Бұлшықет өсуіне арналған алғашқы толық дене жаттығуы.", "Бөксе мен арқаға екпін беретін екінші жаттығу.", "Негізгі қозғалыстарды бекітуге арналған теңгерімді жаттығу."],
  },
  dumbbell_home_3x: {
    titleRu: "Домашняя сила с гантелями",
    titleKk: "Үйде гантельмен күш",
    subtitleRu: "Для клиентов с гантелями дома",
    subtitleKk: "Үйде гантелі бар клиенттерге",
    goalLabelRu: "Дом с гантелями",
    goalLabelKk: "Гантельмен үй",
    descriptionRu: "Домашний план с гантелями для силы, тонуса и стабильности.",
    descriptionKk: "Күш, тонус және тұрақтылық үшін гантельмен үй жоспары.",
    coachAnalysisRu: "Подходит клиентам, которые тренируются дома, но им нужна нагрузка больше, чем собственный вес.",
    coachAnalysisKk: "Үйде жаттығатын, бірақ өз салмағынан көбірек жүктеме керек клиенттерге жақсы.",
    dayRu: ["День 1 · Гантели всё тело A", "День 2 · Ноги и ягодицы с гантелями", "День 3 · Верх и пресс с гантелями"],
    dayKk: ["1-күн · Гантель толық дене A", "2-күн · Гантельмен аяқ және бөксе", "3-күн · Гантельмен жоғарғы дене және пресс"],
    dayDescriptionRu: ["Сбалансированная силовая с гантелями.", "Низ тела через простые движения с гантелями.", "Тренировка верха тела и пресса."],
    dayDescriptionKk: ["Гантельмен теңгерімді күш жаттығуы.", "Гантельмен төменгі денеге қарапайым қозғалыстар.", "Жоғарғы дене мен пресс жаттығуы."],
  },
  beginner_gym_start_3x: {
    titleRu: "Старт в зале для новичка",
    titleKk: "Залда бастау",
    subtitleRu: "Первая уверенная неделя в зале",
    subtitleKk: "Залда сенімді алғашқы апта",
    goalLabelRu: "Новичок в зале",
    goalLabelKk: "Залда бастаушы",
    descriptionRu: "Очень простой первый недельный план, чтобы научить тренажёрам, темпу и режиму.",
    descriptionKk: "Тренажёр, темп және тәртіпті үйрететін өте қарапайым алғашқы апта.",
    coachAnalysisRu: "Лучше всего подходит, когда клиент волнуется или совсем новый в зале.",
    coachAnalysisKk: "Клиент залдан қысылса немесе мүлде жаңа болса, өте қолайлы.",
    dayRu: ["День 1 · Основы тренажёров", "День 2 · Контроль гантелей", "День 3 · Формирование режима"],
    dayKk: ["1-күн · Тренажёр негіздері", "2-күн · Гантель бақылауы", "3-күн · Тәртіп қалыптастыру"],
    dayDescriptionRu: ["Изучение базовых тренажёров и комфортных движений.", "Лёгкая техника с гантелями и корпус.", "Простая повторяемая тренировка на всё тело."],
    dayDescriptionKk: ["Негізгі тренажёрлар мен ыңғайлы қозғалыстарды үйрену.", "Жеңіл гантель техникасы және корпус.", "Қайталанатын қарапайым толық дене жаттығуы."],
  },
  glutes_legs_intermediate_3x: {
    titleRu: "Акцент на ягодицы и ноги",
    titleKk: "Бөксе мен аяққа акцент",
    subtitleRu: "Форма и сила нижней части тела",
    subtitleKk: "Төменгі дене пішіні мен күші",
    goalLabelRu: "Ягодицы и ноги",
    goalLabelKk: "Бөксе және аяқ",
    descriptionRu: "Фокусный план на 3 дня для сильных ног и развитых ягодиц. Внутри есть ягодичный мост, тяговые движения, приседания, выпады и дополнительная работа на форму.",
    descriptionKk: "Күшті аяқ және дамыған бөксе үшін 3 күндік фокус жоспар. Ішінде жамбас көтеру, тарту қозғалыстары, отырып-тұру, выпад және пішінге қосымша жұмыс бар.",
    coachAnalysisRu: "Подходит клиентам, у которых главный приоритет — развитие ягодиц и ног. Объём достаточно сильный, но распределён по неделе так, чтобы восстановление оставалось реалистичным.",
    coachAnalysisKk: "Негізгі мақсаты бөксе мен аяқ дамыту болған клиенттерге жақсы. Көлемі жеткілікті күшті, бірақ қалпына келу сақталуы үшін аптаға дұрыс бөлінген.",
    dayRu: ["День 1 · Сила ягодиц", "День 2 · Квадрицепс и форма", "День 3 · Памп ягодиц и мобильность"],
    dayKk: ["1-күн · Бөксе күші", "2-күн · Квадрицепс және пішін", "3-күн · Бөксе пампы және қозғалыс"],
    dayDescriptionRu: ["Главный день на ягодицы через ягодичный мост и тяговое движение.", "День с акцентом на квадрицепс, контроль коленей и форму ног.", "Высокоповторная работа на ягодицы плюс мобильность для восстановления."],
    dayDescriptionKk: ["Жамбас көтеру және тарту қозғалысы арқылы негізгі бөксе күні.", "Квадрицепске, тізе бақылауына және аяқ пішініне екпін беретін күн.", "Бөксеге көп қайталаулы жұмыс және қалпына келуге арналған қозғалыс."],
  },
  mobility_recovery_3x: {
    titleRu: "Мобильность и восстановление",
    titleKk: "Қозғалыс және қалпына келу",
    subtitleRu: "Для осанки, качества движения и восстановления",
    subtitleKk: "Қалып, қозғалыс сапасы және қалпына келу үшін",
    goalLabelRu: "Мобильность",
    goalLabelKk: "Қозғалғыштық",
    descriptionRu: "Низкоударный план для клиентов, которым нужно улучшить мобильность, осанку, контроль суставов и восстановление. Его можно использовать после тяжёлых недель или вместе с работой на снижение жира.",
    descriptionKk: "Қозғалысты, қалыпты, буын бақылауын және қалпына келуді жақсартуы керек клиенттерге арналған жеңіл жоспар. Оны ауыр апталардан кейін немесе май азайту жұмысымен бірге қолдануға болады.",
    coachAnalysisRu: "Этот план полезен клиентам с низким восстановлением, слабой мобильностью или высоким стрессом. Он сохраняет активность без тяжёлой усталости и улучшает качество движений.",
    coachAnalysisKk: "Бұл жоспар қалпына келуі төмен, қозғалысы шектеулі немесе стрессі жоғары клиенттерге пайдалы. Ол қатты шаршатпай белсенділікті сақтайды және қозғалыс сапасын жақсартады.",
    dayRu: ["День 1 · Спина и таз", "День 2 · Плечи и осанка", "День 3 · Голеностоп, таз и корпус"],
    dayKk: ["1-күн · Омыртқа және жамбас", "2-күн · Иық және қалып", "3-күн · Тобық, жамбас және корпус"],
    dayDescriptionRu: ["Мягкая мобильность для позвоночника, таза и задней поверхности тела.", "Мобильность верха тела и работа над осанкой для плеч и грудного отдела.", "Мобильность нижней части тела с лёгкой силовой работой, чтобы суставы оставались активными."],
    dayDescriptionKk: ["Омыртқа, жамбас және артқы тізбекке арналған жеңіл қозғалыс.", "Иық пен кеуде аймағына арналған жоғарғы дене қозғалысы және қалып жұмысы.", "Буындар белсенді қалуы үшін жеңіл күшпен төменгі дене қозғалысы."],
  },
  busy_45min_3x: {
    titleRu: "План 45 минут для занятых",
    titleKk: "Бос уақыты аз клиентке 45 минут",
    subtitleRu: "Эффективные тренировки при нехватке времени",
    subtitleKk: "Уақыты аз клиенттерге тиімді жаттығулар",
    goalLabelRu: "Общая форма",
    goalLabelKk: "Жалпы форма",
    descriptionRu: "Компактный план для занятых клиентов, которые могут тренироваться только 45 минут. Каждая тренировка включает самые полезные движения без лишней сложности.",
    descriptionKk: "Тек 45 минут жаттыға алатын бос уақыты аз клиенттерге арналған ықшам жоспар. Әр жаттығуда артық күрделіліксіз ең пайдалы қозғалыстар бар.",
    coachAnalysisRu: "План полезен, когда главная проблема клиента — время и стабильность. Упражнений меньше, но качество остаётся высоким: базовые движения, короткие дополнительные упражнения и простая прогрессия.",
    coachAnalysisKk: "Клиенттің негізгі мәселесі уақыт пен тұрақтылық болса, бұл жоспар пайдалы. Жаттығулар аздау, бірақ сапасы жоғары: негізгі қозғалыстар, қысқа қосымша жаттығулар және қарапайым прогрессия.",
    dayRu: ["День 1 · Быстрое всё тело A", "День 2 · Быстрое всё тело B", "День 3 · Быстрое всё тело C"],
    dayKk: ["1-күн · Тиімді толық дене A", "2-күн · Тиімді толық дене B", "3-күн · Тиімді толық дене C"],
    dayDescriptionRu: ["Присед, жим, тяга и корпус. Минимум упражнений, но высокая отдача.", "Тяговое движение, вертикальная тяга, жим плечами и кондиция.", "Жим ногами, отжимания, тяга и ягодичная работа для быстрой полной тренировки."],
    dayDescriptionKk: ["Отырып-тұру, жим, тарту және корпус. Жаттығу аз, бірақ пайдасы жоғары.", "Тарту қозғалысы, вертикалды тарту, иық жимі және кондиция.", "Аяқ жимі, итерілу, тарту және бөксе жұмысы бар жылдам толық жаттығу."],
  },
};

Object.entries({ ...PLAN_LOCALIZATIONS, ...AUTO_LOCALIZATION }).forEach(([planId, loc]) => {
  const plan = WORKOUT_TEMPLATES.find((item) => item.id === planId);
  if (plan) applyPlanLocalization(plan, loc);
});


export function getWorkoutTemplateById(id?: string | null): WeeklyTrainingPlan | undefined {
  if (!id) return undefined;

  return WORKOUT_TEMPLATES.find((plan) => plan.id === id);
}

export function getTemplatesByGoal(goal: WeeklyPlanGoal): WeeklyTrainingPlan[] {
  return WORKOUT_TEMPLATES.filter((plan) => plan.goal === goal);
}

export function getTemplatesByLevel(level: FitnessLevel): WeeklyTrainingPlan[] {
  return WORKOUT_TEMPLATES.filter((plan) => plan.level === level);
}

export function getExerciseIdsUsedInTemplates(): string[] {
  const ids = WORKOUT_TEMPLATES.flatMap((plan) =>
    plan.days.flatMap((day) =>
      day.exercises.map((exercise) => exercise.exerciseId).filter(Boolean),
    ),
  );

  return Array.from(new Set(ids as string[]));
}

export function validateWorkoutTemplates(): {
  valid: boolean;
  missingExerciseIds: string[];
  totalPlans: number;
  totalWorkoutDays: number;
  totalExercises: number;
} {
  const libraryIds = new Set(EXERCISE_LIBRARY.map((exercise) => exercise.id));
  const usedIds = getExerciseIdsUsedInTemplates();

  const missingExerciseIds = usedIds.filter((id) => !libraryIds.has(id));

  return {
    valid: missingExerciseIds.length === 0,
    missingExerciseIds,
    totalPlans: WORKOUT_TEMPLATES.length,
    totalWorkoutDays: WORKOUT_TEMPLATES.reduce(
      (sum, plan) => sum + plan.days.length,
      0,
    ),
    totalExercises: WORKOUT_TEMPLATES.reduce(
      (sum, plan) =>
        sum +
        plan.days.reduce(
          (daySum, day) => daySum + day.exercises.length,
          0,
        ),
      0,
    ),
  };
}

function goalTypeToTemplateGoal(goalType?: string | null): WeeklyPlanGoal | null {
  if (goalType === "lose_weight") return "fat_loss";
  if (goalType === "gain_muscle") return "muscle_gain";
  if (goalType === "improve_mobility") return "mobility";
  if (goalType === "maintain_shape") return "general_fitness";

  return null;
}

export function scoreWorkoutTemplateForClient(
  plan: WeeklyTrainingPlan,
  client?: ClientProfile | null,
): TemplateRecommendation {
  const reasons: TemplateRecommendationReason[] = [];
  let score = 50;

  if (!client) {
    reasons.push({
      label: "General fit",
      score: 10,
      reason: "No detailed client profile was found, so this plan is shown as a general option.",
    });

    return {
      plan,
      score,
      reasons,
    };
  }

  const preferredGoal = goalTypeToTemplateGoal(client.goalType);

  if (preferredGoal && plan.goal === preferredGoal) {
    score += 25;
    reasons.push({
      label: "Goal match",
      score: 25,
      reason: "The plan matches the client's selected goal.",
    });
  } else if (plan.goal === "general_fitness") {
    score += 8;
    reasons.push({
      label: "General base",
      score: 8,
      reason: "The plan can work as a general fitness base.",
    });
  }

  if (plan.level === client.fitnessLevel) {
    score += 20;
    reasons.push({
      label: "Level match",
      score: 20,
      reason: "The plan difficulty matches the client's fitness level.",
    });
  } else if (
    client.fitnessLevel === "beginner" &&
    plan.level === "intermediate"
  ) {
    score -= 10;
    reasons.push({
      label: "Intensity warning",
      score: -10,
      reason: "The plan may be slightly too intense for a beginner.",
    });
  } else if (
    client.fitnessLevel === "advanced" &&
    plan.level === "beginner"
  ) {
    score -= 6;
    reasons.push({
      label: "Too easy",
      score: -6,
      reason: "The plan may be too easy for an advanced client.",
    });
  }

  const healthNotes = (client.healthNotes ?? "").toLowerCase();

  if (
    healthNotes.includes("knee") ||
    healthNotes.includes("колен") ||
    healthNotes.includes("тізе")
  ) {
    if (plan.goal === "fat_loss" || plan.equipment === "bodyweight") {
      score += 5;
      reasons.push({
        label: "Joint-friendly option",
        score: 5,
        reason: "This plan can be adjusted for knee-sensitive clients.",
      });
    }

    if (plan.goal === "strength" || plan.goal === "glutes_legs") {
      score -= 8;
      reasons.push({
        label: "Knee caution",
        score: -8,
        reason: "The plan includes more lower-body loading and should be edited carefully.",
      });
    }
  }

  if (
    healthNotes.includes("back") ||
    healthNotes.includes("спин") ||
    healthNotes.includes("бел")
  ) {
    if (plan.goal === "mobility") {
      score += 12;
      reasons.push({
        label: "Back-friendly",
        score: 12,
        reason: "Mobility and core work may be a safer starting point.",
      });
    }

    if (plan.goal === "strength") {
      score -= 10;
      reasons.push({
        label: "Back caution",
        score: -10,
        reason: "Heavy deadlifts and squats require careful coaching for this client.",
      });
    }
  }

  return {
    plan,
    score: Math.max(0, Math.min(100, score)),
    reasons,
  };
}

export function getRecommendedWorkoutTemplates(
  client?: ClientProfile | null,
): TemplateRecommendation[] {
  return WORKOUT_TEMPLATES.map((plan) =>
    scoreWorkoutTemplateForClient(plan, client),
  ).sort((a, b) => b.score - a.score);
}


export function getLocalizedPlanTitle(
  plan: WeeklyTrainingPlan,
  lang: string,
): string {
  if (lang === "ru") return plan.titleRu ?? plan.title;
  if (lang === "kk") return plan.titleKk ?? plan.title;
  return plan.title;
}

export function getLocalizedPlanSubtitle(
  plan: WeeklyTrainingPlan,
  lang: string,
): string {
  if (lang === "ru") return plan.subtitleRu ?? plan.subtitle ?? "";
  if (lang === "kk") return plan.subtitleKk ?? plan.subtitle ?? "";
  return plan.subtitle ?? "";
}

export function getLocalizedPlanDescription(
  plan: WeeklyTrainingPlan,
  lang: string,
): string {
  if (lang === "ru") return plan.descriptionRu ?? plan.description;
  if (lang === "kk") return plan.descriptionKk ?? plan.description;
  return plan.description;
}

export function getLocalizedPlanGoalLabel(
  plan: WeeklyTrainingPlan,
  lang: string,
): string {
  if (lang === "ru") return plan.goalLabelRu ?? plan.goalLabel;
  if (lang === "kk") return plan.goalLabelKk ?? plan.goalLabel;
  return plan.goalLabel;
}

export function getLocalizedPlanCoachAnalysis(
  plan: WeeklyTrainingPlan,
  lang: string,
): string {
  if (lang === "ru") return plan.coachAnalysisRu ?? plan.coachAnalysis;
  if (lang === "kk") return plan.coachAnalysisKk ?? plan.coachAnalysis;
  return plan.coachAnalysis;
}

export function getLocalizedSafetyNotes(
  plan: WeeklyTrainingPlan,
  lang: string,
): string[] {
  if (lang === "ru") return plan.safetyNotesRu ?? plan.safetyNotes;
  if (lang === "kk") return plan.safetyNotesKk ?? plan.safetyNotes;
  return plan.safetyNotes;
}

export function getLocalizedProgressionNotes(
  plan: WeeklyTrainingPlan,
  lang: string,
): string[] {
  if (lang === "ru") return plan.progressionNotesRu ?? plan.progressionNotes;
  if (lang === "kk") return plan.progressionNotesKk ?? plan.progressionNotes;
  return plan.progressionNotes;
}

export function getLocalizedDayName(day: WeeklyPlanDay, lang: string): string {
  if (lang === "ru") return day.nameRu ?? day.name;
  if (lang === "kk") return day.nameKk ?? day.name;
  return day.name;
}

export function getLocalizedDayDescription(
  day: WeeklyPlanDay,
  lang: string,
): string {
  if (lang === "ru") return day.descriptionRu ?? day.description ?? "";
  if (lang === "kk") return day.descriptionKk ?? day.description ?? "";
  return day.description ?? "";
}

export function getLocalizedExerciseName(
  exercise: WeeklyPlanExercise,
  lang: string,
): string {
  if (lang === "ru") return exercise.nameRu ?? exercise.name;
  if (lang === "kk") return exercise.nameKk ?? exercise.name;
  return exercise.name;
}

export function getLocalizedExerciseNotes(
  exercise: WeeklyPlanExercise,
  lang: string,
): string {
  if (lang === "ru") return exercise.notesRu ?? exercise.notes ?? "";
  if (lang === "kk") return exercise.notesKk ?? exercise.notes ?? "";
  return exercise.notes ?? "";
}

export function buildPlanFitAnalysis(params: {
  plan: WeeklyTrainingPlan;
  client?: ClientProfile | null;
  progress?: ProgressEntry[];
  workouts?: WorkoutAssignment[];
  lang?: string;
}): string {
  const { plan, client } = params;
  const progress = params.progress ?? [];
  const workouts = params.workouts ?? [];
  const lang = params.lang ?? "en";
  const lines: string[] = [];
  const planTitle = getLocalizedPlanTitle(plan, lang);
  const planGoal = getLocalizedPlanGoalLabel(plan, lang);

  if (lang === "ru") {
    lines.push(`${planTitle} — план ${plan.sessionsPerWeek} раза в неделю с фокусом: ${planGoal.toLowerCase()}.`);
  } else if (lang === "kk") {
    lines.push(`${planTitle} — аптасына ${plan.sessionsPerWeek} рет, негізгі мақсат: ${planGoal.toLowerCase()}.`);
  } else {
    lines.push(`${planTitle} is a ${plan.sessionsPerWeek}x/week plan focused on ${planGoal.toLowerCase()}.`);
  }

  if (client) {
    if (lang === "ru") {
      lines.push(`Уровень клиента: ${client.fitnessLevel}. Уровень плана: ${plan.level}.`);
    } else if (lang === "kk") {
      lines.push(`Клиент деңгейі: ${client.fitnessLevel}. Жоспар деңгейі: ${plan.level}.`);
    } else {
      lines.push(`Client level: ${client.fitnessLevel}. Plan level: ${plan.level}.`);
    }

    const preferredGoal = goalTypeToTemplateGoal(client.goalType);

    if (preferredGoal === plan.goal) {
      if (lang === "ru") {
        lines.push("Совпадение цели: сильное совпадение с выбранной целью клиента.");
      } else if (lang === "kk") {
        lines.push("Мақсат сәйкестігі: клиент таңдаған мақсатпен жақсы сәйкес келеді.");
      } else {
        lines.push("Goal fit: strong match with the client's selected goal.");
      }
    } else if (lang === "ru") {
      lines.push("Совпадение цели: план можно использовать, но тренеру лучше проверить текущий приоритет клиента.");
    } else if (lang === "kk") {
      lines.push("Мақсат сәйкестігі: қолдануға болады, бірақ жаттықтырушы клиенттің қазіргі басымдығын тексеруі керек.");
    } else {
      lines.push("Goal fit: usable, but the coach should verify that the plan matches the client's current priority.");
    }

    if (client.healthNotes) {
      if (lang === "ru") {
        lines.push(`Заметки по здоровью: ${client.healthNotes}. Если движение вызывает боль, тренер должен заменить упражнение.`);
      } else if (lang === "kk") {
        lines.push(`Денсаулық ескертпелері: ${client.healthNotes}. Қозғалыс ауырсыну берсе, жаттықтырушы жаттығуды ауыстыруы керек.`);
      } else {
        lines.push(`Health notes detected: ${client.healthNotes}. Coach should edit exercises if any movement causes pain.`);
      }
    }
  }

  if (progress.length >= 2) {
    const sorted = progress.slice().sort((a, b) => a.date.localeCompare(b.date));
    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    const change = Number(last.weight) - Number(first.weight);

    if (Number.isFinite(change)) {
      if (change < -0.5) {
        if (lang === "ru") {
          lines.push(`Тренд веса: минус ${Math.abs(change).toFixed(1)} кг. Силовую работу стоит сохранить, чтобы защитить мышцы.`);
        } else if (lang === "kk") {
          lines.push(`Салмақ тренді: ${Math.abs(change).toFixed(1)} кг төмен. Бұлшықетті сақтау үшін күш жұмысын қалдырған дұрыс.`);
        } else {
          lines.push(`Recent weight trend: ${Math.abs(change).toFixed(1)} kg down. Keep strength work to protect muscle mass.`);
        }
      } else if (change > 0.5) {
        if (lang === "ru") {
          lines.push(`Тренд веса: плюс ${change.toFixed(1)} кг. Нужно понять, соответствует ли это цели клиента.`);
        } else if (lang === "kk") {
          lines.push(`Салмақ тренді: ${change.toFixed(1)} кг жоғары. Бұл клиент мақсатына сай ма, тексеру керек.`);
        } else {
          lines.push(`Recent weight trend: ${change.toFixed(1)} kg up. Monitor whether this supports the goal or needs nutrition adjustment.`);
        }
      } else if (lang === "ru") {
        lines.push("Тренд веса: стабильный. Прогресс нужно оценивать также по посещаемости, замерам и силе.");
      } else if (lang === "kk") {
        lines.push("Салмақ тренді: тұрақты. Прогресті қатысу, өлшем және күш арқылы да бағалау керек.");
      } else {
        lines.push("Recent weight trend: stable. Progress should be judged by attendance, measurements and strength too.");
      }
    }
  }

  if (workouts.length > 0) {
    const completed = workouts.filter((workout) => workout.completed).length;
    const adherence = Math.round((completed / Math.max(1, workouts.length)) * 100);

    if (lang === "ru") {
      lines.push(`Посещаемость тренировок: ${adherence}%. Если ниже 70%, лучше выбрать более простой план или уменьшить объём.`);
    } else if (lang === "kk") {
      lines.push(`Жаттығу қатысуы: ${adherence}%. Егер 70%-дан төмен болса, жеңілірек жоспар немесе аз көлем таңдаған дұрыс.`);
    } else {
      lines.push(`Workout adherence: ${adherence}%. If adherence is below 70%, choose the simpler plan or reduce volume.`);
    }
  }

  if (lang === "ru") {
    lines.push("Рекомендация тренера: назначь план, а после первой недели скорректируй упражнения, веса и объём по самочувствию, боли, посещаемости и технике.");
  } else if (lang === "kk") {
    lines.push("Жаттықтырушы ұсынысы: жоспарды беріп, бірінші аптадан кейін жаттығуларды, салмақты және көлемді жағдайына, ауырсынуына, қатысуына және техникасына қарай түзет.");
  } else {
    lines.push("Coach recommendation: assign the plan, then adjust exercise selection, loading and notes after the first week based on performance, soreness and attendance.");
  }

  return lines.join("\n");
}
