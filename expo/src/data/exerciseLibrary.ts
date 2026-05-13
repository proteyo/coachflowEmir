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

export type AppLangCode = "en" | "ru" | "kk";

export interface LibraryExercise {
  id: string;
  name: string;
  nameRu: string;
  nameKk: string;
  muscleGroup: MuscleGroup;
  category: string;
  categoryRu: string;
  categoryKk: string;
  defaultSets: number;
  defaultReps: number;
  defaultRestSeconds: number;
  description: string;
  descriptionRu: string;
  descriptionKk: string;
  imageUrl: string;
  gifUrl?: string;
  animationFrames: string[];
}

export const MUSCLE_GROUPS: MuscleGroup[] = [
  "Chest",
  "Back",
  "Legs",
  "Glutes",
  "Shoulders",
  "Biceps",
  "Triceps",
  "Abs",
  "Cardio",
  "Stretching",
];

const EXDB_BASE =
  "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises";

const exdb = (exerciseId: string, frame: 0 | 1 = 0) =>
  `${EXDB_BASE}/${exerciseId}/${frame}.jpg`;

function frames(exerciseId: string) {
  return [exdb(exerciseId, 0), exdb(exerciseId, 1)];
}

function categoryRu(category: string) {
  const map: Record<string, string> = {
    Strength: "Силовое",
    Isolation: "Изоляция",
    Cable: "Кроссовер",
    Machine: "Тренажёр",
    Bodyweight: "Собственный вес",
    Powerlifting: "Пауэрлифтинг",
    Plyometrics: "Плиометрика",
    Mobility: "Мобильность",
    Cardio: "Кардио",
    Conditioning: "Выносливость",
    Recovery: "Восстановление",
  };

  return map[category] ?? category;
}

function categoryKk(category: string) {
  const map: Record<string, string> = {
    Strength: "Күш жаттығуы",
    Isolation: "Оқшаулау",
    Cable: "Кроссовер",
    Machine: "Тренажёр",
    Bodyweight: "Өз салмағымен",
    Powerlifting: "Пауэрлифтинг",
    Plyometrics: "Плиометрика",
    Mobility: "Қозғалғыштық",
    Cardio: "Кардио",
    Conditioning: "Төзімділік",
    Recovery: "Қалпына келу",
  };

  return map[category] ?? category;
}

function item(input: {
  id: string;
  name: string;
  nameRu: string;
  nameKk: string;
  muscleGroup: MuscleGroup;
  category: string;
  defaultSets: number;
  defaultReps: number;
  defaultRestSeconds: number;
  description: string;
  descriptionRu: string;
  descriptionKk: string;
  exdbId: string;
  gifUrl?: string;
}): LibraryExercise {
  const animationFrames = frames(input.exdbId);

  return {
    id: input.id,
    name: input.name,
    nameRu: input.nameRu,
    nameKk: input.nameKk,
    muscleGroup: input.muscleGroup,
    category: input.category,
    categoryRu: categoryRu(input.category),
    categoryKk: categoryKk(input.category),
    defaultSets: input.defaultSets,
    defaultReps: input.defaultReps,
    defaultRestSeconds: input.defaultRestSeconds,
    description: input.description,
    descriptionRu: input.descriptionRu,
    descriptionKk: input.descriptionKk,
    imageUrl: animationFrames[0],
    gifUrl: input.gifUrl,
    animationFrames,
  };
}

export function getExerciseAnimationFrames(exercise: LibraryExercise): string[] {
  if (exercise.gifUrl) return [exercise.gifUrl];
  if (exercise.animationFrames?.length) return exercise.animationFrames;
  if (exercise.imageUrl.includes("/0.jpg")) {
    return [exercise.imageUrl, exercise.imageUrl.replace("/0.jpg", "/1.jpg")];
  }
  return [exercise.imageUrl];
}

export function getExercisePreviewUrl(exercise: LibraryExercise): string {
  return exercise.gifUrl || exercise.animationFrames?.[0] || exercise.imageUrl;
}

export function getExerciseName(exercise: LibraryExercise, lang: AppLangCode) {
  if (lang === "ru") return exercise.nameRu || exercise.name;
  if (lang === "kk") return exercise.nameKk || exercise.name;
  return exercise.name;
}

export function getExerciseDescription(exercise: LibraryExercise, lang: AppLangCode) {
  if (lang === "ru") return exercise.descriptionRu || exercise.description;
  if (lang === "kk") return exercise.descriptionKk || exercise.description;
  return exercise.description;
}

export function getExerciseCategory(exercise: LibraryExercise, lang: AppLangCode) {
  if (lang === "ru") return exercise.categoryRu || exercise.category;
  if (lang === "kk") return exercise.categoryKk || exercise.category;
  return exercise.category;
}

export function getMuscleGroupName(group: MuscleGroup | "All", lang: AppLangCode) {
  const dict: Record<AppLangCode, Record<MuscleGroup | "All", string>> = {
    en: {
      All: "All",
      Chest: "Chest",
      Back: "Back",
      Legs: "Legs",
      Glutes: "Glutes",
      Shoulders: "Shoulders",
      Biceps: "Biceps",
      Triceps: "Triceps",
      Abs: "Abs",
      Cardio: "Cardio",
      Stretching: "Stretching",
    },
    ru: {
      All: "Все",
      Chest: "Грудь",
      Back: "Спина",
      Legs: "Ноги",
      Glutes: "Ягодицы",
      Shoulders: "Плечи",
      Biceps: "Бицепс",
      Triceps: "Трицепс",
      Abs: "Пресс",
      Cardio: "Кардио",
      Stretching: "Растяжка",
    },
    kk: {
      All: "Барлығы",
      Chest: "Кеуде",
      Back: "Арқа",
      Legs: "Аяқ",
      Glutes: "Бөксе",
      Shoulders: "Иық",
      Biceps: "Бицепс",
      Triceps: "Трицепс",
      Abs: "Іш бұлшықеті",
      Cardio: "Кардио",
      Stretching: "Созылу",
    },
  };

  return dict[lang][group];
}

