"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/shared/lib/use-auth";
import { identifyUser, trackEventOnce } from "@/shared/lib/umami";
import { getCampaignAttribution } from "@/shared/lib/campaign-attribution";

export function UmamiIdentity() {
  const { userId } = useAuth();
  const pathname = usePathname();

  useEffect(() => {
    if (userId) identifyUser(userId);
  }, [userId]);

  useEffect(() => {
    getCampaignAttribution();
    if (!userId) return;
    if (pathname === "/callback") return;
    if (sessionStorage.getItem("analytics_signup_pending") !== "true") return;
    const key = `analytics_signup_sent:${userId}`;
    if (sessionStorage.getItem(key) !== "true") {
      trackEventOnce(`signup_completed:${userId}`, "signup_completed");
      sessionStorage.setItem(key, "true");
    }
    sessionStorage.removeItem("analytics_signup_pending");
  }, [userId, pathname]);

  return null;
}
