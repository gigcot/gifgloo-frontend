const STORAGE_KEY = "analytics_campaign";
const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content"] as const;

export function getCampaignAttribution(): Record<string, string> {
  try {
    const saved = sessionStorage.getItem(STORAGE_KEY);
    const params = new URLSearchParams(saved ?? "");
    const incoming = new URLSearchParams(window.location.search);
    if (!saved && incoming.get("utm_campaign")) {
      for (const key of UTM_KEYS) {
        const value = incoming.get(key);
        if (value) params.set(key, value.slice(0, 100));
      }
      sessionStorage.setItem(STORAGE_KEY, params.toString());
    }
    return Object.fromEntries(UTM_KEYS.flatMap((key) => {
      const value = params.get(key);
      return value ? [[key, value]] : [];
    }));
  } catch (error) {
    console.warn("Campaign attribution storage unavailable", error);
    return {};
  }
}
