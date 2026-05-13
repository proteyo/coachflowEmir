import createContextHook from "@nkzw/create-context-hook";
import { useCallback, useMemo } from "react";

import { useAuth } from "@/src/context/AuthContext";
import { useData } from "@/src/context/DataContext";
import { apiPatch, apiPost } from "@/src/services/api";
import { Subscription } from "@/src/types/models";

export type SubscriptionPlanCode = "free" | "starter" | "pro" | "unlimited";

export type SubscriptionPlan = {
  code: SubscriptionPlanCode;
  name: string;
  price: number;
  currency: string;
  clientLimit: number;
  description: string;
  badge?: string;
  features: string[];
};

type ExtendedSubscription = Subscription & {
  planCode?: SubscriptionPlanCode | string;
  clientLimit?: number;
};

const FREE_PLAN_CODE: SubscriptionPlanCode = "free";
const FREE_CLIENT_LIMIT = 3;
const FREE_TRIAL_DAYS = 30;

export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    code: "free",
    name: "Free Trial",
    price: 0,
    currency: "KZT",
    clientLimit: FREE_CLIENT_LIMIT,
    description: "Free 30-day trial with a small client base.",
    badge: "30 days free",
    features: [
      "Free for 30 days",
      "Up to 3 clients",
      "Client profiles",
      "Basic workout plans",
      "Basic chat",
      "Weight tracking",
    ],
  },
  {
    code: "starter",
    name: "Starter",
    price: 2990,
    currency: "KZT",
    clientLimit: 10,
    description: "For new coaches starting with their first client base.",
    badge: "Best start",
    features: [
      "Up to 10 clients",
      "Client profiles",
      "Workout plans",
      "Chat and voice messages",
      "Progress tracking",
      "Supplements and attendance",
    ],
  },
  {
    code: "pro",
    name: "Pro",
    price: 4990,
    currency: "KZT",
    clientLimit: 30,
    description: "For active coaches who already manage many clients.",
    badge: "Most popular",
    features: [
      "Up to 30 clients",
      "Everything in Starter",
      "Exercise history",
      "Client analytics",
      "Muscle progress",
      "Advanced coaching tools",
    ],
  },
  {
    code: "unlimited",
    name: "Unlimited",
    price: 9990,
    currency: "KZT",
    clientLimit: 999999,
    description: "For professional coaches, teams and small studios.",
    badge: "Full access",
    features: [
      "Unlimited clients",
      "Everything in Pro",
      "Best for studios",
      "No client limit",
      "Full business access",
      "Priority future features",
    ],
  },
];

function getPlanByCode(code?: string | null): SubscriptionPlan {
  return (
    SUBSCRIPTION_PLANS.find((plan) => plan.code === code) ??
    SUBSCRIPTION_PLANS.find((plan) => plan.code === FREE_PLAN_CODE)!
  );
}

function normalizePlanCode(code?: string | null): SubscriptionPlanCode {
  if (
    code === "free" ||
    code === "starter" ||
    code === "pro" ||
    code === "unlimited"
  ) {
    return code;
  }

  return FREE_PLAN_CODE;
}

function getTime(value?: string) {
  if (!value) return 0;

  const time = new Date(value).getTime();

  return Number.isNaN(time) ? 0 : time;
}

function normalizeBackendSubscription(raw: any): ExtendedSubscription {
  const planCode = normalizePlanCode(raw.planCode ?? raw.plan_code);
  const plan = getPlanByCode(planCode);

  return {
    id: String(raw.id),
    coachId: String(raw.coachId ?? raw.coach_id),
    planCode,
    planName: raw.planName ?? raw.plan_name ?? plan.name,
    price: Number(raw.price ?? plan.price),
    currency: raw.currency ?? plan.currency,
    clientLimit: Number(raw.clientLimit ?? raw.client_limit ?? plan.clientLimit),
    status: raw.status ?? "inactive",
    startDate: raw.startDate ?? raw.start_date ?? undefined,
    endDate: raw.endDate ?? raw.end_date ?? undefined,
    createdAt: raw.createdAt ?? raw.created_at ?? new Date().toISOString(),
  } as ExtendedSubscription;
}

