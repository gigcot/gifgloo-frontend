self.addEventListener("push", event => {
  let jobId = "";
  try {
    const payload = event.data.json();
    if (typeof payload.job_id === "string" && /^[a-zA-Z0-9_-]{1,128}$/.test(payload.job_id)) jobId = payload.job_id;
  } catch {
    // A visible fallback is required even when a push payload cannot be decoded.
  }
  event.waitUntil(self.registration.showNotification("GIF가 완성됐어요!", {
    body: "눌러서 결과를 확인해보세요.", icon: "/icon.png",
    tag: jobId ? `gifgloo-complete-${jobId}` : "gifgloo-complete",
    renotify: false,
    data: { url: jobId ? `/my-assets?job=${encodeURIComponent(jobId)}&from=notification` : "/my-assets" },
  }));
});

self.addEventListener("notificationclick", event => {
  event.notification.close();
  const candidate = new URL(event.notification.data?.url || "/my-assets", self.location.origin);
  const target = candidate.origin === self.location.origin && candidate.pathname === "/my-assets" ? candidate.href : new URL("/my-assets", self.location.origin).href;
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const existing = windows.find(client => client.url === target);
    if (existing) return existing.focus();
    return self.clients.openWindow(target);
  })());
});
