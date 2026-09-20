"use client";

import { useReportWebVitals } from "next/web-vitals";
import { trackEvent } from "@/shared/lib/umami";

const TRACKED_METRICS = new Set(["LCP", "INP", "CLS"]);

export function WebVitalsReporter() {
  useReportWebVitals((metric) => {
    if (!TRACKED_METRICS.has(metric.name)) return;

    trackEvent("web_vital", {
      metric: metric.name,
      value: Math.round(metric.name === "CLS" ? metric.value * 1000 : metric.value),
      rating: metric.rating,
    });
  });

  return null;
}
