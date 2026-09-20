type UmamiEventData = Record<string, string | number | boolean>;
type PendingEvent = { eventName: string; eventData?: UmamiEventData };

const trackedEvents = new Set<string>();
const pendingEvents: PendingEvent[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let pendingUserId: string | null = null;
let identifyTimer: ReturnType<typeof setTimeout> | null = null;

declare global {
  interface Window {
    umami?: {
      track: (eventName: string, eventData?: UmamiEventData) => void;
      identify: (userId: string) => void;
    };
  }
}

export function identifyUser(userId: string): void {
  pendingUserId = userId;
  if (window.umami) {
    window.umami.identify(userId);
    pendingUserId = null;
    return;
  }
  if (identifyTimer) return;

  let attempts = 0;
  identifyTimer = setTimeout(function identify() {
    if (!window.umami) {
      attempts += 1;
      if (attempts >= 20) {
        pendingUserId = null;
        identifyTimer = null;
        return;
      }
      identifyTimer = setTimeout(identify, 250);
      return;
    }

    if (pendingUserId) window.umami.identify(pendingUserId);
    pendingUserId = null;
    identifyTimer = null;
  }, 250);
}

export function trackEvent(eventName: string, eventData?: UmamiEventData): void {
  if (window.umami) {
    window.umami.track(eventName, eventData);
    return;
  }

  pendingEvents.push({ eventName, eventData });
  if (flushTimer) return;

  let attempts = 0;
  flushTimer = setTimeout(function flush() {
    if (!window.umami) {
      attempts += 1;
      if (attempts >= 20) {
        pendingEvents.length = 0;
        flushTimer = null;
        return;
      }
      flushTimer = setTimeout(flush, 250);
      return;
    }

    for (const pending of pendingEvents.splice(0)) {
      window.umami.track(pending.eventName, pending.eventData);
    }
    flushTimer = null;
  }, 250);
}

export function trackEventOnce(
  key: string,
  eventName: string,
  eventData?: UmamiEventData,
): void {
  if (trackedEvents.has(key)) return;
  trackedEvents.add(key);
  trackEvent(eventName, eventData);
}
