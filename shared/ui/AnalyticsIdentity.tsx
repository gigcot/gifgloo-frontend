"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/shared/lib/use-auth";
import { trackEvent, trackEventOnce } from "@/shared/lib/analytics";
import { getCampaignAttribution } from "@/shared/lib/campaign-attribution";
import { journeyContext, updateJourneyVisibility } from "@/shared/lib/journey";

export function AnalyticsIdentity() {
  const { userId, isLoggedIn } = useAuth();
  const pathname = usePathname();
  const lastPage = useRef<string | null>(null);

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
    if (lastPage.current === pathname) return;
    lastPage.current = pathname;
    trackEvent("$pageview", { page: pathname });
  }, [pathname]);

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
