import posthog from "posthog-js";
import { setAnalyticsClient } from "@/shared/lib/analytics";
import { getCampaignAttribution } from "@/shared/lib/campaign-attribution";
import { journeyContext } from "@/shared/lib/journey";

const token = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
if (window.gifglooAnalytics) {
  setAnalyticsClient(window.gifglooAnalytics);
} else if (token) {
  posthog.init(token, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
    defaults: "2026-05-30",
    autocapture: false,
    capture_pageview: false,
    capture_pageleave: false,
    capture_dead_clicks: false,
    capture_exceptions: false,
    capture_heatmaps: false,
    capture_performance: { web_vitals: true, web_vitals_attribution: false },
    disable_session_recording: true,
    disable_surveys: true,
    advanced_disable_flags: true,
    save_campaign_params: false,
    disable_capture_url_hashes: true,
    person_profiles: "identified_only",
    persistence: "localStorage",
    before_send: (event) => {
      if (!event) return event;
      const urlProperties = [event.properties, event.$set, event.$set_once, event.properties.$set, event.properties.$set_once];
      if (event.event === "$web_vitals") {
        Object.assign(event.properties, journeyContext(), getCampaignAttribution(), {
          analytics_schema_version: "2", analytics_provider: "posthog",
        });
        for (const [name, metric] of Object.entries(event.properties)) {
          if (name.startsWith("$web_vitals_") && name.endsWith("_event") && metric && typeof metric === "object") {
            delete metric.attribution;
            urlProperties.push(metric);
          }
        }
      }
      for (const properties of urlProperties) {
        if (!properties) continue;
        for (const property of ["$current_url", "$referrer", "$initial_current_url", "$initial_referrer", "$session_entry_url", "$session_entry_referrer", "navigationURL"]) {
          const value = properties[property];
          if (typeof value === "string" && /^https?:\/\//.test(value)) {
            const url = new URL(value);
            properties[property] = `${url.origin}${url.pathname}`;
          }
        }
      }
      if (event.properties.analytics_provider === "posthog" && event.event !== "$web_vitals") {
        const identified = typeof event.properties.account_id === "string";
        event.properties.$is_identified = identified;
        event.properties.$process_person_profile = identified;
      }
      return event;
    },
  });
  setAnalyticsClient(posthog);
}