export const EXERCISE_LIBRARY: LibraryExercise[] = [
  item({
    id: "lib_chest_barbell_bench_press",
    name: "Barbell Bench Press",
    nameRu: "Жим штанги лёжа",
    nameKk: "Штанганы жатып сығымдау",
    muscleGroup: "Chest",
    category: "Strength",
    defaultSets: 4,
    defaultReps: 8,
    defaultRestSeconds: 90,
    description: "Main chest strength exercise for overall pressing power.",
    descriptionRu: "Базовое силовое упражнение для груди и общей силы жима.",
    descriptionKk: "Кеуде бұлшықетін және сығымдау күшін дамытуға арналған негізгі жаттығу.",
    exdbId: "Barbell_Bench_Press_-_Medium_Grip",
  }),
  item({
    id: "lib_chest_wide_grip_barbell_bench_press",
    name: "Wide-Grip Barbell Bench Press",
    nameRu: "Жим штанги широким хватом",
    nameKk: "Штанганы кең ұстаумен жатып сығымдау",
    muscleGroup: "Chest",
    category: "Strength",
    defaultSets: 4,
    defaultReps: 8,
    defaultRestSeconds: 90,
    description: "Bench press variation with stronger chest emphasis.",
    descriptionRu: "Вариант жима лёжа с большим акцентом на грудные мышцы.",
    descriptionKk: "Кеудеге көбірек күш түсіретін жимнің түрі.",
    exdbId: "Wide-Grip_Barbell_Bench_Press",
  }),
  item({
    id: "lib_chest_incline_barbell_bench_press",
    name: "Incline Barbell Bench Press",
    nameRu: "Жим штанги на наклонной скамье",
    nameKk: "Көлбеу орындықта штанганы сығымдау",
    muscleGroup: "Chest",
    category: "Strength",
    defaultSets: 4,
    defaultReps: 8,
    defaultRestSeconds: 90,
    description: "Upper chest compound press with a barbell.",
    descriptionRu: "Базовый жим штанги с акцентом на верх груди.",
    descriptionKk: "Кеуденің жоғарғы бөлігіне арналған штангамен базалық жим.",
    exdbId: "Barbell_Incline_Bench_Press_-_Medium_Grip",
  }),
  item({
    id: "lib_chest_decline_barbell_bench_press",
    name: "Decline Barbell Bench Press",
    nameRu: "Жим штанги на скамье вниз головой",
    nameKk: "Төмен көлбеу орындықта штанганы сығымдау",
    muscleGroup: "Chest",
    category: "Strength",
    defaultSets: 3,
    defaultReps: 8,
    defaultRestSeconds: 90,
    description: "Lower chest pressing movement on a decline bench.",
    descriptionRu: "Жимовое движение на нижнюю часть груди.",
    descriptionKk: "Кеуденің төменгі бөлігіне арналған жим қозғалысы.",
    exdbId: "Decline_Barbell_Bench_Press",
  }),
  item({
    id: "lib_chest_dumbbell_bench_press",
    name: "Dumbbell Bench Press",
    nameRu: "Жим гантелей лёжа",
    nameKk: "Гантельді жатып сығымдау",
    muscleGroup: "Chest",
    category: "Strength",
    defaultSets: 4,
    defaultReps: 10,
    defaultRestSeconds: 75,
    description: "Chest press with dumbbells for deeper range of motion.",
    descriptionRu: "Жим гантелей для груди с большей амплитудой движения.",
    descriptionKk: "Кеудеге арналған, қозғалыс амплитудасы кең гантель жимі.",
    exdbId: "Dumbbell_Bench_Press",
  }),
  item({
    id: "lib_chest_incline_dumbbell_press",
    name: "Incline Dumbbell Press",
    nameRu: "Жим гантелей на наклонной скамье",
    nameKk: "Көлбеу орындықта гантель сығымдау",
    muscleGroup: "Chest",
    category: "Strength",
    defaultSets: 3,
    defaultReps: 10,
    defaultRestSeconds: 75,
    description: "Upper chest dumbbell press with strong stretch.",
    descriptionRu: "Жим гантелей на верх груди с хорошей растяжкой мышц.",
    descriptionKk: "Кеуденің жоғарғы бөлігіне арналған гантель жимі.",
    exdbId: "Incline_Dumbbell_Press",
  }),
  item({
    id: "lib_chest_dumbbell_flyes",
    name: "Dumbbell Flyes",
    nameRu: "Разводка гантелей лёжа",
    nameKk: "Гантельді жатып ашу",
    muscleGroup: "Chest",
    category: "Isolation",
    defaultSets: 3,
    defaultReps: 12,
    defaultRestSeconds: 60,
    description: "Chest isolation exercise focused on stretch and control.",
    descriptionRu: "Изолирующее упражнение для груди с акцентом на растяжку и контроль.",
    descriptionKk: "Кеудені созу және бақылауға арналған оқшаулау жаттығуы.",
    exdbId: "Dumbbell_Flyes",
  }),
  item({
    id: "lib_chest_incline_dumbbell_flyes",
    name: "Incline Dumbbell Flyes",
    nameRu: "Разводка гантелей на наклонной скамье",
    nameKk: "Көлбеу орындықта гантельді ашу",
    muscleGroup: "Chest",
    category: "Isolation",
    defaultSets: 3,
    defaultReps: 12,
    defaultRestSeconds: 60,
    description: "Upper chest fly movement with dumbbells.",
    descriptionRu: "Разводка гантелей с акцентом на верх груди.",
    descriptionKk: "Кеуденің жоғарғы бөлігіне арналған гантель ашу қозғалысы.",
    exdbId: "Incline_Dumbbell_Flyes",
  }),
  item({
    id: "lib_chest_cable_crossover",
    name: "Cable Crossover",
    nameRu: "Сведение рук в кроссовере",
    nameKk: "Кроссоверде қолды біріктіру",
    muscleGroup: "Chest",
    category: "Cable",
    defaultSets: 3,
    defaultReps: 12,
    defaultRestSeconds: 45,
    description: "Cable chest isolation with constant tension.",
    descriptionRu: "Изоляция груди в кроссовере с постоянным напряжением.",
    descriptionKk: "Кроссоверде кеудені тұрақты кернеумен оқшаулау.",
    exdbId: "Cable_Crossover",
  }),
  item({
    id: "lib_chest_low_cable_crossover",
    name: "Low Cable Crossover",
    nameRu: "Нижнее сведение рук в кроссовере",
    nameKk: "Төменнен кроссоверде қолды біріктіру",
    muscleGroup: "Chest",
    category: "Cable",
    defaultSets: 3,
    defaultReps: 12,
    defaultRestSeconds: 45,
    description: "Low-to-high cable movement for upper chest.",
    descriptionRu: "Движение снизу вверх в кроссовере для верхней части груди.",
    descriptionKk: "Кеуденің жоғарғы бөлігіне арналған төменнен жоғары қозғалыс.",
    exdbId: "Low_Cable_Crossover",
  }),
  item({
    id: "lib_chest_butterfly_machine",
    name: "Butterfly Machine",
    nameRu: "Бабочка в тренажёре",
    nameKk: "Баттерфляй тренажёрі",
    muscleGroup: "Chest",
    category: "Machine",
    defaultSets: 3,
    defaultReps: 12,
    defaultRestSeconds: 60,
    description: "Machine chest fly for controlled isolation.",
    descriptionRu: "Сведение рук в тренажёре для контролируемой изоляции груди.",
    descriptionKk: "Кеуде бұлшықетін бақылаумен оқшаулауға арналған тренажёр.",
    exdbId: "Butterfly",
  }),
  item({
    id: "lib_chest_pushups",
    name: "Pushups",
    nameRu: "Отжимания",
    nameKk: "Жерден итерілу",
    muscleGroup: "Chest",
    category: "Bodyweight",
    defaultSets: 3,
    defaultReps: 15,
    defaultRestSeconds: 45,
    description: "Classic bodyweight chest exercise.",
    descriptionRu: "Классическое упражнение на грудь с собственным весом.",
    descriptionKk: "Кеудеге арналған өз салмағымен орындалатын классикалық жаттығу.",
    exdbId: "Pushups",
  }),
  item({
    id: "lib_chest_chest_dips",
    name: "Dips - Chest Version",
    nameRu: "Отжимания на брусьях для груди",
    nameKk: "Кеудеге арналған брусьядағы итерілу",
    muscleGroup: "Chest",
    category: "Bodyweight",
    defaultSets: 3,
    defaultReps: 10,
    defaultRestSeconds: 75,
    description: "Parallel bar dip variation with chest emphasis.",
    descriptionRu: "Вариант отжиманий на брусьях с акцентом на грудь.",
    descriptionKk: "Кеудеге екпін беретін брусьядағы итерілу түрі.",
    exdbId: "Dips_-_Chest_Version",
  }),
  item({
    id: "lib_chest_bodyweight_flyes",
    name: "Bodyweight Flyes",
    nameRu: "Разводка с собственным весом",
    nameKk: "Өз салмағымен кеуде ашу",
    muscleGroup: "Chest",
    category: "Bodyweight",
    defaultSets: 3,
    defaultReps: 10,
    defaultRestSeconds: 60,
    description: "Advanced bodyweight chest fly movement.",
    descriptionRu: "Продвинутое упражнение для груди с собственным весом.",
    descriptionKk: "Кеудеге арналған күрделі өз салмағымен жаттығу.",
    exdbId: "Bodyweight_Flyes",
  }),
  item({
    id: "lib_chest_around_the_worlds",
    name: "Around The Worlds",
    nameRu: "Круговая разводка гантелей",
    nameKk: "Гантельмен айналмалы қозғалыс",
    muscleGroup: "Chest",
    category: "Isolation",
    defaultSets: 3,
    defaultReps: 12,
    defaultRestSeconds: 60,
    description: "Dumbbell chest movement with large circular range.",
    descriptionRu: "Движение гантелей по большой круговой амплитуде для груди.",
    descriptionKk: "Кеудеге арналған кең шеңберлі гантель қозғалысы.",
    exdbId: "Around_The_Worlds",
  }),
  item({
    id: "lib_chest_alternating_floor_press",
    name: "Alternating Floor Press",
    nameRu: "Попеременный жим с пола",
    nameKk: "Еденнен кезекпен сығымдау",
    muscleGroup: "Chest",
    category: "Strength",
    defaultSets: 3,
    defaultReps: 10,
    defaultRestSeconds: 60,
    description: "Floor press variation using kettlebells.",
    descriptionRu: "Вариант жима с пола с гирями или гантелями.",
    descriptionKk: "Еденнен гиря немесе гантельмен сығымдау түрі.",
    exdbId: "Alternating_Floor_Press",
  }),

  item({
    id: "lib_back_pullups",
    name: "Pullups",
    nameRu: "Подтягивания",
    nameKk: "Тартылу",
    muscleGroup: "Back",
    category: "Bodyweight",
    defaultSets: 4,
    defaultReps: 8,
    defaultRestSeconds: 90,
    description: "Vertical pulling exercise for lats and upper back.",
    descriptionRu: "Вертикальная тяга для широчайших и верхней части спины.",
    descriptionKk: "Арқаның жоғарғы бөлігі мен кең бұлшықетіне арналған тартылу.",
    exdbId: "Pullups",
  }),
  item({
    id: "lib_back_chin_up",
    name: "Chin-Up",
    nameRu: "Подтягивания обратным хватом",
    nameKk: "Кері ұстаумен тартылу",
    muscleGroup: "Back",
    category: "Bodyweight",
    defaultSets: 4,
    defaultReps: 8,
    defaultRestSeconds: 90,
    description: "Vertical pull with more biceps involvement.",
    descriptionRu: "Вертикальная тяга с большим участием бицепса.",
    descriptionKk: "Бицепс көбірек қатысатын вертикалды тартылу.",
    exdbId: "Chin-Up",
  }),
  item({
    id: "lib_back_wide_grip_lat_pulldown",
    name: "Wide-Grip Lat Pulldown",
    nameRu: "Тяга верхнего блока широким хватом",
    nameKk: "Жоғарғы блокты кең ұстаумен тарту",
    muscleGroup: "Back",
    category: "Machine",
    defaultSets: 3,
    defaultReps: 10,
    defaultRestSeconds: 60,
    description: "Machine vertical pull focused on lat width.",
    descriptionRu: "Вертикальная тяга в тренажёре для ширины спины.",
    descriptionKk: "Арқа енін дамытуға арналған тренажёрдағы вертикалды тарту.",
    exdbId: "Wide-Grip_Lat_Pulldown",
  }),
  item({
    id: "lib_back_close_grip_front_lat_pulldown",
    name: "Close-Grip Front Lat Pulldown",
    nameRu: "Тяга верхнего блока узким хватом",
    nameKk: "Жоғарғы блокты тар ұстаумен тарту",
    muscleGroup: "Back",
    category: "Machine",
    defaultSets: 3,
    defaultReps: 10,
    defaultRestSeconds: 60,
    description: "Close-grip pulldown for lats and mid-back.",
    descriptionRu: "Тяга узким хватом для широчайших и средней части спины.",
    descriptionKk: "Кең және ортаңғы арқа бұлшықеттеріне арналған тар ұстаумен тарту.",
    exdbId: "Close-Grip_Front_Lat_Pulldown",
  }),
  item({
    id: "lib_back_v_bar_pulldown",
    name: "V-Bar Pulldown",
    nameRu: "Тяга V-рукояти сверху",
    nameKk: "V-тұтқамен жоғары блок тартуы",
    muscleGroup: "Back",
    category: "Machine",
    defaultSets: 3,
    defaultReps: 10,
    defaultRestSeconds: 60,
    description: "Neutral-grip pulldown for controlled lat contraction.",
    descriptionRu: "Тяга нейтральным хватом для контролируемого сокращения широчайших.",
    descriptionKk: "Кең арқа бұлшықетін бақылаумен қысқартуға арналған бейтарап ұстау.",
    exdbId: "V-Bar_Pulldown",
  }),
  item({
    id: "lib_back_seated_cable_rows",
    name: "Seated Cable Rows",
    nameRu: "Горизонтальная тяга сидя",
    nameKk: "Отырып блок тарту",
    muscleGroup: "Back",
    category: "Cable",
    defaultSets: 3,
    defaultReps: 10,
    defaultRestSeconds: 60,
    description: "Horizontal cable row for mid-back thickness.",
    descriptionRu: "Горизонтальная тяга для толщины средней части спины.",
    descriptionKk: "Арқаның орта бөлігін дамытуға арналған горизонталды тарту.",
    exdbId: "Seated_Cable_Rows",
  }),
  item({
    id: "lib_back_bent_over_barbell_row",
    name: "Bent Over Barbell Row",
    nameRu: "Тяга штанги в наклоне",
    nameKk: "Еңкейіп штанга тарту",
    muscleGroup: "Back",
    category: "Strength",
    defaultSets: 4,
    defaultReps: 8,
    defaultRestSeconds: 90,
    description: "Heavy barbell row for back strength and thickness.",
    descriptionRu: "Тяжёлая тяга штанги для силы и толщины спины.",
    descriptionKk: "Арқа күшін және қалыңдығын дамытуға арналған ауыр штанга тарту.",
    exdbId: "Bent_Over_Barbell_Row",
  }),
  item({
    id: "lib_back_one_arm_dumbbell_row",
    name: "One-Arm Dumbbell Row",
    nameRu: "Тяга гантели одной рукой",
    nameKk: "Бір қолмен гантель тарту",
    muscleGroup: "Back",
    category: "Strength",
    defaultSets: 3,
    defaultReps: 10,
    defaultRestSeconds: 60,
    description: "Unilateral dumbbell row for lats and back balance.",
    descriptionRu: "Тяга одной рукой для широчайших и баланса спины.",
    descriptionKk: "Кең арқа мен тепе-теңдікке арналған бір жақты гантель тарту.",
    exdbId: "One-Arm_Dumbbell_Row",
  }),
  item({
    id: "lib_back_t_bar_row",
    name: "T-Bar Row",
    nameRu: "Тяга Т-грифа",
    nameKk: "T-гриф тартуы",
    muscleGroup: "Back",
    category: "Strength",
    defaultSets: 4,
    defaultReps: 8,
    defaultRestSeconds: 90,
    description: "Powerful row variation for dense back development.",
    descriptionRu: "Мощная тяга для развития плотной и сильной спины.",
    descriptionKk: "Арқаны қалың әрі күшті дамытуға арналған қуатты тарту.",
    exdbId: "T-Bar_Row_with_Handle",
  }),
  item({
    id: "lib_back_dumbbell_incline_row",
    name: "Dumbbell Incline Row",
    nameRu: "Тяга гантелей на наклонной скамье",
    nameKk: "Көлбеу орындықта гантель тарту",
    muscleGroup: "Back",
    category: "Strength",
    defaultSets: 3,
    defaultReps: 10,
    defaultRestSeconds: 60,
    description: "Chest-supported dumbbell row for strict form.",
    descriptionRu: "Тяга гантелей с упором грудью для строгой техники.",
    descriptionKk: "Дұрыс техника үшін кеудемен тіреліп гантель тарту.",
    exdbId: "Dumbbell_Incline_Row",
  }),
  item({
    id: "lib_back_straight_arm_pulldown",
    name: "Straight-Arm Pulldown",
    nameRu: "Тяга прямыми руками",
    nameKk: "Түзу қолмен блок тарту",
    muscleGroup: "Back",
    category: "Cable",
    defaultSets: 3,
    defaultReps: 12,
    defaultRestSeconds: 45,
    description: "Lat isolation exercise with straight arms.",
    descriptionRu: "Изолирующее упражнение на широчайшие с прямыми руками.",
    descriptionKk: "Кең арқа бұлшықетіне арналған түзу қолмен оқшаулау жаттығуы.",
    exdbId: "Straight-Arm_Pulldown",
  }),
  item({
    id: "lib_back_rope_straight_arm_pulldown",
    name: "Rope Straight-Arm Pulldown",
    nameRu: "Тяга каната прямыми руками",
    nameKk: "Арқанмен түзу қол тартуы",
    muscleGroup: "Back",
    category: "Cable",
    defaultSets: 3,
    defaultReps: 12,
    defaultRestSeconds: 45,
    description: "Lat isolation using rope attachment.",
    descriptionRu: "Изоляция широчайших с канатной рукоятью.",
    descriptionKk: "Арқан тұтқасымен кең арқа бұлшықетін оқшаулау.",
    exdbId: "Rope_Straight-Arm_Pulldown",
  }),
  item({
    id: "lib_back_deadlift",
    name: "Deadlift",
    nameRu: "Становая тяга",
    nameKk: "Өлі тарту",
    muscleGroup: "Back",
    category: "Strength",
    defaultSets: 4,
    defaultReps: 5,
    defaultRestSeconds: 120,
    description: "Heavy compound movement for posterior chain strength.",
    descriptionRu: "Тяжёлое базовое упражнение для силы задней цепи.",
    descriptionKk: "Артқы бұлшықет тізбегінің күшіне арналған ауыр базалық жаттығу.",
    exdbId: "Clean_Deadlift",
  }),
  item({
    id: "lib_back_deadlift_with_bands",
    name: "Deadlift with Bands",
    nameRu: "Становая тяга с резинами",
    nameKk: "Резеңкемен өлі тарту",
    muscleGroup: "Back",
    category: "Powerlifting",
    defaultSets: 4,
    defaultReps: 5,
    defaultRestSeconds: 120,
    description: "Deadlift variation with band resistance.",
    descriptionRu: "Вариант становой тяги с сопротивлением резин.",
    descriptionKk: "Резеңке қарсылығымен орындалатын өлі тарту түрі.",
    exdbId: "Deadlift_with_Bands",
  }),
  item({
    id: "lib_back_hyperextensions",
    name: "Hyperextensions",
    nameRu: "Гиперэкстензия",
    nameKk: "Гиперэкстензия",
    muscleGroup: "Back",
    category: "Strength",
    defaultSets: 3,
    defaultReps: 12,
    defaultRestSeconds: 60,
    description: "Lower back and posterior chain extension movement.",
    descriptionRu: "Разгибание для поясницы и задней цепи.",
    descriptionKk: "Бел және артқы бұлшықет тізбегіне арналған жазылу қозғалысы.",
    exdbId: "Hyperextensions_Back_Extensions",
  }),
  item({
    id: "lib_back_bodyweight_mid_row",
    name: "Bodyweight Mid Row",
    nameRu: "Горизонтальная тяга с собственным весом",
    nameKk: "Өз салмағымен горизонталды тарту",
    muscleGroup: "Back",
    category: "Bodyweight",
    defaultSets: 3,
    defaultReps: 10,
    defaultRestSeconds: 60,
    description: "Bodyweight row for mid-back and lats.",
    descriptionRu: "Тяга с собственным весом для средней части спины и широчайших.",
    descriptionKk: "Ортаңғы арқа мен кең бұлшықетке арналған өз салмағымен тарту.",
    exdbId: "Bodyweight_Mid_Row",
  }),

  item({ id: "lib_legs_barbell_squat", name: "Barbell Squat", nameRu: "Присед со штангой", nameKk: "Штангамен отырып-тұру", muscleGroup: "Legs", category: "Strength", defaultSets: 4, defaultReps: 8, defaultRestSeconds: 120, description: "Main lower-body compound lift for quads and strength.", descriptionRu: "Базовое упражнение для ног, квадрицепсов и силы нижней части тела.", descriptionKk: "Аяқ, квадрицепс және төменгі дене күшіне арналған негізгі жаттығу.", exdbId: "Barbell_Squat" }),
  item({ id: "lib_legs_front_barbell_squat", name: "Front Barbell Squat", nameRu: "Фронтальный присед со штангой", nameKk: "Алдыңғы штангамен отырып-тұру", muscleGroup: "Legs", category: "Strength", defaultSets: 4, defaultReps: 6, defaultRestSeconds: 120, description: "Quad-dominant squat variation with upright posture.", descriptionRu: "Вариант приседа с акцентом на квадрицепсы и прямое положение корпуса.", descriptionKk: "Квадрицепске көбірек әсер ететін тік қалыптағы отырып-тұру.", exdbId: "Front_Barbell_Squat" }),
  item({ id: "lib_legs_leg_press", name: "Leg Press", nameRu: "Жим ногами", nameKk: "Аяқпен сығымдау", muscleGroup: "Legs", category: "Machine", defaultSets: 4, defaultReps: 10, defaultRestSeconds: 90, description: "Machine press for heavy quad-focused training.", descriptionRu: "Тренажёр для тяжёлой тренировки ног с акцентом на квадрицепсы.", descriptionKk: "Квадрицепске екпін беретін ауыр аяқ тренажёры.", exdbId: "Leg_Press" }),
  item({ id: "lib_legs_hack_squat", name: "Hack Squat", nameRu: "Гакк-присед", nameKk: "Гакк отырып-тұру", muscleGroup: "Legs", category: "Machine", defaultSets: 4, defaultReps: 10, defaultRestSeconds: 90, description: "Machine squat variation for controlled leg work.", descriptionRu: "Вариант приседа в тренажёре для контролируемой работы ног.", descriptionKk: "Аяқты бақылаумен жаттықтыруға арналған тренажёрдағы отырып-тұру.", exdbId: "Hack_Squat" }),
  item({ id: "lib_legs_leg_extensions", name: "Leg Extensions", nameRu: "Разгибание ног", nameKk: "Аяқты жазу", muscleGroup: "Legs", category: "Isolation", defaultSets: 3, defaultReps: 12, defaultRestSeconds: 45, description: "Quad isolation exercise with controlled extension.", descriptionRu: "Изолирующее упражнение на квадрицепс с контролируемым разгибанием.", descriptionKk: "Квадрицепске арналған бақылаулы аяқ жазу жаттығуы.", exdbId: "Leg_Extensions" }),
  item({ id: "lib_legs_lying_leg_curls", name: "Lying Leg Curls", nameRu: "Сгибание ног лёжа", nameKk: "Жатып аяқты бүгу", muscleGroup: "Legs", category: "Isolation", defaultSets: 3, defaultReps: 12, defaultRestSeconds: 45, description: "Hamstring isolation exercise.", descriptionRu: "Изолирующее упражнение для задней поверхности бедра.", descriptionKk: "Санның артқы бөлігіне арналған оқшаулау жаттығуы.", exdbId: "Lying_Leg_Curls" }),
  item({ id: "lib_legs_seated_leg_curl", name: "Seated Leg Curl", nameRu: "Сгибание ног сидя", nameKk: "Отырып аяқты бүгу", muscleGroup: "Legs", category: "Isolation", defaultSets: 3, defaultReps: 12, defaultRestSeconds: 45, description: "Seated hamstring curl for controlled contraction.", descriptionRu: "Сгибание ног сидя для контролируемого сокращения бицепса бедра.", descriptionKk: "Санның артқы бөлігін бақылаумен қысқартуға арналған жаттығу.", exdbId: "Seated_Leg_Curl" }),
  item({ id: "lib_legs_dumbbell_lunges", name: "Dumbbell Lunges", nameRu: "Выпады с гантелями", nameKk: "Гантельмен алға түсу", muscleGroup: "Legs", category: "Strength", defaultSets: 3, defaultReps: 10, defaultRestSeconds: 60, description: "Unilateral leg movement for quads, glutes and balance.", descriptionRu: "Одностороннее упражнение для ног, ягодиц и баланса.", descriptionKk: "Аяқ, бөксе және тепе-теңдікке арналған бір жақты жаттығу.", exdbId: "Dumbbell_Lunges" }),
  item({ id: "lib_legs_barbell_lunge", name: "Barbell Lunge", nameRu: "Выпады со штангой", nameKk: "Штангамен алға түсу", muscleGroup: "Legs", category: "Strength", defaultSets: 3, defaultReps: 10, defaultRestSeconds: 75, description: "Loaded lunge variation for lower body strength.", descriptionRu: "Выпады с отягощением для силы нижней части тела.", descriptionKk: "Төменгі дене күшіне арналған салмақпен алға түсу.", exdbId: "Barbell_Lunge" }),
  item({ id: "lib_legs_bodyweight_squat", name: "Bodyweight Squat", nameRu: "Присед с собственным весом", nameKk: "Өз салмағымен отырып-тұру", muscleGroup: "Legs", category: "Bodyweight", defaultSets: 3, defaultReps: 20, defaultRestSeconds: 45, description: "Basic squat pattern without external load.", descriptionRu: "Базовый присед без дополнительного веса.", descriptionKk: "Қосымша салмақсыз негізгі отырып-тұру.", exdbId: "Bodyweight_Squat" }),
  item({ id: "lib_legs_freehand_jump_squat", name: "Freehand Jump Squat", nameRu: "Прыжковый присед", nameKk: "Секіріп отырып-тұру", muscleGroup: "Legs", category: "Plyometrics", defaultSets: 4, defaultReps: 12, defaultRestSeconds: 45, description: "Explosive jump squat variation for power and conditioning.", descriptionRu: "Взрывной присед с прыжком для мощности и выносливости.", descriptionKk: "Күш пен төзімділікке арналған секіріп отырып-тұру.", exdbId: "Freehand_Jump_Squat" }),
  item({ id: "lib_legs_kneeling_jump_squat", name: "Kneeling Jump Squat", nameRu: "Прыжковый присед с колен", nameKk: "Тізеден секіріп отырып-тұру", muscleGroup: "Legs", category: "Plyometrics", defaultSets: 3, defaultReps: 8, defaultRestSeconds: 60, description: "Advanced explosive lower-body movement.", descriptionRu: "Продвинутое взрывное движение для нижней части тела.", descriptionKk: "Төменгі денеге арналған күрделі жарылғыш қозғалыс.", exdbId: "Kneeling_Jump_Squat" }),
  item({ id: "lib_legs_standing_calf_raises", name: "Standing Calf Raises", nameRu: "Подъёмы на икры стоя", nameKk: "Тұрып балтыр көтеру", muscleGroup: "Legs", category: "Isolation", defaultSets: 4, defaultReps: 15, defaultRestSeconds: 45, description: "Standing calf isolation movement.", descriptionRu: "Изолирующее упражнение на икры стоя.", descriptionKk: "Балтырға арналған тұрып орындалатын оқшаулау жаттығуы.", exdbId: "Standing_Calf_Raises" }),
  item({ id: "lib_legs_seated_calf_raise", name: "Seated Calf Raise", nameRu: "Подъёмы на икры сидя", nameKk: "Отырып балтыр көтеру", muscleGroup: "Legs", category: "Isolation", defaultSets: 4, defaultReps: 15, defaultRestSeconds: 45, description: "Seated calf movement focused on soleus.", descriptionRu: "Упражнение на икры сидя с акцентом на камбаловидную мышцу.", descriptionKk: "Камбалатәрізді бұлшықетке екпін беретін отырып балтыр көтеру.", exdbId: "Seated_Calf_Raise" }),
  item({ id: "lib_legs_donkey_calf_raises", name: "Donkey Calf Raises", nameRu: "Ослиные подъёмы на икры", nameKk: "Еңкейіп балтыр көтеру", muscleGroup: "Legs", category: "Isolation", defaultSets: 4, defaultReps: 15, defaultRestSeconds: 45, description: "Calf raise variation with deep stretch.", descriptionRu: "Вариант подъёмов на икры с глубокой растяжкой.", descriptionKk: "Терең созылумен орындалатын балтыр көтеру түрі.", exdbId: "Donkey_Calf_Raises" }),
  item({ id: "lib_legs_trap_bar_deadlift", name: "Trap Bar Deadlift", nameRu: "Становая тяга с трэп-грифом", nameKk: "Трэп-грифпен өлі тарту", muscleGroup: "Legs", category: "Strength", defaultSets: 4, defaultReps: 6, defaultRestSeconds: 120, description: "Trap bar pull with strong leg and hip involvement.", descriptionRu: "Тяга с трэп-грифом с активной работой ног и таза.", descriptionKk: "Аяқ пен жамбас белсенді қатысатын трэп-гриф тартуы.", exdbId: "Trap_Bar_Deadlift" }),

  item({ id: "lib_glutes_barbell_hip_thrust", name: "Barbell Hip Thrust", nameRu: "Ягодичный мост со штангой", nameKk: "Штангамен жамбас көтеру", muscleGroup: "Glutes", category: "Strength", defaultSets: 4, defaultReps: 10, defaultRestSeconds: 90, description: "Main glute strength exercise with strong hip extension.", descriptionRu: "Главное силовое упражнение для ягодиц с мощным разгибанием таза.", descriptionKk: "Жамбасты күшті жазуға арналған негізгі бөксе жаттығуы.", exdbId: "Barbell_Hip_Thrust" }),
  item({ id: "lib_glutes_butt_lift_bridge", name: "Butt Lift Bridge", nameRu: "Ягодичный мост", nameKk: "Бөксе көпірі", muscleGroup: "Glutes", category: "Bodyweight", defaultSets: 3, defaultReps: 15, defaultRestSeconds: 45, description: "Bodyweight glute bridge for activation and control.", descriptionRu: "Ягодичный мост с собственным весом для активации и контроля.", descriptionKk: "Бөксені белсендіру және бақылауға арналған өз салмағымен көпір.", exdbId: "Butt_Lift_Bridge" }),
  item({ id: "lib_glutes_romanian_deadlift", name: "Romanian Deadlift", nameRu: "Румынская тяга", nameKk: "Румын тартуы", muscleGroup: "Glutes", category: "Strength", defaultSets: 4, defaultReps: 8, defaultRestSeconds: 90, description: "Hip hinge exercise for glutes and hamstrings.", descriptionRu: "Тяговое движение для ягодиц и задней поверхности бедра.", descriptionKk: "Бөксе мен санның артқы бөлігіне арналған тарту қозғалысы.", exdbId: "Romanian_Deadlift" }),
  item({ id: "lib_glutes_stiff_legged_barbell_deadlift", name: "Stiff-Legged Barbell Deadlift", nameRu: "Тяга штанги на прямых ногах", nameKk: "Түзу аяқпен штанга тарту", muscleGroup: "Glutes", category: "Strength", defaultSets: 4, defaultReps: 8, defaultRestSeconds: 90, description: "Posterior-chain lift for glutes and hamstrings.", descriptionRu: "Тяга для ягодиц и задней поверхности бедра.", descriptionKk: "Бөксе мен санның артқы бөлігіне арналған тарту.", exdbId: "Stiff-Legged_Barbell_Deadlift" }),
  item({ id: "lib_glutes_stiff_legged_dumbbell_deadlift", name: "Stiff-Legged Dumbbell Deadlift", nameRu: "Тяга гантелей на прямых ногах", nameKk: "Түзу аяқпен гантель тарту", muscleGroup: "Glutes", category: "Strength", defaultSets: 3, defaultReps: 10, defaultRestSeconds: 75, description: "Dumbbell hinge movement for glutes and hamstrings.", descriptionRu: "Тяговое движение с гантелями для ягодиц и бицепса бедра.", descriptionKk: "Бөксе мен санның артқы бөлігіне арналған гантель тартуы.", exdbId: "Stiff-Legged_Dumbbell_Deadlift" }),
  item({ id: "lib_glutes_glute_kickback", name: "Glute Kickback", nameRu: "Отведение ноги назад", nameKk: "Аяқты артқа сермеу", muscleGroup: "Glutes", category: "Isolation", defaultSets: 3, defaultReps: 12, defaultRestSeconds: 45, description: "Glute isolation movement focused on hip extension.", descriptionRu: "Изолирующее движение для ягодиц с разгибанием бедра.", descriptionKk: "Жамбасты жазуға бағытталған бөксе оқшаулау қозғалысы.", exdbId: "Glute_Kickback" }),
  item({ id: "lib_glutes_cable_hip_adduction", name: "Cable Hip Adduction", nameRu: "Приведение бедра в кроссовере", nameKk: "Кроссоверде жамбас әкелу", muscleGroup: "Glutes", category: "Cable", defaultSets: 3, defaultReps: 12, defaultRestSeconds: 45, description: "Cable hip movement for glute and hip control.", descriptionRu: "Движение бедра в кроссовере для контроля ягодиц и таза.", descriptionKk: "Бөксе мен жамбасты бақылауға арналған кроссовер қозғалысы.", exdbId: "Cable_Hip_Adduction" }),
  item({ id: "lib_glutes_step_up_with_knee_raise", name: "Step-up with Knee Raise", nameRu: "Зашагивание с подъёмом колена", nameKk: "Тізені көтеріп қадам жасау", muscleGroup: "Glutes", category: "Strength", defaultSets: 3, defaultReps: 10, defaultRestSeconds: 60, description: "Unilateral glute and leg movement using a box or bench.", descriptionRu: "Одностороннее движение для ягодиц и ног с использованием тумбы или скамьи.", descriptionKk: "Бөксе мен аяққа арналған қорап немесе орындықпен бір жақты қозғалыс.", exdbId: "Step-up_with_Knee_Raise" }),
  item({ id: "lib_glutes_bodyweight_walking_lunge", name: "Bodyweight Walking Lunge", nameRu: "Ходьба выпадами с собственным весом", nameKk: "Өз салмағымен жүріп алға түсу", muscleGroup: "Glutes", category: "Bodyweight", defaultSets: 3, defaultReps: 12, defaultRestSeconds: 45, description: "Dynamic lunge pattern for glutes and legs.", descriptionRu: "Динамические выпады для ягодиц и ног.", descriptionKk: "Бөксе мен аяққа арналған динамикалық алға түсу.", exdbId: "Bodyweight_Walking_Lunge" }),
  item({ id: "lib_glutes_plie_dumbbell_squat", name: "Plie Dumbbell Squat", nameRu: "Плие-присед с гантелью", nameKk: "Гантельмен плие отырып-тұру", muscleGroup: "Glutes", category: "Strength", defaultSets: 3, defaultReps: 12, defaultRestSeconds: 60, description: "Wide-stance squat variation for glutes and inner thighs.", descriptionRu: "Присед с широкой постановкой для ягодиц и внутренней части бедра.", descriptionKk: "Бөксе мен ішкі санға арналған кең қалыптағы отырып-тұру.", exdbId: "Plie_Dumbbell_Squat" }),
  item({ id: "lib_glutes_sumo_deadlift", name: "Sumo Deadlift", nameRu: "Становая тяга сумо", nameKk: "Сумо өлі тартуы", muscleGroup: "Glutes", category: "Strength", defaultSets: 4, defaultReps: 6, defaultRestSeconds: 120, description: "Wide-stance deadlift emphasizing glutes and inner thighs.", descriptionRu: "Становая тяга с широкой стойкой для ягодиц и внутренней части бедра.", descriptionKk: "Бөксе мен ішкі санға екпін беретін кең тұрыстағы өлі тарту.", exdbId: "Sumo_Deadlift" }),

  item({ id: "lib_shoulders_barbell_shoulder_press", name: "Barbell Shoulder Press", nameRu: "Жим штанги стоя", nameKk: "Штанганы жоғары сығымдау", muscleGroup: "Shoulders", category: "Strength", defaultSets: 4, defaultReps: 8, defaultRestSeconds: 90, description: "Main overhead pressing movement for shoulders.", descriptionRu: "Главное жимовое движение над головой для плеч.", descriptionKk: "Иыққа арналған негізгі жоғары сығымдау қозғалысы.", exdbId: "Barbell_Shoulder_Press" }),
  item({ id: "lib_shoulders_seated_barbell_military_press", name: "Seated Barbell Military Press", nameRu: "Армейский жим штанги сидя", nameKk: "Отырып әскери штанга жимі", muscleGroup: "Shoulders", category: "Strength", defaultSets: 4, defaultReps: 8, defaultRestSeconds: 90, description: "Strict seated press for shoulder strength.", descriptionRu: "Строгий жим сидя для силы плеч.", descriptionKk: "Иық күшіне арналған отырып орындалатын қатаң жим.", exdbId: "Seated_Barbell_Military_Press" }),
  item({ id: "lib_shoulders_dumbbell_shoulder_press", name: "Dumbbell Shoulder Press", nameRu: "Жим гантелей на плечи", nameKk: "Гантельді иыққа сығымдау", muscleGroup: "Shoulders", category: "Strength", defaultSets: 3, defaultReps: 10, defaultRestSeconds: 75, description: "Dumbbell overhead press for strength and stability.", descriptionRu: "Жим гантелей над головой для силы и стабильности.", descriptionKk: "Күш пен тұрақтылыққа арналған гантельді жоғары сығымдау.", exdbId: "Dumbbell_Shoulder_Press" }),
  item({ id: "lib_shoulders_arnold_dumbbell_press", name: "Arnold Dumbbell Press", nameRu: "Жим Арнольда", nameKk: "Арнольд жимі", muscleGroup: "Shoulders", category: "Strength", defaultSets: 3, defaultReps: 10, defaultRestSeconds: 75, description: "Rotational dumbbell press for all-around shoulder work.", descriptionRu: "Жим гантелей с разворотом для комплексной работы плеч.", descriptionKk: "Иықты толық дамытуға арналған бұрылмалы гантель жимі.", exdbId: "Arnold_Dumbbell_Press" }),
  item({ id: "lib_shoulders_side_lateral_raise", name: "Side Lateral Raise", nameRu: "Махи гантелями в стороны", nameKk: "Гантельді жанға көтеру", muscleGroup: "Shoulders", category: "Isolation", defaultSets: 3, defaultReps: 15, defaultRestSeconds: 45, description: "Side delt isolation for shoulder width.", descriptionRu: "Изоляция средней дельты для ширины плеч.", descriptionKk: "Иық енін дамытуға арналған орта дельта оқшаулауы.", exdbId: "Side_Lateral_Raise" }),
  item({ id: "lib_shoulders_front_dumbbell_raise", name: "Front Dumbbell Raise", nameRu: "Подъём гантелей перед собой", nameKk: "Гантельді алға көтеру", muscleGroup: "Shoulders", category: "Isolation", defaultSets: 3, defaultReps: 12, defaultRestSeconds: 45, description: "Front delt isolation exercise.", descriptionRu: "Изолирующее упражнение для передней дельты.", descriptionKk: "Алдыңғы дельтаға арналған оқшаулау жаттығуы.", exdbId: "Front_Dumbbell_Raise" }),
  item({ id: "lib_shoulders_bent_over_rear_delt_raise", name: "Bent Over Rear Delt Raise", nameRu: "Махи на заднюю дельту в наклоне", nameKk: "Еңкейіп артқы дельта көтеру", muscleGroup: "Shoulders", category: "Isolation", defaultSets: 3, defaultReps: 15, defaultRestSeconds: 45, description: "Rear delt isolation for shoulder balance.", descriptionRu: "Изоляция задней дельты для баланса плеч.", descriptionKk: "Иық тепе-теңдігі үшін артқы дельта оқшаулауы.", exdbId: "Bent_Over_Dumbbell_Rear_Delt_Raise_With_Head_On_Bench" }),
  item({ id: "lib_shoulders_face_pull", name: "Face Pull", nameRu: "Тяга каната к лицу", nameKk: "Арқанды бетке тарту", muscleGroup: "Shoulders", category: "Cable", defaultSets: 3, defaultReps: 15, defaultRestSeconds: 45, description: "Rear delts and upper-back movement for posture.", descriptionRu: "Упражнение для задних дельт и верхней части спины, полезное для осанки.", descriptionKk: "Артқы дельта мен жоғарғы арқаға, дене қалпына пайдалы қозғалыс.", exdbId: "Face_Pull" }),
  item({ id: "lib_shoulders_upright_barbell_row", name: "Upright Barbell Row", nameRu: "Тяга штанги к подбородку", nameKk: "Штанганы иекке тарту", muscleGroup: "Shoulders", category: "Strength", defaultSets: 3, defaultReps: 10, defaultRestSeconds: 60, description: "Shoulder and upper-trap pulling movement.", descriptionRu: "Тяговое движение для плеч и верхней части трапеций.", descriptionKk: "Иық пен жоғарғы трапецияға арналған тарту қозғалысы.", exdbId: "Upright_Barbell_Row" }),
  item({ id: "lib_shoulders_alternating_deltoid_raise", name: "Alternating Deltoid Raise", nameRu: "Попеременные подъёмы на дельты", nameKk: "Дельтаға кезекпен көтеру", muscleGroup: "Shoulders", category: "Isolation", defaultSets: 3, defaultReps: 12, defaultRestSeconds: 45, description: "Alternating front and side delt raise.", descriptionRu: "Попеременный подъём на переднюю и среднюю дельту.", descriptionKk: "Алдыңғы және орта дельтаға кезекпен көтеру.", exdbId: "Alternating_Deltoid_Raise" }),
  item({ id: "lib_shoulders_arm_circles", name: "Arm Circles", nameRu: "Круги руками", nameKk: "Қолды айналдыру", muscleGroup: "Shoulders", category: "Mobility", defaultSets: 2, defaultReps: 20, defaultRestSeconds: 20, description: "Shoulder warm-up and mobility movement.", descriptionRu: "Разминка и мобилизация плечевых суставов.", descriptionKk: "Иық буындарын қыздыру және қозғалту жаттығуы.", exdbId: "Arm_Circles" }),
  item({ id: "lib_shoulders_dumbbell_shrug", name: "Dumbbell Shrug", nameRu: "Шраги с гантелями", nameKk: "Гантельмен шраг", muscleGroup: "Shoulders", category: "Strength", defaultSets: 4, defaultReps: 12, defaultRestSeconds: 60, description: "Upper-trap focused shoulder accessory movement.", descriptionRu: "Дополнительное упражнение с акцентом на верх трапеции.", descriptionKk: "Жоғарғы трапецияға екпін беретін қосымша жаттығу.", exdbId: "Dumbbell_Shrug" }),

  item({ id: "lib_biceps_barbell_curl", name: "Barbell Curl", nameRu: "Подъём штанги на бицепс", nameKk: "Штанганы бицепске көтеру", muscleGroup: "Biceps", category: "Strength", defaultSets: 3, defaultReps: 10, defaultRestSeconds: 60, description: "Classic biceps mass-building movement.", descriptionRu: "Классическое упражнение для массы бицепса.", descriptionKk: "Бицепс көлемін дамытуға арналған классикалық жаттығу.", exdbId: "Barbell_Curl" }),
  item({ id: "lib_biceps_dumbbell_bicep_curl", name: "Dumbbell Bicep Curl", nameRu: "Подъём гантелей на бицепс", nameKk: "Гантельді бицепске көтеру", muscleGroup: "Biceps", category: "Isolation", defaultSets: 3, defaultReps: 12, defaultRestSeconds: 45, description: "Basic dumbbell curl for biceps control.", descriptionRu: "Базовый подъём гантелей для контроля бицепса.", descriptionKk: "Бицепсті бақылауға арналған негізгі гантель көтеру.", exdbId: "Dumbbell_Bicep_Curl" }),
  item({ id: "lib_biceps_dumbbell_alternate_bicep_curl", name: "Dumbbell Alternate Bicep Curl", nameRu: "Попеременный подъём гантелей", nameKk: "Гантельді кезекпен көтеру", muscleGroup: "Biceps", category: "Isolation", defaultSets: 3, defaultReps: 12, defaultRestSeconds: 45, description: "Alternating dumbbell curl for unilateral control.", descriptionRu: "Попеременный подъём гантелей для контроля каждой руки.", descriptionKk: "Әр қолды бақылауға арналған кезекпен гантель көтеру.", exdbId: "Dumbbell_Alternate_Bicep_Curl" }),
  item({ id: "lib_biceps_alternate_hammer_curl", name: "Alternate Hammer Curl", nameRu: "Попеременный молотковый подъём", nameKk: "Кезекпен балға көтеру", muscleGroup: "Biceps", category: "Isolation", defaultSets: 3, defaultReps: 12, defaultRestSeconds: 45, description: "Hammer curl variation for brachialis and forearms.", descriptionRu: "Молотковый подъём для брахиалиса и предплечий.", descriptionKk: "Брахиалис пен білекке арналған балға көтеру.", exdbId: "Alternate_Hammer_Curl" }),
  item({ id: "lib_biceps_incline_dumbbell_curl", name: "Incline Dumbbell Curl", nameRu: "Подъём гантелей на наклонной скамье", nameKk: "Көлбеу орындықта гантель көтеру", muscleGroup: "Biceps", category: "Isolation", defaultSets: 3, defaultReps: 12, defaultRestSeconds: 45, description: "Incline curl with strong long-head stretch.", descriptionRu: "Подъём на наклонной скамье с хорошей растяжкой длинной головки бицепса.", descriptionKk: "Бицепстің ұзын басын созуға арналған көлбеу орындықтағы көтеру.", exdbId: "Incline_Dumbbell_Curl" }),
  item({ id: "lib_biceps_alternate_incline_dumbbell_curl", name: "Alternate Incline Dumbbell Curl", nameRu: "Попеременный подъём гантелей на наклонной", nameKk: "Көлбеуде гантельді кезекпен көтеру", muscleGroup: "Biceps", category: "Isolation", defaultSets: 3, defaultReps: 12, defaultRestSeconds: 45, description: "Alternating incline curl for biceps isolation.", descriptionRu: "Попеременный подъём на наклонной скамье для изоляции бицепса.", descriptionKk: "Бицепсті оқшаулауға арналған көлбеу орындықтағы кезекпен көтеру.", exdbId: "Alternate_Incline_Dumbbell_Curl" }),
  item({ id: "lib_biceps_concentration_curls", name: "Concentration Curls", nameRu: "Концентрированный подъём", nameKk: "Концентрациялық көтеру", muscleGroup: "Biceps", category: "Isolation", defaultSets: 3, defaultReps: 12, defaultRestSeconds: 45, description: "Strict single-arm curl for peak contraction.", descriptionRu: "Строгий подъём одной рукой для пикового сокращения бицепса.", descriptionKk: "Бицепсті толық қысқарту үшін бір қолмен қатаң көтеру.", exdbId: "Concentration_Curls" }),
  item({ id: "lib_biceps_preacher_curl", name: "Preacher Curl", nameRu: "Подъём на скамье Скотта", nameKk: "Скотт орындығында көтеру", muscleGroup: "Biceps", category: "Machine", defaultSets: 3, defaultReps: 10, defaultRestSeconds: 60, description: "Supported biceps curl with strict form.", descriptionRu: "Подъём на бицепс с опорой для строгой техники.", descriptionKk: "Дұрыс техникаға арналған тірекпен бицепс көтеру.", exdbId: "Preacher_Curl" }),
  item({ id: "lib_biceps_ez_bar_curl", name: "EZ-Bar Curl", nameRu: "Подъём EZ-грифа", nameKk: "EZ-грифті көтеру", muscleGroup: "Biceps", category: "Strength", defaultSets: 3, defaultReps: 10, defaultRestSeconds: 60, description: "Comfortable bar curl variation for biceps.", descriptionRu: "Удобный вариант подъёма штанги на бицепс.", descriptionKk: "Бицепске арналған ыңғайлы гриф көтеру түрі.", exdbId: "EZ-Bar_Curl" }),
  item({ id: "lib_biceps_cable_hammer_curl", name: "Cable Hammer Curl", nameRu: "Молотковый подъём в кроссовере", nameKk: "Кроссоверде балға көтеру", muscleGroup: "Biceps", category: "Cable", defaultSets: 3, defaultReps: 12, defaultRestSeconds: 45, description: "Cable hammer curl with rope attachment.", descriptionRu: "Молотковый подъём с канатной рукоятью в кроссовере.", descriptionKk: "Арқан тұтқасымен кроссоверде балға көтеру.", exdbId: "Cable_Hammer_Curls_-_Rope_Attachment" }),
  item({ id: "lib_biceps_overhead_cable_curl", name: "Overhead Cable Curl", nameRu: "Подъём на бицепс в верхнем кроссовере", nameKk: "Жоғары кроссоверде бицепс көтеру", muscleGroup: "Biceps", category: "Cable", defaultSets: 3, defaultReps: 12, defaultRestSeconds: 45, description: "Cable curl variation with arms elevated.", descriptionRu: "Вариант подъёма на бицепс с поднятыми руками в кроссовере.", descriptionKk: "Қол жоғары тұрған кроссовердегі бицепс көтеру түрі.", exdbId: "Overhead_Cable_Curl" }),
  item({ id: "lib_biceps_zottman_curl", name: "Zottman Curl", nameRu: "Подъём Зоттмана", nameKk: "Зоттман көтеруі", muscleGroup: "Biceps", category: "Isolation", defaultSets: 3, defaultReps: 10, defaultRestSeconds: 60, description: "Curl variation targeting biceps and forearms.", descriptionRu: "Вариант подъёма для бицепса и предплечий.", descriptionKk: "Бицепс пен білекке арналған көтеру түрі.", exdbId: "Zottman_Curl" }),

  item({ id: "lib_triceps_pushdown", name: "Triceps Pushdown", nameRu: "Разгибание рук на трицепс", nameKk: "Трицепске төмен басу", muscleGroup: "Triceps", category: "Cable", defaultSets: 3, defaultReps: 12, defaultRestSeconds: 45, description: "Cable triceps isolation movement.", descriptionRu: "Изолирующее движение на трицепс в кроссовере.", descriptionKk: "Кроссоверде трицепсті оқшаулау қозғалысы.", exdbId: "Triceps_Pushdown" }),
  item({ id: "lib_triceps_rope_pushdown", name: "Triceps Pushdown - Rope Attachment", nameRu: "Разгибание рук с канатом", nameKk: "Арқанмен трицепс төмен басу", muscleGroup: "Triceps", category: "Cable", defaultSets: 3, defaultReps: 12, defaultRestSeconds: 45, description: "Rope pushdown for strong triceps lockout.", descriptionRu: "Разгибание с канатом для сильного сокращения трицепса.", descriptionKk: "Трицепсті жақсы қысқартуға арналған арқанмен төмен басу.", exdbId: "Triceps_Pushdown_-_Rope_Attachment" }),
  item({ id: "lib_triceps_lying_triceps_press", name: "Lying Triceps Press", nameRu: "Французский жим лёжа", nameKk: "Жатып француз жимі", muscleGroup: "Triceps", category: "Strength", defaultSets: 3, defaultReps: 10, defaultRestSeconds: 60, description: "Lying triceps extension for size and strength.", descriptionRu: "Разгибание лёжа для массы и силы трицепса.", descriptionKk: "Трицепс көлемі мен күшіне арналған жатып жазу.", exdbId: "Lying_Triceps_Press" }),
  item({ id: "lib_triceps_close_grip_barbell_bench_press", name: "Close-Grip Barbell Bench Press", nameRu: "Жим штанги узким хватом", nameKk: "Штанганы тар ұстаумен жатып сығымдау", muscleGroup: "Triceps", category: "Strength", defaultSets: 4, defaultReps: 8, defaultRestSeconds: 90, description: "Compound press with triceps emphasis.", descriptionRu: "Базовый жим с акцентом на трицепс.", descriptionKk: "Трицепске екпін беретін базалық жим.", exdbId: "Close-Grip_Barbell_Bench_Press" }),
  item({ id: "lib_triceps_standing_overhead_barbell_extension", name: "Standing Overhead Barbell Triceps Extension", nameRu: "Разгибание штанги из-за головы стоя", nameKk: "Тұрып бастан жоғары штанга жазу", muscleGroup: "Triceps", category: "Strength", defaultSets: 3, defaultReps: 10, defaultRestSeconds: 60, description: "Overhead extension for long-head triceps work.", descriptionRu: "Разгибание над головой для длинной головки трицепса.", descriptionKk: "Трицепстің ұзын басына арналған бастан жоғары жазу.", exdbId: "Standing_Overhead_Barbell_Triceps_Extension" }),
  item({ id: "lib_triceps_seated_triceps_press", name: "Seated Triceps Press", nameRu: "Жим на трицепс сидя", nameKk: "Отырып трицепс жимі", muscleGroup: "Triceps", category: "Strength", defaultSets: 3, defaultReps: 10, defaultRestSeconds: 60, description: "Seated overhead triceps press with dumbbell.", descriptionRu: "Разгибание на трицепс сидя с гантелью над головой.", descriptionKk: "Отырып гантельмен бастан жоғары трицепс жазу.", exdbId: "Seated_Triceps_Press" }),
  item({ id: "lib_triceps_dips", name: "Dips - Triceps Version", nameRu: "Отжимания на брусьях для трицепса", nameKk: "Трицепске арналған брусьядағы итерілу", muscleGroup: "Triceps", category: "Bodyweight", defaultSets: 3, defaultReps: 10, defaultRestSeconds: 60, description: "Parallel bar dip variation focused on triceps.", descriptionRu: "Вариант отжиманий на брусьях с акцентом на трицепс.", descriptionKk: "Трицепске екпін беретін брусьядағы итерілу.", exdbId: "Dips_-_Triceps_Version" }),
  item({ id: "lib_triceps_bench_dips", name: "Bench Dips", nameRu: "Обратные отжимания от скамьи", nameKk: "Орындықтан кері итерілу", muscleGroup: "Triceps", category: "Bodyweight", defaultSets: 3, defaultReps: 12, defaultRestSeconds: 45, description: "Bodyweight triceps exercise using a bench.", descriptionRu: "Упражнение на трицепс с собственным весом от скамьи.", descriptionKk: "Орындықпен өз салмағымен орындалатын трицепс жаттығуы.", exdbId: "Bench_Dips" }),
  item({ id: "lib_triceps_dumbbell_one_arm_extension", name: "Dumbbell One-Arm Triceps Extension", nameRu: "Разгибание гантели одной рукой", nameKk: "Бір қолмен гантельді трицепске жазу", muscleGroup: "Triceps", category: "Isolation", defaultSets: 3, defaultReps: 12, defaultRestSeconds: 45, description: "Single-arm overhead dumbbell triceps extension.", descriptionRu: "Разгибание гантели одной рукой над головой.", descriptionKk: "Бір қолмен гантельді бастан жоғары жазу.", exdbId: "Dumbbell_One-Arm_Triceps_Extension" }),
  item({ id: "lib_triceps_body_tricep_press", name: "Body Tricep Press", nameRu: "Жим на трицепс с собственным весом", nameKk: "Өз салмағымен трицепс жимі", muscleGroup: "Triceps", category: "Bodyweight", defaultSets: 3, defaultReps: 12, defaultRestSeconds: 45, description: "Bodyweight triceps press variation.", descriptionRu: "Вариант жима на трицепс с собственным весом.", descriptionKk: "Өз салмағымен орындалатын трицепс жимі.", exdbId: "Body_Tricep_Press" }),

  item({ id: "lib_abs_air_bike", name: "Air Bike", nameRu: "Велосипед на пресс", nameKk: "Пресске велосипед", muscleGroup: "Abs", category: "Bodyweight", defaultSets: 3, defaultReps: 20, defaultRestSeconds: 30, description: "Dynamic core movement for abs and obliques.", descriptionRu: "Динамическое упражнение для пресса и косых мышц.", descriptionKk: "Пресс пен қиғаш бұлшықеттерге арналған динамикалық жаттығу.", exdbId: "Air_Bike" }),
  item({ id: "lib_abs_crunches", name: "Crunches", nameRu: "Скручивания", nameKk: "Кранч", muscleGroup: "Abs", category: "Bodyweight", defaultSets: 3, defaultReps: 20, defaultRestSeconds: 30, description: "Classic abdominal crunch exercise.", descriptionRu: "Классическое упражнение на мышцы пресса.", descriptionKk: "Пресс бұлшықеттеріне арналған классикалық жаттығу.", exdbId: "Crunches" }),
  item({ id: "lib_abs_ab_crunch_machine", name: "Ab Crunch Machine", nameRu: "Скручивания в тренажёре", nameKk: "Тренажёрда пресс бүгу", muscleGroup: "Abs", category: "Machine", defaultSets: 3, defaultReps: 12, defaultRestSeconds: 45, description: "Machine-based weighted abdominal crunch.", descriptionRu: "Скручивания в тренажёре с отягощением.", descriptionKk: "Салмақпен тренажёрда орындалатын пресс бүгу.", exdbId: "Ab_Crunch_Machine" }),
  item({ id: "lib_abs_cable_crunch", name: "Cable Crunch", nameRu: "Скручивания в кроссовере", nameKk: "Кроссоверде пресс бүгу", muscleGroup: "Abs", category: "Cable", defaultSets: 3, defaultReps: 12, defaultRestSeconds: 45, description: "Weighted cable crunch for abdominal strength.", descriptionRu: "Скручивания в кроссовере для силы пресса.", descriptionKk: "Пресс күшіне арналған кроссовердегі бүгу.", exdbId: "Cable_Crunch" }),
  item({ id: "lib_abs_hanging_leg_raise", name: "Hanging Leg Raise", nameRu: "Подъём ног в висе", nameKk: "Асылып аяқ көтеру", muscleGroup: "Abs", category: "Bodyweight", defaultSets: 3, defaultReps: 12, defaultRestSeconds: 60, description: "Advanced lower-ab exercise from a hanging position.", descriptionRu: "Продвинутое упражнение на нижний пресс в висе.", descriptionKk: "Асылып орындалатын төменгі пресс жаттығуы.", exdbId: "Hanging_Leg_Raise" }),
  item({ id: "lib_abs_flat_bench_lying_leg_raise", name: "Flat Bench Lying Leg Raise", nameRu: "Подъём ног лёжа на скамье", nameKk: "Орындықта жатып аяқ көтеру", muscleGroup: "Abs", category: "Bodyweight", defaultSets: 3, defaultReps: 15, defaultRestSeconds: 45, description: "Leg raise variation performed on a flat bench.", descriptionRu: "Вариант подъёма ног на горизонтальной скамье.", descriptionKk: "Тегіс орындықта орындалатын аяқ көтеру түрі.", exdbId: "Flat_Bench_Lying_Leg_Raise" }),
  item({ id: "lib_abs_decline_crunch", name: "Decline Crunch", nameRu: "Скручивания на наклонной скамье", nameKk: "Көлбеу орындықта кранч", muscleGroup: "Abs", category: "Bodyweight", defaultSets: 3, defaultReps: 15, defaultRestSeconds: 45, description: "Crunch variation on a decline bench.", descriptionRu: "Вариант скручиваний на наклонной скамье.", descriptionKk: "Көлбеу орындықта орындалатын кранч түрі.", exdbId: "Decline_Crunch" }),
  item({ id: "lib_abs_jackknife_sit_up", name: "Jackknife Sit-Up", nameRu: "Складка", nameKk: "Жиналу жаттығуы", muscleGroup: "Abs", category: "Bodyweight", defaultSets: 3, defaultReps: 15, defaultRestSeconds: 45, description: "Full-body ab contraction exercise.", descriptionRu: "Упражнение на пресс с одновременным подъёмом корпуса и ног.", descriptionKk: "Дене мен аяқты бірге көтеретін пресс жаттығуы.", exdbId: "Jackknife_Sit-Up" }),
  item({ id: "lib_abs_ab_roller", name: "Ab Roller", nameRu: "Ролик для пресса", nameKk: "Пресс ролигі", muscleGroup: "Abs", category: "Strength", defaultSets: 3, defaultReps: 10, defaultRestSeconds: 60, description: "Anti-extension core exercise using an ab wheel.", descriptionRu: "Упражнение на корпус с роликом для пресса.", descriptionKk: "Пресс ролигімен корпусқа арналған жаттығу.", exdbId: "Ab_Roller" }),
  item({ id: "lib_abs_barbell_ab_rollout", name: "Barbell Ab Rollout", nameRu: "Раскат со штангой на пресс", nameKk: "Штангамен пресс роллаут", muscleGroup: "Abs", category: "Strength", defaultSets: 3, defaultReps: 10, defaultRestSeconds: 60, description: "Ab rollout variation using a barbell.", descriptionRu: "Вариант роллаута на пресс со штангой.", descriptionKk: "Штангамен орындалатын пресс роллаут түрі.", exdbId: "Barbell_Ab_Rollout_-_On_Knees" }),
  item({ id: "lib_abs_alternate_heel_touchers", name: "Alternate Heel Touchers", nameRu: "Касания пяток", nameKk: "Өкшеге кезекпен тию", muscleGroup: "Abs", category: "Bodyweight", defaultSets: 3, defaultReps: 20, defaultRestSeconds: 30, description: "Oblique-focused side crunch movement.", descriptionRu: "Боковые скручивания с акцентом на косые мышцы.", descriptionKk: "Қиғаш пресс бұлшықеттеріне арналған бүйірлік қозғалыс.", exdbId: "Alternate_Heel_Touchers" }),
  item({ id: "lib_abs_dead_bug", name: "Dead Bug", nameRu: "Мёртвый жук", nameKk: "Өлі қоңыз", muscleGroup: "Abs", category: "Bodyweight", defaultSets: 3, defaultReps: 10, defaultRestSeconds: 30, description: "Core stability exercise with controlled movement.", descriptionRu: "Упражнение на стабильность корпуса с контролируемым движением.", descriptionKk: "Бақылаулы қозғалыспен корпус тұрақтылығына арналған жаттығу.", exdbId: "Dead_Bug" }),

  item({ id: "lib_cardio_running_treadmill", name: "Running - Treadmill", nameRu: "Беговая дорожка", nameKk: "Жүгіру жолы", muscleGroup: "Cardio", category: "Cardio", defaultSets: 1, defaultReps: 20, defaultRestSeconds: 0, description: "Treadmill running session. Reps represent minutes.", descriptionRu: "Беговая сессия на дорожке. Повторы означают минуты.", descriptionKk: "Жүгіру жолындағы кардио. Қайталау минутты білдіреді.", exdbId: "Running_Treadmill" }),
  item({ id: "lib_cardio_bicycling_stationary", name: "Bicycling - Stationary", nameRu: "Велотренажёр", nameKk: "Велотренажёр", muscleGroup: "Cardio", category: "Cardio", defaultSets: 1, defaultReps: 25, defaultRestSeconds: 0, description: "Indoor cycling cardio session. Reps represent minutes.", descriptionRu: "Кардио на велотренажёре. Повторы означают минуты.", descriptionKk: "Велотренажёрдегі кардио. Қайталау минутты білдіреді.", exdbId: "Bicycling_Stationary" }),
  item({ id: "lib_cardio_elliptical_trainer", name: "Elliptical Trainer", nameRu: "Эллиптический тренажёр", nameKk: "Эллиптикалық тренажёр", muscleGroup: "Cardio", category: "Cardio", defaultSets: 1, defaultReps: 20, defaultRestSeconds: 0, description: "Low-impact cardio session. Reps represent minutes.", descriptionRu: "Кардио с низкой ударной нагрузкой. Повторы означают минуты.", descriptionKk: "Жеңіл соққы жүктемесі бар кардио. Қайталау минутты білдіреді.", exdbId: "Elliptical_Trainer" }),
  item({ id: "lib_cardio_rowing_stationary", name: "Rowing - Stationary", nameRu: "Гребной тренажёр", nameKk: "Есу тренажёрі", muscleGroup: "Cardio", category: "Cardio", defaultSets: 1, defaultReps: 15, defaultRestSeconds: 0, description: "Full-body rowing cardio. Reps represent minutes.", descriptionRu: "Кардио на всё тело на гребном тренажёре. Повторы означают минуты.", descriptionKk: "Бүкіл денеге арналған есу кардиосы. Қайталау минутты білдіреді.", exdbId: "Rowing_Stationary" }),
  item({ id: "lib_cardio_rope_jumping", name: "Rope Jumping", nameRu: "Прыжки на скакалке", nameKk: "Секіртпемен секіру", muscleGroup: "Cardio", category: "Conditioning", defaultSets: 4, defaultReps: 60, defaultRestSeconds: 30, description: "Jump rope intervals. Reps represent seconds.", descriptionRu: "Интервалы со скакалкой. Повторы означают секунды.", descriptionKk: "Секіртпемен интервал. Қайталау секундты білдіреді.", exdbId: "Rope_Jumping" }),
  item({ id: "lib_cardio_mountain_climbers", name: "Mountain Climbers", nameRu: "Альпинист", nameKk: "Альпинист", muscleGroup: "Cardio", category: "Conditioning", defaultSets: 4, defaultReps: 30, defaultRestSeconds: 30, description: "High-intensity core and cardio movement.", descriptionRu: "Интенсивное движение для корпуса и кардио.", descriptionKk: "Корпус пен кардиоға арналған жоғары қарқынды қозғалыс.", exdbId: "Mountain_Climbers" }),
  item({ id: "lib_cardio_freehand_jump_squat", name: "Freehand Jump Squat", nameRu: "Прыжковый присед", nameKk: "Секіріп отырып-тұру", muscleGroup: "Cardio", category: "Plyometrics", defaultSets: 4, defaultReps: 12, defaultRestSeconds: 45, description: "Explosive bodyweight squat jump for conditioning.", descriptionRu: "Взрывной присед с прыжком для выносливости.", descriptionKk: "Төзімділікке арналған жарылғыш секіріп отырып-тұру.", exdbId: "Freehand_Jump_Squat" }),
  item({ id: "lib_cardio_kneeling_jump_squat", name: "Kneeling Jump Squat", nameRu: "Прыжковый присед с колен", nameKk: "Тізеден секіріп отырып-тұру", muscleGroup: "Cardio", category: "Plyometrics", defaultSets: 3, defaultReps: 8, defaultRestSeconds: 60, description: "Advanced explosive jump squat variation.", descriptionRu: "Продвинутый взрывной вариант прыжкового приседа.", descriptionKk: "Секіріп отырып-тұрудың күрделі жарылғыш түрі.", exdbId: "Kneeling_Jump_Squat" }),
  item({ id: "lib_cardio_box_jump", name: "Box Jump", nameRu: "Прыжок на тумбу", nameKk: "Қорапқа секіру", muscleGroup: "Cardio", category: "Plyometrics", defaultSets: 4, defaultReps: 10, defaultRestSeconds: 60, description: "Explosive lower-body plyometric exercise.", descriptionRu: "Плиометрическое упражнение для взрывной силы ног.", descriptionKk: "Аяқтың жарылғыш күшіне арналған плиометрикалық жаттығу.", exdbId: "Box_Jump_Multiple_Response" }),
  item({ id: "lib_cardio_side_to_side_box_shuffle", name: "Side to Side Box Shuffle", nameRu: "Боковые шаги через тумбу", nameKk: "Қораппен жан-жаққа қозғалу", muscleGroup: "Cardio", category: "Conditioning", defaultSets: 4, defaultReps: 30, defaultRestSeconds: 30, description: "Lateral conditioning movement using a box.", descriptionRu: "Боковое движение на выносливость с использованием тумбы.", descriptionKk: "Қораппен бүйірлік төзімділік қозғалысы.", exdbId: "Side_to_Side_Box_Shuffle" }),
  item({ id: "lib_cardio_step_mill", name: "Step Mill", nameRu: "Степпер-лестница", nameKk: "Баспалдақ тренажёрі", muscleGroup: "Cardio", category: "Cardio", defaultSets: 1, defaultReps: 20, defaultRestSeconds: 0, description: "Stair-climbing cardio session. Reps represent minutes.", descriptionRu: "Кардио на лестничном тренажёре. Повторы означают минуты.", descriptionKk: "Баспалдақ тренажёріндегі кардио. Қайталау минутты білдіреді.", exdbId: "Step_Mill" }),
  item({ id: "lib_cardio_trail_running_walking", name: "Trail Running / Walking", nameRu: "Бег или ходьба на улице", nameKk: "Далада жүгіру немесе жүру", muscleGroup: "Cardio", category: "Cardio", defaultSets: 1, defaultReps: 30, defaultRestSeconds: 0, description: "Outdoor cardio session. Reps represent minutes.", descriptionRu: "Кардио на улице. Повторы означают минуты.", descriptionKk: "Даладағы кардио. Қайталау минутты білдіреді.", exdbId: "Trail_Running_Walking" }),

  item({ id: "lib_stretching_90_90_hamstring", name: "90/90 Hamstring", nameRu: "Растяжка задней поверхности бедра 90/90", nameKk: "90/90 сан артқы бөлігін созу", muscleGroup: "Stretching", category: "Mobility", defaultSets: 2, defaultReps: 10, defaultRestSeconds: 15, description: "Hamstring mobility movement.", descriptionRu: "Упражнение на мобильность задней поверхности бедра.", descriptionKk: "Санның артқы бөлігінің қозғалғыштығына арналған жаттығу.", exdbId: "90_90_Hamstring" }),
  item({ id: "lib_stretching_adductor", name: "Adductor Stretch", nameRu: "Растяжка приводящих мышц", nameKk: "Ішкі сан бұлшықетін созу", muscleGroup: "Stretching", category: "Mobility", defaultSets: 2, defaultReps: 45, defaultRestSeconds: 15, description: "Inner-thigh mobility and recovery stretch.", descriptionRu: "Растяжка внутренней части бедра для мобильности и восстановления.", descriptionKk: "Ішкі санды қалпына келтіру және қозғалғыштыққа арналған созу.", exdbId: "Adductor" }),
  item({ id: "lib_stretching_adductor_groin", name: "Adductor/Groin Stretch", nameRu: "Растяжка паха и приводящих", nameKk: "Шап және ішкі санды созу", muscleGroup: "Stretching", category: "Mobility", defaultSets: 2, defaultReps: 45, defaultRestSeconds: 15, description: "Groin and adductor flexibility stretch.", descriptionRu: "Растяжка паха и приводящих мышц для гибкости.", descriptionKk: "Икемділікке арналған шап және ішкі сан созуы.", exdbId: "Adductor_Groin" }),
  item({ id: "lib_stretching_all_fours_quad", name: "All Fours Quad Stretch", nameRu: "Растяжка квадрицепса на четвереньках", nameKk: "Төрттағанда квадрицепсті созу", muscleGroup: "Stretching", category: "Mobility", defaultSets: 2, defaultReps: 30, defaultRestSeconds: 15, description: "Quadriceps and hip flexor stretch.", descriptionRu: "Растяжка квадрицепса и сгибателей бедра.", descriptionKk: "Квадрицепс пен жамбас бүккіштерін созу.", exdbId: "All_Fours_Quad_Stretch" }),
  item({ id: "lib_stretching_ankle_circles", name: "Ankle Circles", nameRu: "Круги стопой", nameKk: "Тобықты айналдыру", muscleGroup: "Stretching", category: "Mobility", defaultSets: 2, defaultReps: 15, defaultRestSeconds: 15, description: "Ankle mobility warm-up movement.", descriptionRu: "Разминочное движение для мобильности голеностопа.", descriptionKk: "Тобық қозғалғыштығына арналған қыздыру қозғалысы.", exdbId: "Ankle_Circles" }),
  item({ id: "lib_stretching_ankle_on_the_knee", name: "Ankle On The Knee", nameRu: "Лодыжка на колене", nameKk: "Тобықты тізеге қою", muscleGroup: "Stretching", category: "Mobility", defaultSets: 2, defaultReps: 45, defaultRestSeconds: 15, description: "Glute and hip stretch. Reps represent seconds.", descriptionRu: "Растяжка ягодиц и таза. Повторы означают секунды.", descriptionKk: "Бөксе мен жамбас созуы. Қайталау секундты білдіреді.", exdbId: "Ankle_On_The_Knee" }),
  item({ id: "lib_stretching_arm_circles", name: "Arm Circles", nameRu: "Круги руками", nameKk: "Қолды айналдыру", muscleGroup: "Stretching", category: "Mobility", defaultSets: 2, defaultReps: 20, defaultRestSeconds: 15, description: "Shoulder warm-up and mobility movement.", descriptionRu: "Разминка и мобилизация плеч.", descriptionKk: "Иықты қыздыру және қозғалту.", exdbId: "Arm_Circles" }),
  item({ id: "lib_stretching_cat_stretch", name: "Cat Stretch", nameRu: "Кошка", nameKk: "Мысық созылуы", muscleGroup: "Stretching", category: "Mobility", defaultSets: 2, defaultReps: 10, defaultRestSeconds: 15, description: "Spine mobility stretch for warm-up or recovery.", descriptionRu: "Растяжка для мобильности позвоночника и восстановления.", descriptionKk: "Омыртқа қозғалғыштығы мен қалпына келуге арналған созылу.", exdbId: "Cat_Stretch" }),
  item({ id: "lib_stretching_childs_pose", name: "Child's Pose", nameRu: "Поза ребёнка", nameKk: "Бала позасы", muscleGroup: "Stretching", category: "Recovery", defaultSets: 2, defaultReps: 60, defaultRestSeconds: 15, description: "Relaxing recovery pose for back and hips.", descriptionRu: "Расслабляющая восстановительная поза для спины и таза.", descriptionKk: "Арқа мен жамбасқа арналған қалпына келтіруші босаңсу позасы.", exdbId: "Childs_Pose" }),
  item({ id: "lib_stretching_kneeling_hip_flexor", name: "Kneeling Hip Flexor", nameRu: "Растяжка сгибателя бедра с колена", nameKk: "Тізеде жамбас бүккішін созу", muscleGroup: "Stretching", category: "Mobility", defaultSets: 2, defaultReps: 45, defaultRestSeconds: 15, description: "Hip flexor stretch for mobility and posture.", descriptionRu: "Растяжка сгибателей бедра для мобильности и осанки.", descriptionKk: "Қозғалғыштық пен қалыпқа арналған жамбас бүккішін созу.", exdbId: "Kneeling_Hip_Flexor" }),
  item({ id: "lib_stretching_standing_hamstring_calf", name: "Standing Hamstring and Calf Stretch", nameRu: "Растяжка задней поверхности бедра и икр стоя", nameKk: "Тұрып сан артқы бөлігі мен балтырды созу", muscleGroup: "Stretching", category: "Mobility", defaultSets: 2, defaultReps: 45, defaultRestSeconds: 15, description: "Posterior chain stretch for hamstrings and calves.", descriptionRu: "Растяжка задней цепи: бицепса бедра и икр.", descriptionKk: "Санның артқы бөлігі мен балтырға арналған созылу.", exdbId: "Standing_Hamstring_and_Calf_Stretch" }),
  item({ id: "lib_stretching_round_world_shoulder", name: "Round The World Shoulder Stretch", nameRu: "Круговая растяжка плеч", nameKk: "Иықты айналдыра созу", muscleGroup: "Stretching", category: "Mobility", defaultSets: 2, defaultReps: 10, defaultRestSeconds: 15, description: "Shoulder and chest mobility movement.", descriptionRu: "Движение для мобильности плеч и груди.", descriptionKk: "Иық пен кеуде қозғалғыштығына арналған қозғалыс.", exdbId: "Round_The_World_Shoulder_Stretch" }),
];


