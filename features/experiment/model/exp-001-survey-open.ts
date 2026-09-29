const OPEN_EXP_001_SURVEY_EVENT = "open-exp-001-survey";

export function requestExp001SurveyOpen(): void {
  document.dispatchEvent(new Event(OPEN_EXP_001_SURVEY_EVENT));
}

export function listenForExp001SurveyOpen(listener: () => void): () => void {
  document.addEventListener(OPEN_EXP_001_SURVEY_EVENT, listener);
  return () => document.removeEventListener(OPEN_EXP_001_SURVEY_EVENT, listener);
}
