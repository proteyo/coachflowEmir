import createContextHook from "@nkzw/create-context-hook";
import { useCallback, useMemo } from "react";
import { useAuth } from "@/src/context/AuthContext";
import { useData } from "@/src/context/DataContext";
import { Subscription } from "@/src/types/models";

export const [SubscriptionProvider, useSubscription] = createContextHook(() => {
  const { user } = useAuth();
  const { db, update } = useData();

  const sub: Subscription | undefined = useMemo(() => {
    if (!user || !db) return undefined;
    return db.subscriptions
      .filter((s) => s.coachId === user.id)
      .sort((a, b) => (a.createdAt > b.createdAt ? -1 : 1))[0];
  }, [user, db]);

  const isActive = useMemo(() => {
    if (!sub) return false;
    if (sub.status !== "active") return false;
    if (!sub.endDate) return false;
    return new Date(sub.endDate).getTime() > Date.now();
  }, [sub]);

  const activate = useCallback(async () => {
    if (!user) return;
    const start = new Date();
    const end = new Date();
    end.setDate(end.getDate() + 30);
    update((d) => {
      const others = d.subscriptions.filter((s) => s.coachId !== user.id);
      const existing = d.subscriptions.find((s) => s.coachId === user.id);
      const newSub: Subscription = {
        id: existing?.id ?? `sub_${user.id}`,
        coachId: user.id,
        planName: "CoachFlow Monthly",
        price: 2490,
        currency: "KZT",
        status: "active",
        startDate: start.toISOString(),
        endDate: end.toISOString(),
        createdAt: existing?.createdAt ?? new Date().toISOString(),
      };
      return { ...d, subscriptions: [...others, newSub] };
    });
  }, [user, update]);

  const cancel = useCallback(async () => {
    if (!user) return;
    update((d) => ({
      ...d,
      subscriptions: d.subscriptions.map((s) =>
        s.coachId === user.id ? { ...s, status: "cancelled" } : s,
      ),
    }));
  }, [user, update]);

  const renew = useCallback(async () => {
    if (!user) return;
    update((d) => ({
      ...d,
      subscriptions: d.subscriptions.map((s) => {
        if (s.coachId !== user.id) return s;
        const start = new Date();
        const end = new Date();
        end.setDate(end.getDate() + 30);
        return {
          ...s,
          status: "active",
          startDate: start.toISOString(),
          endDate: end.toISOString(),
        };
      }),
    }));
  }, [user, update]);

  return { sub, isActive, activate, cancel, renew };
});
