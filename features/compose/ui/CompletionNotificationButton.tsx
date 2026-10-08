"use client";

import { useEffect, useRef, useState } from "react";
import { BellIcon } from "@radix-ui/react-icons";
import { API_BASE } from "@/shared/lib/api-base";
import { useAuth } from "@/shared/lib/use-auth";
import { trackEvent } from "@/shared/lib/umami";

type Setup = { registration: ServiceWorkerRegistration; key: string };

export function CompletionNotificationButton({ jobId }: { jobId: string }) {
  const { authFetch } = useAuth();
  const [setup, setSetup] = useState<Setup | null>(null);
  const [unavailable, setUnavailable] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [tooltip, setTooltip] = useState(false);
  const busyRef = useRef(false);

  useEffect(() => {
    let current = true;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    async function prepare() {
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window) || !window.isSecureContext) {
        const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
        if (current) setUnavailable(ios ? "아이폰·아이패드는 홈 화면에 추가한 웹앱에서 알림을 받을 수 있어요. 이 브라우저의 ‘내 결과’에서도 확인할 수 있어요." : "이 기기·브라우저에서는 알림을 지원하지 않아요. ‘내 결과’에서 확인해주세요.");
        return;
      }
      try {
        const response = await authFetch(`${API_BASE}/web-push/config`);
        if (!response.ok) throw new Error("config");
        const config = await response.json();
        if (!config.enabled || typeof config.public_key !== "string") {
          if (current) setUnavailable("완료 알림을 아직 사용할 수 없어요. ‘내 결과’에서 확인해주세요.");
          return;
        }
        await navigator.serviceWorker.register("/completion-notifications-sw.js", { scope: "/" });
        const registration = await Promise.race([
          navigator.serviceWorker.ready,
          new Promise<never>((_, reject) => { timeout = setTimeout(() => reject(new Error("activation timeout")), 10000); }),
        ]);
        clearTimeout(timeout);
        if (current) setSetup({ registration, key: config.public_key });
      } catch {
        if (current) setUnavailable("알림을 준비하지 못했어요. ‘내 결과’에서 확인해주세요.");
      }
    }
    void prepare();
    return () => { current = false; clearTimeout(timeout); };
  }, [authFetch]);

  async function subscribe() {
    if (busyRef.current || subscribed) return;
    trackEvent("completion_notification_clicked", { job_id: jobId });
    if (unavailable) { setMessage(unavailable); trackEvent("completion_notification_unavailable", { job_id: jobId }); return; }
    if (!setup) { setMessage("알림을 준비 중이에요. 잠시 후 다시 눌러주세요."); return; }
    busyRef.current = true;
    setBusy(true);
    setMessage("");
    try {
      const permission = await Notification.requestPermission();
      trackEvent("completion_notification_permission", { job_id: jobId, permission });
      if (permission !== "granted") {
        setMessage(permission === "denied" ? "알림이 차단되어 있어요. 브라우저 설정에서 변경하거나 ‘내 결과’에서 확인해주세요." : "알림을 신청하지 않았어요. 합성은 계속 진행돼요.");
        return;
      }
      const key = Uint8Array.from(atob(setup.key.replace(/-/g, "+").replace(/_/g, "/")), char => char.charCodeAt(0));
      const subscription = await setup.registration.pushManager.getSubscription() ?? await setup.registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
      const response = await authFetch(`${API_BASE}/compositions/${encodeURIComponent(jobId)}/notification`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(subscription.toJSON()),
      });
      if (!response.ok) throw new Error("registration");
      const result = await response.json();
      if (result.status !== "pending" && result.status !== "sent") throw new Error("status");
      setSubscribed(true);
      setMessage("이번 합성이 완료되면 알려드릴게요.");
      trackEvent("completion_notification_registered", { job_id: jobId });
    } catch {
      setMessage("알림 신청을 완료하지 못했어요. 다시 누르거나 ‘내 결과’에서 확인해주세요.");
      trackEvent("completion_notification_failed", { job_id: jobId });
    } finally { busyRef.current = false; setBusy(false); }
  }

  return <div className="notification-control">
    <button className="notification-button" disabled={busy || subscribed || (!setup && !unavailable)} onClick={() => void subscribe()}
      onMouseEnter={() => setTooltip(true)} onMouseLeave={() => setTooltip(false)}
      onFocus={() => setTooltip(true)} onBlur={() => setTooltip(false)}
      onKeyDown={event => { if (event.key === "Escape") setTooltip(false); }}
      aria-describedby={tooltip ? "notification-compatibility" : undefined}>
      <BellIcon aria-hidden="true" />{subscribed ? "알림을 받을게요" : busy ? "알림 신청 중…" : "완료되면 알림 받기"}
    </button>
    {tooltip && <div className="notification-tooltip-area"><p className="notification-tooltip" role="tooltip" id="notification-compatibility">일부 기기·브라우저에서는 지원되지 않을 수 있어요.</p></div>}
    <p className="notification-message" role="status">{message}</p>
  </div>;
}
