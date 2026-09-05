import type {
  AppState,
  CheckIn,
  Client,
  CoachNote,
  Exercise,
  Meal,
  MealType,
  Payment,
  PaymentMethod,
  PaymentStatus,
  PlanItem,
  Session,
  SessionStatus,
  SubscriptionPaymentStatus,
  Subscription,
} from "./types";
import { addDays, todayISO, uid } from "./lib";

let tick = 0;
const ts = (daysAgo: number) => Date.now() - daysAgo * 86400000 - ++tick * 1000;

export function makeSeed(): AppState {
  tick = 0;
  const today = todayISO();
  const d = (n: number) => addDays(today, n);

  const coachId = "coach-demo-0001";

  const clients: Client[] = [
    {
      id: "c-maya",
      coachId,
      username: "maya_rodriguez",
      name: "Maya Rodriguez",
      email: "maya.r@gmail.com",
      phone: "+20 101 245 7836",
      age: 29,
      gender: "Female",
      goal: "Lose weight",
      startDate: d(-70),
      status: "Active",
      notes: "Prefers evening sessions. Knee is sensitive — swap jump landings for low-impact.",
      followUpDays: 3,
      lastFollowUp: d(-1),
      coachNotes: [
        { id: "cn-m1", text: "Ask about sleep quality — mentioned stress at work.", createdAt: ts(-6) },
        { id: "cn-m2", text: "Knee felt fine on box squats. Keep tempo work.", createdAt: ts(-2) },
      ],
      nutritionTargets: { calories: 1750, protein: 130, carbs: 150, fats: 55, water: 2.5 },
    },
    {
      id: "c-jamal",
      coachId,
      username: "jamal_carter",
      name: "Jamal Carter",
      email: "jamal.carter@outlook.com",
      phone: "01098224571",
      age: 24,
      gender: "Male",
      goal: "Build muscle",
      startDate: d(-42),
      status: "Active",
      notes: "Bulking phase +300 kcal. Push progressive overload on squat & bench every week.",
      followUpDays: 7,
      coachNotes: [{ id: "cn-j1", text: "Deadlift form video reviewed — good. Add 2.5kg next week.", createdAt: ts(-4) }],
      nutritionTargets: { calories: 3100, protein: 180, carbs: 360, fats: 90, water: 3 },
    },
    {
      id: "c-priya",
      coachId,
      username: "priya_nair",
      name: "Priya Nair",
      email: "priya.nair@yahoo.com",
      phone: "201066123984",
      age: 27,
      gender: "Female",
      goal: "General fitness",
      startDate: d(-21),
      status: "Active",
      notes: "New to lifting. Focus on form first, load second. Loves rowing.",
      followUpDays: 3,
      lastFollowUp: d(-3),
      coachNotes: [],
      nutritionTargets: { calories: 2000, protein: 110, carbs: 220, fats: 60, water: 2 },
    },
    {
      id: "c-tom",
      coachId,
      username: "tom_becker",
      name: "Tom Becker",
      email: "tom.becker@gmx.de",
      phone: "+49 151 2903 778",
      age: 35,
      gender: "Male",
      goal: "Lose weight",
      startDate: d(-84),
      status: "Paused",
      notes: "Paused for a work trip until next month. Keep the plan, drop intensity on return.",
      followUpDays: 14,
      coachNotes: [],
    },
    {
      id: "c-sara",
      coachId,
      username: "sara_johnson",
      name: "Sara Johnson",
      email: "sara.j@icloud.com",
      phone: "01055551234",
      age: 31,
      gender: "Female",
      goal: "Build muscle",
      startDate: d(-14),
      status: "Active",
      notes: "Strong baseline. Wants hypertrophy focus. Track RPE.",
      followUpDays: 7,
      coachNotes: [{ id: "cn-s1", text: "First week solid. Increase volume 10% next mesocycle.", createdAt: ts(-2) }],
      nutritionTargets: { calories: 2400, protein: 150, carbs: 280, fats: 70, water: 2.5 },
    },
  ];

  const exercises: Exercise[] = [
    { id: "ex-1", coachId, name: "Barbell Back Squat", category: "Legs", description: "Break at hips and knees together, below parallel.", videoUrl: "https://www.youtube.com/results?search_query=back+squat" },
    { id: "ex-2", coachId, name: "Barbell Bench Press", category: "Chest", description: "Retract shoulder blades, bar to lower chest.", videoUrl: "https://www.youtube.com/results?search_query=bench+press" },
    { id: "ex-3", coachId, name: "Deadlift (Conventional)", category: "Back", description: "Bar over mid-foot, lats tight, push the floor.", videoUrl: "https://www.youtube.com/results?search_query=deadlift" },
    { id: "ex-4", coachId, name: "Pull-up", category: "Back", description: "Dead hang to chin over bar. Bands OK.", videoUrl: "https://www.youtube.com/results?search_query=pull+up" },
    { id: "ex-5", coachId, name: "Overhead Press", category: "Arms", description: "Brace core, press path slightly back.", videoUrl: "https://www.youtube.com/results?search_query=overhead+press" },
    { id: "ex-6", coachId, name: "Bulgarian Split Squat", category: "Legs", description: "Front foot far enough, knee tracks toes.", videoUrl: "https://www.youtube.com/results?search_query=bulgarian+split+squat" },
    { id: "ex-7", coachId, name: "Dumbbell Row", category: "Back", description: "Elbow to hip, no torso rotation.", videoUrl: "https://www.youtube.com/results?search_query=dumbbell+row" },
    { id: "ex-8", coachId, name: "Hip Thrust", category: "Legs", description: "Chin tucked, full hip extension.", videoUrl: "https://www.youtube.com/results?search_query=hip+thrust" },
    { id: "ex-9", coachId, name: "Incline DB Press", category: "Chest", description: "30-45 deg, elbows 45 deg.", videoUrl: "https://www.youtube.com/results?search_query=incline+dumbbell+press" },
    { id: "ex-10", coachId, name: "Face Pull", category: "Arms", description: "High to face, external rotation.", videoUrl: "https://www.youtube.com/results?search_query=face+pull" },
    { id: "ex-11", coachId, name: "Plank", category: "Core", description: "Glutes tight, ribs down, breathe.", videoUrl: "https://www.youtube.com/results?search_query=plank" },
    { id: "ex-12", coachId, name: "Rowing Intervals", category: "Cardio", description: "500m hard / 90s easy x 6.", videoUrl: "https://www.youtube.com/results?search_query=rowing+machine" },
  ];

  const [squat, bench, deadlift, pullup, ohp, bulgarian, dbRow, hipThrust, inclineDb, facePull, plank, rowing] = exercises;

  const plans: PlanItem[] = [
    { id: "pi-1", coachId, clientId: "c-maya", day: 1, exerciseId: squat.id, sets: 3, reps: 8, rest: 120, notes: "RPE 8" },
    { id: "pi-2", coachId, clientId: "c-maya", day: 1, exerciseId: bench.id, sets: 3, reps: 10, rest: 90, notes: "" },
    { id: "pi-3", coachId, clientId: "c-maya", day: 1, exerciseId: dbRow.id, sets: 3, reps: 12, rest: 90, notes: "" },
    { id: "pi-4", coachId, clientId: "c-maya", day: 3, exerciseId: deadlift.id, sets: 3, reps: 6, rest: 180, notes: "RPE 8" },
    { id: "pi-5", coachId, clientId: "c-maya", day: 3, exerciseId: pullup.id, sets: 3, reps: 8, rest: 90, notes: "Band if needed" },
    { id: "pi-6", coachId, clientId: "c-maya", day: 3, exerciseId: hipThrust.id, sets: 3, reps: 12, rest: 90, notes: "" },
    { id: "pi-7", coachId, clientId: "c-jamal", day: 1, exerciseId: squat.id, sets: 4, reps: 6, rest: 180, notes: "Add 2.5kg weekly" },
    { id: "pi-8", coachId, clientId: "c-jamal", day: 1, exerciseId: bench.id, sets: 4, reps: 6, rest: 180, notes: "Add 2.5kg weekly" },
    { id: "pi-9", coachId, clientId: "c-jamal", day: 3, exerciseId: deadlift.id, sets: 3, reps: 5, rest: 180, notes: "RPE 9" },
    { id: "pi-10", coachId, clientId: "c-jamal", day: 3, exerciseId: ohp.id, sets: 3, reps: 8, rest: 120, notes: "" },
    { id: "pi-11", coachId, clientId: "c-priya", day: 1, exerciseId: bulgarian.id, sets: 3, reps: 10, rest: 90, notes: "" },
    { id: "pi-12", coachId, clientId: "c-priya", day: 1, exerciseId: inclineDb.id, sets: 3, reps: 12, rest: 90, notes: "" },
    { id: "pi-13", coachId, clientId: "c-priya", day: 1, exerciseId: facePull.id, sets: 3, reps: 15, rest: 60, notes: "" },
  ];

  const meals: Meal[] = [
    { id: "m-1", coachId, clientId: "c-maya", day: 1, type: "Breakfast", time: "07:30", description: "Greek yogurt, berries, oats, whey", calories: 420, protein: 38, carbs: 45, fats: 10 },
    { id: "m-2", coachId, clientId: "c-maya", day: 1, type: "Lunch", time: "13:00", description: "Chicken breast, rice, roasted veg", calories: 550, protein: 45, carbs: 60, fats: 12 },
    { id: "m-3", coachId, clientId: "c-maya", day: 1, type: "Dinner", time: "19:30", description: "White fish, quinoa, salad", calories: 480, protein: 40, carbs: 45, fats: 15 },
    { id: "m-4", coachId, clientId: "c-jamal", day: 1, type: "Breakfast", time: "08:00", description: "4 eggs, toast, peanut butter, banana", calories: 750, protein: 38, carbs: 75, fats: 32 },
    { id: "m-5", coachId, clientId: "c-jamal", day: 1, type: "Lunch", time: "13:30", description: "Ground beef, pasta, marinara", calories: 850, protein: 45, carbs: 90, fats: 30 },
    { id: "m-6", coachId, clientId: "c-priya", day: 1, type: "Breakfast", time: "07:00", description: "Protein oats, almond butter", calories: 400, protein: 30, carbs: 45, fats: 12 },
  ];

  const checkIns: CheckIn[] = [
    { id: "ci-1", coachId, clientId: "c-maya", date: d(0), ts: ts(0), weight: 67.2, waist: 72, mood: 4, water: 2.3, workoutDone: true, notes: "Felt strong, squats moved well" },
    { id: "ci-2", coachId, clientId: "c-maya", date: d(-2), ts: ts(2), weight: 67.5, waist: 72.5, mood: 3, water: 2.0, workoutDone: true, notes: "" },
    { id: "ci-3", coachId, clientId: "c-maya", date: d(-4), ts: ts(4), weight: 67.8, waist: 73, mood: 3, water: 1.8, workoutDone: false, notes: "Travel day" },
    { id: "ci-4", coachId, clientId: "c-jamal", date: d(0), ts: ts(0), weight: 82.0, waist: 84, mood: 5, water: 3.0, workoutDone: true, notes: "Bench PR 100kg x 3!" },
    { id: "ci-5", coachId, clientId: "c-jamal", date: d(-3), ts: ts(3), weight: 81.8, waist: 83.5, mood: 4, water: 2.8, workoutDone: true, notes: "" },
    { id: "ci-6", coachId, clientId: "c-priya", date: d(-1), ts: ts(1), weight: 58.5, waist: 65, mood: 4, water: 2.2, workoutDone: true, notes: "First unassisted pull-up!" },
  ];

  const subscriptions: Subscription[] = [
    { id: "sub-1", coachId, clientId: "c-maya", planName: "Monthly", startDate: d(-60), endDate: d(30), price: 1500, paymentStatus: "Paid" as SubscriptionPaymentStatus, createdAt: ts(60) },
    { id: "sub-2", coachId, clientId: "c-jamal", planName: "Quarterly", startDate: d(-40), endDate: d(50), price: 4000, paymentStatus: "Paid" as SubscriptionPaymentStatus, createdAt: ts(40) },
    { id: "sub-3", coachId, clientId: "c-priya", planName: "Monthly", startDate: d(-20), endDate: d(10), price: 1500, paymentStatus: "Pending" as SubscriptionPaymentStatus, createdAt: ts(20) },
    { id: "sub-4", coachId, clientId: "c-sara", planName: "Monthly", startDate: d(-10), endDate: d(20), price: 1500, paymentStatus: "Paid" as SubscriptionPaymentStatus, createdAt: ts(10) },
  ];

  const payments: Payment[] = [
    { id: "pay-1", coachId, clientId: "c-maya", subscriptionId: "sub-1", amount: 1500, date: d(-60), method: "Card" as PaymentMethod, status: "Paid" as PaymentStatus, notes: "" },
    { id: "pay-2", coachId, clientId: "c-jamal", subscriptionId: "sub-2", amount: 4000, date: d(-40), method: "Bank Transfer" as PaymentMethod, status: "Paid" as PaymentStatus, notes: "" },
    { id: "pay-3", coachId, clientId: "c-sara", subscriptionId: "sub-4", amount: 1500, date: d(-10), method: "Cash" as PaymentMethod, status: "Paid" as PaymentStatus, notes: "" },
  ];

  const sessions: Session[] = [
    { id: "ses-1", coachId, clientId: "c-maya", date: d(1), time: "18:00", type: "Personal Training", status: "Scheduled" as SessionStatus, notes: "" },
    { id: "ses-2", coachId, clientId: "c-jamal", date: d(1), time: "10:00", type: "Personal Training", status: "Scheduled" as SessionStatus, notes: "Focus: bench technique" },
    { id: "ses-3", coachId, clientId: "c-priya", date: d(2), time: "07:00", type: "Online Coaching", status: "Scheduled" as SessionStatus, notes: "" },
    { id: "ses-4", coachId, clientId: "c-sara", date: d(2), time: "19:00", type: "Personal Training", status: "Scheduled" as SessionStatus, notes: "Week 3 check-in" },
  ];

  return { clients, exercises, plans, checkIns, meals, subscriptions, payments, sessions, messages: [], notifications: [] };
}