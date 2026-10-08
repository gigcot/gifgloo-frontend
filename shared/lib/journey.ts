type Journey = {
  flow_id: string;
  origin: "home" | "direct_compose" | "result_return" | "other";
  started_at: number;
  visible_ms: number;
  attempt_id?: string;
  first_result_at?: number;
};

let journey: Journey | null = null;
let visibleSince: number | null = null;
const STORAGE_KEY = "gifgloo_journey";

function current(): Journey {
  if (journey) return journey;
  try {
    const saved = sessionStorage.getItem(STORAGE_KEY);
    if (saved) journey = JSON.parse(saved) as Journey;
  } catch (error) {
    console.warn("Journey storage unavailable", error);
  }
  if (!journey || typeof journey.flow_id !== "string" || typeof journey.started_at !== "number" || typeof journey.visible_ms !== "number") {
    const path = window.location.pathname;
    journey = {
      flow_id: crypto.randomUUID(), started_at: Date.now(), visible_ms: 0,
      origin: path === "/" ? "home" : path === "/compose" ? "direct_compose" : path === "/my-assets" ? "result_return" : "other",
    };
  }
  visibleSince = document.visibilityState === "visible" ? Date.now() : null;
  save();
  return journey;
}

function save() {
  try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(journey)); }
  catch (error) { console.warn("Journey storage unavailable", error); }
}

export function updateJourneyVisibility(): void {
  const flow = current();
  if (visibleSince !== null) flow.visible_ms += Date.now() - visibleSince;
  visibleSince = document.visibilityState === "visible" ? Date.now() : null;
  save();
}

export function journeyContext(): Record<string, string | number | boolean> {
  const flow = current();
  return {
    experience_version: "anonymous-first-v2",
    flow_id: flow.flow_id, flow_origin: flow.origin,
    flow_elapsed_ms: Math.max(0, Date.now() - flow.started_at),
    flow_visible_ms: flow.visible_ms + (visibleSince === null ? 0 : Date.now() - visibleSince),
    traffic_type: process.env.NEXT_PUBLIC_ANALYTICS_INTERNAL === "true" ? "internal" : "external",
    ...(flow.attempt_id ? { attempt_id: flow.attempt_id } : {}),
    ...(flow.first_result_at ? { since_first_result_ms: Date.now() - flow.first_result_at } : {}),
  };
}

export function beginCompositionAttempt(): void {
  const flow = current();
  flow.attempt_id = crypto.randomUUID();
  save();
}

export function recordFirstResult(): void { current().first_result_at ??= Date.now(); save(); }
