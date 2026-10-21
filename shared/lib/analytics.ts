import { getCampaignAttribution } from "./campaign-attribution";
import { journeyContext } from "./journey";
import { jobOriginContext } from "./job-origin";

type EventData = Record<string, string | number | boolean>;
type AnalyticsClient = {
  capture: (name: string, data: Record<string, unknown>, options: { timestamp: Date }) => unknown;
  identify: (userId: string) => void;
  reset: (resetDeviceId: boolean) => void;
  get_distinct_id: () => string;
  get_property: (name: string) => unknown;
};
type PendingEvent = {
  name: string;
  data: EventData;
  timestamp: Date;
  userId: string | null | undefined;
  distinctId?: string;
};

const trackedEvents = new Set<string>();
const pendingEvents: PendingEvent[] = [];
let currentUserId: string | null | undefined;

declare global {
  interface Window { gifglooAnalytics?: AnalyticsClient }
}

export function setAnalyticsClient(client: AnalyticsClient): void {
  window.gifglooAnalytics = client;
  if (currentUserId !== undefined) identifyUser(currentUserId);
}

export function identifyUser(userId: string | null): void {
  currentUserId = userId;
  const client = window.gifglooAnalytics;
  if (!client) return;
  const previousUserId = client.get_property("$user_id");
  if (typeof previousUserId === "string" && previousUserId !== userId) client.reset(true);
  if (userId && client.get_distinct_id() !== userId) client.identify(userId);
  for (const event of pendingEvents.splice(0)) sendEvent(client, event);
}

function sendEvent(client: AnalyticsClient, event: PendingEvent): void {
  const userId = event.userId === undefined ? currentUserId : event.userId;
  client.capture(event.name, {
    ...event.data,
    distinct_id: event.distinctId ?? client.get_distinct_id(),
    $user_id: userId ?? undefined,
    $is_identified: Boolean(userId),
    ...(userId ? { account_id: userId } : {}),
  }, { timestamp: event.timestamp });
}

export function trackEvent(eventName: string, eventData?: EventData): void {
  const resultEvent = eventName.startsWith("result_") || eventName.startsWith("shared_result_");
  const jobId = typeof eventData?.job_id === "string" ? eventData.job_id : undefined;
  const event: PendingEvent = {
    name: eventName,
    data: {
      ...journeyContext(), ...eventData,
      ...(jobId || resultEvent ? jobOriginContext(jobId) : {}),
      ...getCampaignAttribution(), analytics_schema_version: "2",
      analytics_provider: "posthog",
    },
    timestamp: new Date(),
    userId: currentUserId,
    ...(currentUserId ? { distinctId: currentUserId } :
      currentUserId === null && window.gifglooAnalytics
        ? { distinctId: window.gifglooAnalytics.get_distinct_id() } : {}),
  };
  if (window.gifglooAnalytics && currentUserId !== undefined) sendEvent(window.gifglooAnalytics, event);
  else pendingEvents.push(event);
}

export function trackEventOnce(key: string, eventName: string, eventData?: EventData): void {
  if (trackedEvents.has(key)) return;
  trackedEvents.add(key);
  trackEvent(eventName, eventData);
}