export type SupplementSuggestion = {
  name: string;
  nameRu?: string;
  nameKk?: string;
  dosage: string;
  timesPerDay: number;
  specificTimes: string[];
};

export function getSupplementName(
  supplement: Pick<SupplementSuggestion, "name" | "nameRu" | "nameKk">,
  lang: AppLangCode,
): string {
  if (lang === "ru" && supplement.nameRu) return supplement.nameRu;
  if (lang === "kk" && supplement.nameKk) return supplement.nameKk;

  return supplement.name;
}

export function translateSupplementName(name: string, lang: AppLangCode): string {
  const normalized = name.trim().toLowerCase();

  const found = SUPPLEMENT_SUGGESTIONS.find(
    (item) =>
      item.name.trim().toLowerCase() === normalized ||
      item.nameRu?.trim().toLowerCase() === normalized ||
      item.nameKk?.trim().toLowerCase() === normalized,
  );

  if (!found) return name;

  return getSupplementName(found, lang);
}

export const SUPPLEMENT_SUGGESTIONS: SupplementSuggestion[] = [
  {
    name: "Whey Protein",
    nameRu: "Сывороточный протеин",
    nameKk: "Сарысу протеині",
    dosage: "30g",
    timesPerDay: 1,
    specificTimes: ["09:00"],
  },
  {
    name: "Creatine",
    nameRu: "Креатин",
    nameKk: "Креатин",
    dosage: "5g",
    timesPerDay: 1,
    specificTimes: ["13:00"],
  },
  {
    name: "Omega-3",
    nameRu: "Омега-3",
    nameKk: "Омега-3",
    dosage: "1000mg",
    timesPerDay: 2,
    specificTimes: ["09:00", "20:00"],
  },
  {
    name: "Vitamin D",
    nameRu: "Витамин D",
    nameKk: "D дәрумені",
    dosage: "2000 IU",
    timesPerDay: 1,
    specificTimes: ["09:00"],
  },
  {
    name: "Magnesium",
    nameRu: "Магний",
    nameKk: "Магний",
    dosage: "400mg",
    timesPerDay: 1,
    specificTimes: ["21:30"],
  },
  {
    name: "Multivitamin",
    nameRu: "Мультивитамин",
    nameKk: "Мультивитамин",
    dosage: "1 tab",
    timesPerDay: 1,
    specificTimes: ["08:00"],
  },
  {
    name: "BCAA",
    nameRu: "BCAA",
    nameKk: "BCAA",
    dosage: "10g",
    timesPerDay: 1,
    specificTimes: ["12:00"],
  },
  {
    name: "Electrolytes",
    nameRu: "Электролиты",
    nameKk: "Электролиттер",
    dosage: "1 sachet",
    timesPerDay: 1,
    specificTimes: ["10:00"],
  },
  {
    name: "Pre-workout",
    nameRu: "Предтренировочный комплекс",
    nameKk: "Жаттығу алдындағы кешен",
    dosage: "1 scoop",
    timesPerDay: 1,
    specificTimes: ["17:00"],
  },
  {
    name: "Casein Protein",
    nameRu: "Казеиновый протеин",
    nameKk: "Казеин протеині",
    dosage: "30g",
    timesPerDay: 1,
    specificTimes: ["22:00"],
  },
  {
    name: "Collagen",
    nameRu: "Коллаген",
    nameKk: "Коллаген",
    dosage: "10g",
    timesPerDay: 1,
    specificTimes: ["09:00"],
  },
  {
    name: "Zinc",
    nameRu: "Цинк",
    nameKk: "Мырыш",
    dosage: "15mg",
    timesPerDay: 1,
    specificTimes: ["21:00"],
  },
  {
    name: "L-Carnitine",
    nameRu: "L-карнитин",
    nameKk: "L-карнитин",
    dosage: "1500mg",
    timesPerDay: 1,
    specificTimes: ["16:30"],
  },
  {
    name: "Glutamine",
    nameRu: "Глютамин",
    nameKk: "Глютамин",
    dosage: "5g",
    timesPerDay: 1,
    specificTimes: ["21:00"],
  },
  {
    name: "Ashwagandha",
    nameRu: "Ашваганда",
    nameKk: "Ашваганда",
    dosage: "600mg",
    timesPerDay: 1,
    specificTimes: ["21:30"],
  },
  {
    name: "Caffeine",
    nameRu: "Кофеин",
    nameKk: "Кофеин",
    dosage: "100mg",
    timesPerDay: 1,
    specificTimes: ["16:30"],
  },
];