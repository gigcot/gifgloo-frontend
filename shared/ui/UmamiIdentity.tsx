"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/shared/lib/use-auth";
import { identifyUser, trackEvent, trackEventOnce } from "@/shared/lib/umami";
import { getCampaignAttribution } from "@/shared/lib/campaign-attribution";
import { journeyContext, updateJourneyVisibility } from "@/shared/lib/journey";

export function UmamiIdentity() {
  const { userId, isLoggedIn } = useAuth();
  const pathname = usePathname();

  useEffect(() => {
    journeyContext();
    const record = () => {
      updateJourneyVisibility();
      trackEvent("journey_visibility", { visibility: document.visibilityState, page: pathname });
    };
    document.addEventListener("visibilitychange", record);
    window.addEventListener("pagehide", record);
    return () => {
      updateJourneyVisibility();
      document.removeEventListener("visibilitychange", record);
      window.removeEventListener("pagehide", record);
    };
  }, [pathname]);

  useEffect(() => {
    if (userId) identifyUser(userId);
  }, [userId]);

  useEffect(() => {
    getCampaignAttribution();
    if (!userId || !isLoggedIn) return;
    if (pathname === "/callback") return;
    if (sessionStorage.getItem("analytics_signup_pending") !== "true") return;
    const key = `analytics_signup_sent:${userId}`;
    if (sessionStorage.getItem(key) !== "true") {
      trackEventOnce(`signup_completed:${userId}`, "signup_completed");
      sessionStorage.setItem(key, "true");
    }
    sessionStorage.removeItem("analytics_signup_pending");
  }, [userId, isLoggedIn, pathname]);

  return null;
}