function isSubscriptionActive(sub?: ExtendedSubscription): boolean {
  if (!sub) return false;
  if (sub.status !== "active") return false;
  if (!sub.endDate) return false;

  const endTime = getTime(sub.endDate);

  if (!endTime) return false;

  return endTime > Date.now();
}

function isPaidSubscriptionActive(sub?: ExtendedSubscription): boolean {
  if (!isSubscriptionActive(sub)) return false;

  const code = normalizePlanCode(sub?.planCode);

  return code !== "free";
}

function isFreeTrialActive(sub?: ExtendedSubscription): boolean {
  if (!isSubscriptionActive(sub)) return false;

  const code = normalizePlanCode(sub?.planCode);

  return code === "free";
}

function getSubscriptionSortTime(sub: ExtendedSubscription) {
  const endTime = getTime(sub.endDate);
  const createdTime = getTime(sub.createdAt);
  const startTime = getTime(sub.startDate);

  return Math.max(endTime, createdTime, startTime);
}

export const [SubscriptionProvider, useSubscription] = createContextHook(() => {
  const { user, token } = useAuth();
  const { db, refreshFromBackend } = useData();

  const coachSubscriptions: ExtendedSubscription[] = useMemo(() => {
    if (!user || !db) return [];

    return db.subscriptions
      .filter((subscription) => subscription.coachId === user.id)
      .map((subscription) => subscription as ExtendedSubscription)
      .slice()
      .sort((a, b) => getSubscriptionSortTime(b) - getSubscriptionSortTime(a));
  }, [user, db]);

  const activeSubscription: ExtendedSubscription | undefined = useMemo(() => {
    return coachSubscriptions.find((subscription) =>
      isSubscriptionActive(subscription),
    );
  }, [coachSubscriptions]);

  const latestSubscription: ExtendedSubscription | undefined = useMemo(() => {
    return coachSubscriptions[0];
  }, [coachSubscriptions]);

  const sub: ExtendedSubscription | undefined =
    activeSubscription ?? latestSubscription;

  const paidSubscriptionActive = useMemo(() => {
    return isPaidSubscriptionActive(activeSubscription);
  }, [activeSubscription]);

  const isTrialActive = useMemo(() => {
    return isFreeTrialActive(activeSubscription);
  }, [activeSubscription]);

  const trialEndsAt = useMemo(() => {
    if (!isTrialActive) return undefined;

    return activeSubscription?.endDate;
  }, [isTrialActive, activeSubscription?.endDate]);

  const canStartFreeTrial = useMemo(() => {
    if (!user || user.role !== "coach") return false;
    if (paidSubscriptionActive) return false;
    if (isTrialActive) return false;

    return true;
  }, [user, paidSubscriptionActive, isTrialActive]);

  const planCode = useMemo<SubscriptionPlanCode>(() => {
    if (paidSubscriptionActive || isTrialActive) {
      return normalizePlanCode(activeSubscription?.planCode);
    }

    return FREE_PLAN_CODE;
  }, [paidSubscriptionActive, isTrialActive, activeSubscription?.planCode]);

  const currentPlan = useMemo(() => {
    return getPlanByCode(planCode);
  }, [planCode]);

  const isFreePlan = useMemo(() => {
    return isTrialActive;
  }, [isTrialActive]);

  const isActive = useMemo(() => {
    if (!user || user.role !== "coach") return false;

    return paidSubscriptionActive || isTrialActive;
  }, [user, paidSubscriptionActive, isTrialActive]);

  const clientLimit = useMemo(() => {
    if (!user || user.role !== "coach") return 0;
    if (!isActive) return 0;

    if (paidSubscriptionActive) {
      return Number(activeSubscription?.clientLimit ?? currentPlan.clientLimit);
    }

    if (isTrialActive) {
      return FREE_CLIENT_LIMIT;
    }

    return 0;
  }, [
    user,
    isActive,
    paidSubscriptionActive,
    activeSubscription?.clientLimit,
    currentPlan.clientLimit,
    isTrialActive,
  ]);

  const currentClientCount = useMemo(() => {
    if (!db || !user) return 0;

    return db.clientProfiles.filter((client) => client.coachId === user.id)
      .length;
  }, [db, user]);

  const remainingSlots = useMemo(() => {
    if (!isActive) return 0;
    if (clientLimit >= 999999) return 999999;

    return Math.max(0, clientLimit - currentClientCount);
  }, [isActive, clientLimit, currentClientCount]);

  const canAddClient = useCallback(
    (count?: number) => {
      if (!isActive) return false;

      const currentCount = count ?? currentClientCount;

      if (clientLimit >= 999999) return true;

      return currentCount < clientLimit;
    },
    [isActive, currentClientCount, clientLimit],
  );

  const activateFreeTrial = useCallback(async () => {
    if (!user || !token) {
      throw new Error("Please log in again.");
    }

    if (user.role !== "coach") {
      throw new Error("Only coaches can activate a subscription.");
    }

    if (paidSubscriptionActive) {
      throw new Error("You already have an active paid subscription.");
    }

    if (isTrialActive) {
      await refreshFromBackend();
      return;
    }

    const saved = await apiPost(
      "/subscriptions/me/activate",
      {
        plan_code: "free",
        trial_days: FREE_TRIAL_DAYS,
        client_limit: FREE_CLIENT_LIMIT,
      },
      { token },
    );

    const normalized = normalizeBackendSubscription(saved);

    if (!isFreeTrialActive(normalized)) {
      throw new Error("Free trial was not activated by backend.");
    }

    await refreshFromBackend();
  }, [
    user,
    token,
    paidSubscriptionActive,
    isTrialActive,
    refreshFromBackend,
  ]);

  const selectPlan = useCallback(
    async (selectedPlanCode: SubscriptionPlanCode = FREE_PLAN_CODE) => {
      if (!user || !token) {
        throw new Error("Please log in again.");
      }

      if (selectedPlanCode === "free") {
        await activateFreeTrial();
        return;
      }

      await apiPatch(
        "/subscriptions/me",
        {
          plan_code: selectedPlanCode,
        },
        { token },
      );

      await refreshFromBackend();
    },
    [user, token, activateFreeTrial, refreshFromBackend],
  );

  const activate = useCallback(
    async (selectedPlanCode: SubscriptionPlanCode = "free") => {
      if (!user || !token) {
        throw new Error("Please log in again.");
      }

      if (selectedPlanCode === "free") {
        await activateFreeTrial();
        return;
      }

      throw new Error(
        "Paid subscription activation is not connected yet. Please use Free Trial for now.",
      );
    },
    [user, token, activateFreeTrial],
  );

  const renew = useCallback(async () => {
    if (!user || !token) {
      throw new Error("Please log in again.");
    }

    if (!paidSubscriptionActive) {
      throw new Error("There is no active paid subscription to renew.");
    }

    if (planCode === "free") {
      throw new Error("Free trial cannot be renewed.");
    }

    const saved = await apiPost(
      "/subscriptions/me/activate",
      {
        plan_code: planCode,
      },
      { token },
    );

    const normalized = normalizeBackendSubscription(saved);

    if (!isPaidSubscriptionActive(normalized)) {
      throw new Error("Subscription was not renewed by backend.");
    }

    await refreshFromBackend();
  }, [user, token, paidSubscriptionActive, planCode, refreshFromBackend]);

  const cancel = useCallback(async () => {
    throw new Error(
      "Subscription cancellation is not connected yet. It must be handled through the payment provider.",
    );
  }, []);

  const upgradeToPlan = useCallback(
    async (selectedPlanCode: SubscriptionPlanCode) => {
      if (selectedPlanCode === "free") {
        await activateFreeTrial();
        return;
      }

      await selectPlan(selectedPlanCode);
    },
    [activateFreeTrial, selectPlan],
  );

  return {
    sub,

    plans: SUBSCRIPTION_PLANS,
    currentPlan,
    planCode,
    planName: currentPlan.name,
    price: currentPlan.price,
    currency: currentPlan.currency,
    clientLimit,

    isActive,
    isFreePlan,
    isTrialActive,
    trialEndsAt,
    canStartFreeTrial,
    freeClientLimit: FREE_CLIENT_LIMIT,
    trialDays: FREE_TRIAL_DAYS,

    paidSubscriptionActive,
    currentClientCount,
    remainingSlots,
    canAddClient,

    selectPlan,
    activate,
    renew,
    cancel,
    upgradeToPlan,
  };
});