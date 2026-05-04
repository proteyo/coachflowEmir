export type MuscleGroup =
  | "Chest"
  | "Back"
  | "Legs"
  | "Glutes"
  | "Shoulders"
  | "Biceps"
  | "Triceps"
  | "Abs"
  | "Cardio"
  | "Stretching";

export interface LibraryExercise {
  id: string;
  name: string;
  muscleGroup: MuscleGroup;
  category: string;
  defaultSets: number;
  defaultReps: number;
  defaultRestSeconds: number;
  description: string;
  imageUrl: string;
}

const img = (q: string) =>
  `https://images.unsplash.com/${q}?w=600&auto=format&fit=crop&q=70`;

export const EXERCISE_LIBRARY: LibraryExercise[] = [
  // Chest
  { id: "lib_bench", name: "Bench Press", muscleGroup: "Chest", category: "Strength", defaultSets: 4, defaultReps: 8, defaultRestSeconds: 90, description: "Compound chest pressing movement.", imageUrl: img("photo-1571019613454-1cb2f99b2d8b") },
  { id: "lib_inc_db", name: "Incline DB Press", muscleGroup: "Chest", category: "Strength", defaultSets: 3, defaultReps: 10, defaultRestSeconds: 75, description: "Targets upper chest fibers.", imageUrl: img("photo-1581009146145-b5ef050c2e1e") },
  { id: "lib_cable_fly", name: "Cable Fly", muscleGroup: "Chest", category: "Isolation", defaultSets: 3, defaultReps: 12, defaultRestSeconds: 60, description: "Isolation for chest stretch & squeeze.", imageUrl: img("photo-1571902943202-507ec2618e8f") },
  { id: "lib_pushup", name: "Push-up", muscleGroup: "Chest", category: "Bodyweight", defaultSets: 3, defaultReps: 15, defaultRestSeconds: 45, description: "Bodyweight chest staple.", imageUrl: img("photo-1530021232320-687d8e3dba54") },
  // Back
  { id: "lib_pullup", name: "Pull-up", muscleGroup: "Back", category: "Bodyweight", defaultSets: 4, defaultReps: 8, defaultRestSeconds: 90, description: "Vertical pulling, lat width.", imageUrl: img("photo-1517836357463-d25dfeac3438") },
  { id: "lib_row", name: "Barbell Row", muscleGroup: "Back", category: "Strength", defaultSets: 4, defaultReps: 8, defaultRestSeconds: 90, description: "Horizontal pull for thickness.", imageUrl: img("photo-1534258936925-c58bed479fcb") },
  { id: "lib_lat", name: "Lat Pulldown", muscleGroup: "Back", category: "Strength", defaultSets: 3, defaultReps: 10, defaultRestSeconds: 60, description: "Cable pulldown for lats.", imageUrl: img("photo-1581009146145-b5ef050c2e1e") },
  { id: "lib_seated_row", name: "Seated Cable Row", muscleGroup: "Back", category: "Strength", defaultSets: 3, defaultReps: 10, defaultRestSeconds: 60, description: "Mid-back row movement.", imageUrl: img("photo-1583454110551-21f2fa2afe61") },
  // Legs
  { id: "lib_squat", name: "Back Squat", muscleGroup: "Legs", category: "Strength", defaultSets: 5, defaultReps: 5, defaultRestSeconds: 120, description: "Foundational lower-body lift.", imageUrl: img("photo-1574680096145-d05b474e2155") },
  { id: "lib_front_sq", name: "Front Squat", muscleGroup: "Legs", category: "Strength", defaultSets: 4, defaultReps: 6, defaultRestSeconds: 105, description: "Quad-dominant squat variation.", imageUrl: img("photo-1517963879433-6ad2b056d712") },
  { id: "lib_leg_press", name: "Leg Press", muscleGroup: "Legs", category: "Machine", defaultSets: 4, defaultReps: 10, defaultRestSeconds: 90, description: "Machine-based leg pushing.", imageUrl: img("photo-1599058917212-d750089bc07e") },
  { id: "lib_leg_ext", name: "Leg Extension", muscleGroup: "Legs", category: "Isolation", defaultSets: 3, defaultReps: 12, defaultRestSeconds: 60, description: "Quad isolation.", imageUrl: img("photo-1534438327276-14e5300c3a48") },
  { id: "lib_calf", name: "Calf Raise", muscleGroup: "Legs", category: "Isolation", defaultSets: 4, defaultReps: 15, defaultRestSeconds: 45, description: "Standing or seated calf work.", imageUrl: img("photo-1517637633369-e4cc28755e01") },
  // Glutes
  { id: "lib_hip_thrust", name: "Hip Thrust", muscleGroup: "Glutes", category: "Strength", defaultSets: 4, defaultReps: 10, defaultRestSeconds: 90, description: "Glute-focused bridge.", imageUrl: img("photo-1571019613454-1cb2f99b2d8b") },
  { id: "lib_rdl", name: "Romanian Deadlift", muscleGroup: "Glutes", category: "Strength", defaultSets: 4, defaultReps: 8, defaultRestSeconds: 90, description: "Posterior chain hinge.", imageUrl: img("photo-1517836357463-d25dfeac3438") },
  { id: "lib_kickback", name: "Cable Kickback", muscleGroup: "Glutes", category: "Isolation", defaultSets: 3, defaultReps: 12, defaultRestSeconds: 45, description: "Glute isolation.", imageUrl: img("photo-1518611012118-696072aa579a") },
  { id: "lib_lunge", name: "Walking Lunge", muscleGroup: "Glutes", category: "Strength", defaultSets: 3, defaultReps: 12, defaultRestSeconds: 60, description: "Unilateral leg work.", imageUrl: img("photo-1599058917212-d750089bc07e") },
  // Shoulders
  { id: "lib_ohp", name: "Overhead Press", muscleGroup: "Shoulders", category: "Strength", defaultSets: 4, defaultReps: 8, defaultRestSeconds: 90, description: "Standing shoulder press.", imageUrl: img("photo-1581009137042-c552e485697a") },
  { id: "lib_lat_raise", name: "Lateral Raise", muscleGroup: "Shoulders", category: "Isolation", defaultSets: 3, defaultReps: 15, defaultRestSeconds: 45, description: "Side delt isolation.", imageUrl: img("photo-1581009146145-b5ef050c2e1e") },
  { id: "lib_face_pull", name: "Face Pull", muscleGroup: "Shoulders", category: "Isolation", defaultSets: 3, defaultReps: 15, defaultRestSeconds: 45, description: "Rear delt & rotator cuff.", imageUrl: img("photo-1599058917212-d750089bc07e") },
  { id: "lib_arnold", name: "Arnold Press", muscleGroup: "Shoulders", category: "Strength", defaultSets: 3, defaultReps: 10, defaultRestSeconds: 60, description: "Rotational dumbbell press.", imageUrl: img("photo-1574680096145-d05b474e2155") },
  // Biceps
  { id: "lib_bb_curl", name: "Barbell Curl", muscleGroup: "Biceps", category: "Strength", defaultSets: 3, defaultReps: 10, defaultRestSeconds: 60, description: "Mass-builder for biceps.", imageUrl: img("photo-1517344884509-a0c97ec11bcc") },
  { id: "lib_hammer", name: "Hammer Curl", muscleGroup: "Biceps", category: "Isolation", defaultSets: 3, defaultReps: 12, defaultRestSeconds: 45, description: "Targets brachialis.", imageUrl: img("photo-1581009137042-c552e485697a") },
  { id: "lib_incline_curl", name: "Incline DB Curl", muscleGroup: "Biceps", category: "Isolation", defaultSets: 3, defaultReps: 12, defaultRestSeconds: 45, description: "Long-head bicep stretch.", imageUrl: img("photo-1571902943202-507ec2618e8f") },
  // Triceps
  { id: "lib_pushdown", name: "Triceps Pushdown", muscleGroup: "Triceps", category: "Isolation", defaultSets: 3, defaultReps: 12, defaultRestSeconds: 45, description: "Cable triceps isolation.", imageUrl: img("photo-1581009137042-c552e485697a") },
  { id: "lib_skull", name: "Skull Crusher", muscleGroup: "Triceps", category: "Strength", defaultSets: 3, defaultReps: 10, defaultRestSeconds: 60, description: "Lying triceps extension.", imageUrl: img("photo-1518611012118-696072aa579a") },
  { id: "lib_dips", name: "Triceps Dips", muscleGroup: "Triceps", category: "Bodyweight", defaultSets: 3, defaultReps: 10, defaultRestSeconds: 60, description: "Bodyweight triceps work.", imageUrl: img("photo-1517836357463-d25dfeac3438") },
  // Abs
  { id: "lib_plank", name: "Plank", muscleGroup: "Abs", category: "Bodyweight", defaultSets: 3, defaultReps: 60, defaultRestSeconds: 45, description: "Isometric core hold (seconds).", imageUrl: img("photo-1518611012118-696072aa579a") },
  { id: "lib_crunch", name: "Crunch", muscleGroup: "Abs", category: "Bodyweight", defaultSets: 3, defaultReps: 20, defaultRestSeconds: 30, description: "Classic ab flexion.", imageUrl: img("photo-1599058917212-d750089bc07e") },
  { id: "lib_leg_raise", name: "Hanging Leg Raise", muscleGroup: "Abs", category: "Bodyweight", defaultSets: 3, defaultReps: 12, defaultRestSeconds: 60, description: "Lower abs focus.", imageUrl: img("photo-1517344884509-a0c97ec11bcc") },
  { id: "lib_russian", name: "Russian Twist", muscleGroup: "Abs", category: "Bodyweight", defaultSets: 3, defaultReps: 20, defaultRestSeconds: 30, description: "Oblique rotation.", imageUrl: img("photo-1530021232320-687d8e3dba54") },
  // Cardio
  { id: "lib_run", name: "Treadmill Run", muscleGroup: "Cardio", category: "Cardio", defaultSets: 1, defaultReps: 20, defaultRestSeconds: 0, description: "Steady-state run (minutes).", imageUrl: img("photo-1483721310020-03333e577078") },
  { id: "lib_row_erg", name: "Rowing Machine", muscleGroup: "Cardio", category: "Cardio", defaultSets: 1, defaultReps: 15, defaultRestSeconds: 0, description: "Concept2 rowing (minutes).", imageUrl: img("photo-1517637633369-e4cc28755e01") },
  { id: "lib_bike", name: "Stationary Bike", muscleGroup: "Cardio", category: "Cardio", defaultSets: 1, defaultReps: 25, defaultRestSeconds: 0, description: "Indoor cycling (minutes).", imageUrl: img("photo-1534438327276-14e5300c3a48") },
  { id: "lib_jump", name: "Jump Rope", muscleGroup: "Cardio", category: "Cardio", defaultSets: 4, defaultReps: 60, defaultRestSeconds: 30, description: "Skipping intervals (seconds).", imageUrl: img("photo-1571902943202-507ec2618e8f") },
  // Stretching
  { id: "lib_cat_cow", name: "Cat-Cow", muscleGroup: "Stretching", category: "Mobility", defaultSets: 3, defaultReps: 10, defaultRestSeconds: 30, description: "Spine mobility flow.", imageUrl: img("photo-1518611012118-696072aa579a") },
  { id: "lib_pigeon", name: "Pigeon Pose", muscleGroup: "Stretching", category: "Mobility", defaultSets: 2, defaultReps: 60, defaultRestSeconds: 15, description: "Hip opener (seconds per side).", imageUrl: img("photo-1530021232320-687d8e3dba54") },
  { id: "lib_couch", name: "Couch Stretch", muscleGroup: "Stretching", category: "Mobility", defaultSets: 2, defaultReps: 45, defaultRestSeconds: 15, description: "Hip flexor stretch.", imageUrl: img("photo-1517344884509-a0c97ec11bcc") },
  { id: "lib_doorway", name: "Doorway Pec Stretch", muscleGroup: "Stretching", category: "Mobility", defaultSets: 2, defaultReps: 30, defaultRestSeconds: 15, description: "Open chest & shoulders.", imageUrl: img("photo-1571019613454-1cb2f99b2d8b") },
  { id: "lib_world", name: "World's Greatest Stretch", muscleGroup: "Stretching", category: "Mobility", defaultSets: 2, defaultReps: 8, defaultRestSeconds: 15, description: "Full-body warmup.", imageUrl: img("photo-1517836357463-d25dfeac3438") },
];

export const SUPPLEMENT_SUGGESTIONS: {
  name: string;
  dosage: string;
  timesPerDay: number;
  specificTimes: string[];
}[] = [
  { name: "Whey Protein", dosage: "30g", timesPerDay: 1, specificTimes: ["09:00"] },
  { name: "Creatine", dosage: "5g", timesPerDay: 1, specificTimes: ["13:00"] },
  { name: "Omega-3", dosage: "1000mg", timesPerDay: 2, specificTimes: ["09:00", "20:00"] },
  { name: "Vitamin D", dosage: "2000 IU", timesPerDay: 1, specificTimes: ["09:00"] },
  { name: "Magnesium", dosage: "400mg", timesPerDay: 1, specificTimes: ["21:30"] },
  { name: "Multivitamin", dosage: "1 tab", timesPerDay: 1, specificTimes: ["08:00"] },
  { name: "BCAA", dosage: "10g", timesPerDay: 1, specificTimes: ["12:00"] },
  { name: "Electrolytes", dosage: "1 sachet", timesPerDay: 1, specificTimes: ["10:00"] },
];
