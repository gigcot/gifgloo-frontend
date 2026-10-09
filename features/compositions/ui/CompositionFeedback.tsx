"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useAuth } from "@/shared/lib/use-auth";
import { trackEvent } from "@/shared/lib/umami";
import {
  getCompositionFeedback, submitCompositionFeedback, type AuthFetch,
} from "@/features/compositions/model/composition-feedback-api";
import styles from "./CompositionFeedback.module.css";

type Props = {
  jobId: string;
  source: "composition_result" | "my_assets" | "notification_return";
};
type State =
  | { status: "loading" | "saving" | "error" }
  | { status: "ready"; satisfied: boolean | null };

export function CompositionFeedback(props: Props) {
  const { authFetch, checked, userId } = useAuth();
  if (!checked || !userId) return null;
  return <OwnedFeedback key={`${userId}:${props.jobId}`} {...props} authFetch={authFetch} />;
}

function OwnedFeedback({ jobId, source, authFetch }: Props & { authFetch: AuthFetch }) {
  const titleId = useId();
  const [state, setState] = useState<State>({ status: "loading" });
  const [reload, setReload] = useState(0);
  const submission = useRef<AbortController | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    getCompositionFeedback(authFetch, jobId, controller.signal)
      .then(satisfied => {
        if (!controller.signal.aborted) setState({ status: "ready", satisfied });
      })
      .catch(() => {
        if (!controller.signal.aborted) setState({ status: "error" });
      });
    return () => controller.abort();
  }, [authFetch, jobId, reload]);

  useEffect(() => () => submission.current?.abort(), []);

  async function submit(satisfied: boolean) {
    if (submission.current || state.status !== "ready" || state.satisfied !== null) return;
    const controller = new AbortController();
    submission.current = controller;
    setState({ status: "saving" });
    try {
      const result = await submitCompositionFeedback(authFetch, jobId, satisfied, controller.signal);
      if (controller.signal.aborted) return;
      const saved = result === "created"
        ? satisfied
        : await getCompositionFeedback(authFetch, jobId, controller.signal);
      if (controller.signal.aborted) return;
      setState({ status: "ready", satisfied: saved });
      if (result === "created") trackEvent("composition_feedback_submitted", { satisfied, job_id: jobId, source });
    } catch {
      if (!controller.signal.aborted) setState({ status: "error" });
    } finally {
      if (submission.current === controller) submission.current = null;
    }
  }

  const submitted = state.status === "ready" && state.satisfied !== null;
  return <section className={styles.feedback} aria-labelledby={titleId}>
    <h2 id={titleId}>{submitted ? "평가해 주셔서 감사해요" : "결과는 어땠나요?"}</h2>
    {submitted && <p role="status" className="mt-2 text-sm text-white/60">
      ‘{state.satisfied ? "만족해요" : "아쉬워요"}’로 응답했어요. 결과마다 한 번만 평가할 수 있어요.
    </p>}
    {((state.status === "ready" && !submitted) || state.status === "saving") && <div className={styles.options} role="group" aria-labelledby={titleId}>
      <button type="button" disabled={state.status === "saving"} onClick={() => void submit(false)}>아쉬워요</button>
      <button type="button" disabled={state.status === "saving"} onClick={() => void submit(true)}>만족해요</button>
    </div>}
    {state.status === "loading" && <p role="status" className="mt-2 text-sm text-white/60">평가 상태를 확인하고 있어요.</p>}
    {state.status === "saving" && <p role="status" className="mt-2 text-sm text-white/60">응답을 저장하고 있어요.</p>}
    {state.status === "error" && <div className="mt-2 text-sm text-white/60">
      <p role="alert">평가 상태를 확인하지 못했어요. 저장·공유는 계속할 수 있어요.</p>
      <button type="button" className="mt-2 min-h-11 underline" onClick={() => {
        setState({ status: "loading" }); setReload(value => value + 1);
      }}>평가 상태 다시 확인</button>
    </div>}
  </section>;
}
