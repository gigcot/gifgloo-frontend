type UmamiEventData = Record<string, string | number | boolean>;

declare global {
  interface Window {
    umami?: {
      track: (eventName: string, eventData?: UmamiEventData) => void;
    };
  }
}

export function trackEvent(eventName: string, eventData?: UmamiEventData): void {
  window.umami?.track(eventName, eventData);
}
