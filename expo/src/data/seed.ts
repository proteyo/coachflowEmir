import { DBShape } from "@/src/types/models";

const today = new Date();
const iso = (d: Date) => d.toISOString();
const ymd = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (d: Date, n: number) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};

const COACH_ID = "u_coach_alex";
const C1 = "u_client_sarah";
const C2 = "u_client_mike";
const C3 = "u_client_emma";

const sub30End = addDays(today, 30);
const weekStart = addDays(today, -((today.getDay() + 6) % 7)); // Monday

const ex = (
  workoutId: string,
  i: number,
  name: string,
  sets: number,
  reps: number,
  rest: number,
  muscle: string,
  weight?: number,
): {
  id: string;
  workoutId: string;
  name: string;
  sets: number;
  reps: number;
  restSeconds: number;
  weight?: number;
  muscleGroup: string;
  imageUrl: string;
} => ({
  id: `ex_${workoutId}_${i}`,
  workoutId,
  name,
  sets,
  reps,
  restSeconds: rest,
  weight,
  muscleGroup: muscle,
  imageUrl: `https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=600`,
});

export function buildSeed(): DBShape {
  const workouts = [
    {
      id: "w_sarah_today",
      coachId: COACH_ID,
      clientId: C1,
      date: ymd(today),
      time: "08:00",
      name: "Upper Body Push",
      description: "Chest, shoulders, triceps focus.",
      category: "Strength",
      completed: false,
      durationMinutes: 55,
    },
    {
      id: "w_sarah_tmr",
      coachId: COACH_ID,
      clientId: C1,
      date: ymd(addDays(today, 1)),
      time: "07:30",
      name: "Cardio HIIT",
      description: "20 min interval session.",
      category: "Cardio",
      completed: false,
      durationMinutes: 30,
    },
    {
      id: "w_mike_today",
      coachId: COACH_ID,
      clientId: C2,
      date: ymd(today),
      time: "18:30",
      name: "Lower Body Power",
      description: "Squat & deadlift focus.",
      category: "Strength",
      completed: false,
      durationMinutes: 60,
    },
    {
      id: "w_emma_today",
      coachId: COACH_ID,
      clientId: C3,
      date: ymd(today),
      time: "09:00",
      name: "Full Body Mobility",
      description: "Active recovery + core.",
      category: "Mobility",
      completed: true,
      completedAt: iso(today),
      durationMinutes: 40,
    },
    {
      id: "w_sarah_y1",
      coachId: COACH_ID,
      clientId: C1,
      date: ymd(addDays(today, -1)),
      name: "Pull Day",
      description: "Back & biceps.",
      category: "Strength",
      completed: true,
      completedAt: iso(addDays(today, -1)),
      durationMinutes: 50,
    },
    {
      id: "w_sarah_y2",
      coachId: COACH_ID,
      clientId: C1,
      date: ymd(addDays(today, -2)),
      name: "Leg Day",
      description: "Quads & glutes.",
      category: "Strength",
      completed: true,
      completedAt: iso(addDays(today, -2)),
      durationMinutes: 65,
    },
  ];

  const exercises = [
    ex("w_sarah_today", 1, "Bench Press", 4, 8, 90, "Chest", 60),
    ex("w_sarah_today", 2, "Overhead Press", 3, 10, 75, "Shoulders", 35),
    ex("w_sarah_today", 3, "Incline Dumbbell Press", 3, 10, 60, "Chest", 22),
    ex("w_sarah_today", 4, "Triceps Rope Pushdown", 3, 12, 45, "Triceps", 25),
    ex("w_sarah_today", 5, "Lateral Raises", 3, 15, 45, "Shoulders", 8),
    ex("w_mike_today", 1, "Back Squat", 5, 5, 120, "Quads", 110),
    ex("w_mike_today", 2, "Romanian Deadlift", 4, 8, 90, "Hamstrings", 90),
    ex("w_mike_today", 3, "Walking Lunges", 3, 12, 60, "Glutes", 20),
    ex("w_mike_today", 4, "Calf Raises", 4, 15, 45, "Calves", 40),
    ex("w_emma_today", 1, "Cat-Cow", 3, 10, 30, "Core"),
    ex("w_emma_today", 2, "Plank", 3, 60, 45, "Core"),
    ex("w_emma_today", 3, "Hip Bridges", 3, 12, 45, "Glutes"),
  ];

  const supplementItems = [
    {
      id: "si_1",
      planId: "sp_sarah",
      name: "Whey Protein",
      dosage: "30g",
      timesPerDay: 1,
      specificTimes: ["09:00"],
      notes: "After breakfast",
    },
    {
      id: "si_2",
      planId: "sp_sarah",
      name: "Creatine",
      dosage: "5g",
      timesPerDay: 1,
      specificTimes: ["13:00"],
    },
    {
      id: "si_3",
      planId: "sp_sarah",
      name: "Omega-3",
      dosage: "1000mg",
      timesPerDay: 2,
      specificTimes: ["09:00", "20:00"],
    },
    {
      id: "si_4",
      planId: "sp_mike",
      name: "Multivitamin",
      dosage: "1 tab",
      timesPerDay: 1,
      specificTimes: ["08:00"],
    },
    {
      id: "si_5",
      planId: "sp_mike",
      name: "Magnesium",
      dosage: "400mg",
      timesPerDay: 1,
      specificTimes: ["21:30"],
      notes: "Helps recovery",
    },
  ];

  const places = [
    {
      id: "p1",
      type: "gym" as const,
      name: "Iron Republic Gym",
      address: "Dostyk Ave 12, Almaty",
      latitude: 43.238,
      longitude: 76.945,
      description: "24/7 strength gym with Olympic platforms.",
      imageUrl: "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=800",
      rating: 4.8,
    },
    {
      id: "p2",
      type: "gym" as const,
      name: "FlowFit Studio",
      address: "Abay 50, Almaty",
      latitude: 43.241,
      longitude: 76.92,
      description: "Boutique HIIT & functional training.",
      imageUrl: "https://images.unsplash.com/photo-1571902943202-507ec2618e8f?w=800",
      rating: 4.6,
    },
    {
      id: "p3",
      type: "nutrition" as const,
      name: "Greenhouse Cafe",
      address: "Satpayev 22",
      latitude: 43.235,
      longitude: 76.94,
      description: "Macro-counted meals & smoothies.",
      imageUrl: "https://images.unsplash.com/photo-1547592180-85f173990554?w=800",
      rating: 4.7,
    },
    {
      id: "p4",
      type: "nutrition" as const,
      name: "Protein Bar Almaty",
      address: "Tole Bi 100",
      latitude: 43.252,
      longitude: 76.91,
      description: "High-protein bowls and shakes.",
      imageUrl: "https://images.unsplash.com/photo-1490645935967-10de6ba17061?w=800",
      rating: 4.5,
    },
    {
      id: "p5",
      type: "shop" as const,
      name: "AthleteHub Store",
      address: "Mega Center, Rozybakiev",
      latitude: 43.222,
      longitude: 76.9,
      description: "Sportswear, shoes, accessories.",
      imageUrl: "https://images.unsplash.com/photo-1483721310020-03333e577078?w=800",
      rating: 4.4,
    },
    {
      id: "p6",
      type: "shop" as const,
      name: "Iron Gear Supply",
      address: "Al-Farabi 77",
      latitude: 43.21,
      longitude: 76.93,
      description: "Lifting belts, straps, bars.",
      imageUrl: "https://images.unsplash.com/photo-1517963879433-6ad2b056d712?w=800",
      rating: 4.9,
    },
  ];

  const messages = [
    {
      id: "m1",
      senderId: COACH_ID,
      receiverId: C1,
      content: "Great session yesterday! Push hard on bench today.",
      messageType: "text" as const,
      read: true,
      createdAt: iso(addDays(today, -1)),
    },
    {
      id: "m2",
      senderId: C1,
      receiverId: COACH_ID,
      content: "Thanks coach! Feeling sore but pumped.",
      messageType: "text" as const,
      read: true,
      createdAt: iso(addDays(today, -1)),
    },
    {
      id: "m3",
      senderId: COACH_ID,
      receiverId: C2,
      content: "Heavy squats today, focus on depth.",
      messageType: "text" as const,
      read: false,
      createdAt: iso(today),
    },
  ];

  const progress = [
    { id: "pr1", clientId: C1, weight: 68.0, date: ymd(addDays(today, -28)), addedBy: COACH_ID },
    { id: "pr2", clientId: C1, weight: 67.2, date: ymd(addDays(today, -21)), addedBy: COACH_ID },
    { id: "pr3", clientId: C1, weight: 66.6, date: ymd(addDays(today, -14)), addedBy: C1 },
    { id: "pr4", clientId: C1, weight: 66.1, date: ymd(addDays(today, -7)), addedBy: C1 },
    { id: "pr5", clientId: C1, weight: 65.4, date: ymd(today), addedBy: C1 },
    { id: "pr6", clientId: C2, weight: 82.0, date: ymd(addDays(today, -28)), addedBy: COACH_ID },
    { id: "pr7", clientId: C2, weight: 82.8, date: ymd(addDays(today, -14)), addedBy: C2 },
    { id: "pr8", clientId: C2, weight: 83.5, date: ymd(today), addedBy: C2 },
    { id: "pr9", clientId: C3, weight: 58.0, date: ymd(addDays(today, -14)), addedBy: COACH_ID },
    { id: "pr10", clientId: C3, weight: 57.4, date: ymd(today), addedBy: C3 },
  ];

  const attendance = [
    ...Array.from({ length: 12 }).map((_, i) => ({
      id: `a_sarah_${i}`,
      clientId: C1,
      coachId: COACH_ID,
      date: ymd(addDays(today, -i)),
      status: i === 4 || i === 9 ? ("rest" as const) : ("attended" as const),
    })),
    ...Array.from({ length: 6 }).map((_, i) => ({
      id: `a_mike_${i}`,
      clientId: C2,
      coachId: COACH_ID,
      date: ymd(addDays(today, -i)),
      status: i === 2 ? ("missed" as const) : ("attended" as const),
    })),
    ...Array.from({ length: 8 }).map((_, i) => ({
      id: `a_emma_${i}`,
      clientId: C3,
      coachId: COACH_ID,
      date: ymd(addDays(today, -i)),
      status: "attended" as const,
    })),
  ];

  return {
    users: [
      {
        id: COACH_ID,
        email: "coach@demo.com",
        password: "demo123",
        name: "Alex Mitchell",
        role: "coach",
        phone: "+7 700 000 0001",
        avatarUrl: "https://images.unsplash.com/photo-1567013127542-490d757e51fc?w=400",
        createdAt: iso(addDays(today, -120)),
      },
      {
        id: C1,
        email: "sarah@demo.com",
        password: "demo123",
        name: "Sarah Lee",
        role: "client",
        clientCode: "CFL-SARAH1",
        avatarUrl: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400",
        createdAt: iso(addDays(today, -90)),
      },
      {
        id: C2,
        email: "mike@demo.com",
        password: "demo123",
        name: "Mike Chen",
        role: "client",
        clientCode: "CFL-MIKE22",
        avatarUrl: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400",
        createdAt: iso(addDays(today, -60)),
      },
      {
        id: C3,
        email: "emma@demo.com",
        password: "demo123",
        name: "Emma Rivera",
        role: "client",
        clientCode: "CFL-EMMA33",
        avatarUrl: "https://images.unsplash.com/photo-1531123897727-8f129e1688ce?w=400",
        createdAt: iso(addDays(today, -30)),
      },
    ],
    coachProfiles: [
      {
        userId: COACH_ID,
        specialty: "Strength & Conditioning",
        bio: "8+ years coaching athletes and busy professionals to performance peaks. Focus on strength, hypertrophy, and longevity.",
        experienceYears: 8,
        achievements: ["NSCA-CSCS Certified", "100+ clients coached", "Featured in Men's Health"],
        certificates: ["NSCA-CSCS", "Precision Nutrition L1", "FRC Mobility Specialist"],
        rating: 4.9,
        profileImageUrl: "https://images.unsplash.com/photo-1567013127542-490d757e51fc?w=800",
        coverImageUrl: "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=1200",
      },
    ],
    clientProfiles: [
      {
        userId: C1,
        coachId: COACH_ID,
        goal: "Lose 5kg & build core strength",
        goalType: "lose_weight" as const,
        startWeight: 68,
        currentWeight: 65.4,
        height: 168,
        age: 28,
        fitnessLevel: "intermediate",
        createdAt: iso(addDays(today, -90)),
      },
      {
        userId: C2,
        coachId: COACH_ID,
        goal: "Gain muscle, hit 85kg lean",
        goalType: "gain_muscle" as const,
        startWeight: 82,
        currentWeight: 83.5,
        height: 182,
        age: 31,
        fitnessLevel: "advanced",
        createdAt: iso(addDays(today, -60)),
      },
      {
        userId: C3,
        coachId: COACH_ID,
        goal: "Improve mobility & posture",
        goalType: "improve_mobility" as const,
        startWeight: 58,
        currentWeight: 57.4,
        height: 165,
        age: 26,
        fitnessLevel: "beginner",
        createdAt: iso(addDays(today, -30)),
      },
    ],
    subscriptions: [
      {
        id: "sub_1",
        coachId: COACH_ID,
        planName: "CoachFlow Monthly",
        price: 2490,
        currency: "KZT",
        status: "active",
        startDate: iso(today),
        endDate: iso(sub30End),
        createdAt: iso(today),
      },
    ],
    workouts: workouts as never,
    exercises: exercises as never,
    supplementPlans: [
      { id: "sp_sarah", coachId: COACH_ID, clientId: C1, startDate: ymd(addDays(today, -30)) },
      { id: "sp_mike", coachId: COACH_ID, clientId: C2, startDate: ymd(addDays(today, -30)) },
    ],
    supplementItems: supplementItems as never,
    supplementLogs: [],
    progress: progress as never,
    messages,
    weeklyGoals: [
      {
        id: "wg_sarah",
        clientId: C1,
        weekStart: ymd(weekStart),
        targetMinutes: 240,
        completedMinutes: 165,
        targetWorkouts: 4,
        completedWorkouts: 3,
      },
      {
        id: "wg_mike",
        clientId: C2,
        weekStart: ymd(weekStart),
        targetMinutes: 300,
        completedMinutes: 120,
        targetWorkouts: 5,
        completedWorkouts: 2,
      },
      {
        id: "wg_emma",
        clientId: C3,
        weekStart: ymd(weekStart),
        targetMinutes: 180,
        completedMinutes: 180,
        targetWorkouts: 3,
        completedWorkouts: 3,
      },
    ],
    streaks: [
      { clientId: C1, currentStreak: 9, bestStreak: 14, lastActivityDate: ymd(today) },
      { clientId: C2, currentStreak: 4, bestStreak: 12, lastActivityDate: ymd(today) },
      { clientId: C3, currentStreak: 8, bestStreak: 8, lastActivityDate: ymd(today) },
    ],
    attendance,
    places,
    notifications: [
      {
        userId: COACH_ID,
        workoutReminders: true,
        supplementReminders: true,
        messageNotifications: true,
        weeklyGoalReminders: true,
      },
      {
        userId: C1,
        workoutReminders: true,
        supplementReminders: true,
        messageNotifications: true,
        weeklyGoalReminders: true,
      },
      {
        userId: C2,
        workoutReminders: true,
        supplementReminders: false,
        messageNotifications: true,
        weeklyGoalReminders: false,
      },
      {
        userId: C3,
        workoutReminders: true,
        supplementReminders: true,
        messageNotifications: true,
        weeklyGoalReminders: true,
      },
    ],
    meta: { seeded: true, version: 1 },
  };
}

export const DEMO_IDS = { COACH_ID, C1, C2, C3 };
