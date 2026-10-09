"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/shared/lib/use-auth";
import { API_BASE } from "@/shared/lib/api-base";
import { trackEventOnce } from "@/shared/lib/umami";
import { ObservedResultImage } from "@/shared/ui/ObservedResultImage";
import { ShareButton } from "@/shared/ui/ShareButton";
import { downloadGif } from "@/shared/lib/download";
import { CompositionFeedback } from "@/features/compositions/ui/CompositionFeedback";
import { Exp001SurveyInvitation } from "@/features/experiment/ui/Exp001SurveyInvitation";

export function NotificationResult() {
  const { authFetch, checked, userId } = useAuth();
  const [snapshot, setResult] = useState<{ ownerId: string; jobId: string; url: string; assetId: string } | null>(null);
  const result = snapshot?.ownerId === userId ? snapshot : null;
  const [message, setMessage] = useState("");
  const [open, setOpen] = useState(true);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const jobId = params.get("job");
    if (!jobId || !checked) return;
    let current = true;
    async function load() {
      if (params.get("from") === "notification") trackEventOnce(`notification-return:${jobId}`, "completion_notification_opened", { job_id: jobId! });
      if (!userId) { setMessage("결과를 만든 브라우저의 접속 정보가 없어요. 다른 계정으로 로그인했거나 쿠키를 삭제했다면 이 결과에 접근할 수 없어요."); return; }
      try {
        const response = await authFetch(`${API_BASE}/compositions/${encodeURIComponent(jobId!)}`);
        if (!response.ok) throw new Error("result");
        const data = await response.json();
        if (!current) return;
        if (data.status !== "COMPLETED" || !data.result_url || !data.result_asset_id) {
          setMessage("아직 결과를 확인할 수 없어요. 잠시 후 새로고침해주세요."); return;
        }
        setMessage("");
        setResult({ ownerId: userId, jobId: jobId!, url: data.result_url, assetId: data.result_asset_id });
      } catch { if (current) setMessage("이 결과를 불러오지 못했어요. 결과를 만든 계정·브라우저인지 확인한 뒤 다시 시도해주세요."); }
    }
    void load();
    return () => { current = false; };
  }, [authFetch, checked, userId]);
  if (!open || (!result && !message)) return null;
  return <section className="mx-auto max-w-xl p-5 text-center" aria-label="알림으로 돌아온 결과">
    <button className="float-right p-2 text-white/70" onClick={() => setOpen(false)}>닫기</button>
    <h2 className="mb-4 text-2xl font-bold">{result ? "완성됐어요!" : "결과 확인"}</h2>
    {message && <p role="status" className="py-4 text-sm text-white/70">{message}</p>}
    {result && <><ObservedResultImage src={result.url} jobId={result.jobId} assetId={result.assetId} source="notification_return" className="max-h-[60vh] w-full rounded-xl object-contain" />
      <div className="mt-4 flex justify-center gap-4"><button className="rounded-full bg-purple-600 px-6 py-3" onClick={() => downloadGif(`${API_BASE}/assets/${result.assetId}/download`, "notification_return", result.assetId)}>GIF 저장</button>
        <ShareButton assetId={result.assetId} analyticsSource="notification_return" className="flex items-center gap-2 rounded-full border border-purple-300 px-6 py-3" /></div>
      <CompositionFeedback jobId={result.jobId} source="notification_return" />
      <Exp001SurveyInvitation source="notification_return" /></>}
  </section>;
}
