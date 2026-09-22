const COMPOSITION_FEEDBACK_GUARD_EVENT = "composition-feedback-guard";

type GuardDetail = {
  action: () => void;
};

export function runAfterCompositionFeedback(action: () => void) {
  const event = new CustomEvent<GuardDetail>(COMPOSITION_FEEDBACK_GUARD_EVENT, {
    cancelable: true,
    detail: { action },
  });

  if (document.dispatchEvent(event)) action();
}

export function listenForCompositionFeedbackGuard(
  listener: (event: CustomEvent<GuardDetail>) => void,
) {
  document.addEventListener(
    COMPOSITION_FEEDBACK_GUARD_EVENT,
    listener as EventListener,
  );

  return () => {
    document.removeEventListener(
      COMPOSITION_FEEDBACK_GUARD_EVENT,
      listener as EventListener,
    );
  };
}
