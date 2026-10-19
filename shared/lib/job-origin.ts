type EventContext = Record<string, string | number | boolean>;
type JobOrigin = { jobId: string; flowId: string; attemptId: string };
type StoredOrigins = { ownerId: string; jobs: JobOrigin[] };

const STORAGE_KEY = "gifgloo_job_origins";
const MAX_JOB_ORIGINS = 50;
let ownerId: string | null = null;

function read(): StoredOrigins | null {
  try {
    const saved = sessionStorage.getItem(STORAGE_KEY);
    if (!saved) return null;
    const parsed = JSON.parse(saved) as StoredOrigins;
    if (typeof parsed.ownerId !== "string" || !Array.isArray(parsed.jobs) || parsed.jobs.length > MAX_JOB_ORIGINS ||
      !parsed.jobs.every(job => typeof job.jobId === "string" && typeof job.flowId === "string" && typeof job.attemptId === "string")) return null;
    return parsed;
  } catch (error) {
    console.warn("Job origin storage unavailable", error);
    return null;
  }
}

export function setJobOriginOwner(nextOwnerId: string | null): void {
  ownerId = nextOwnerId;
  const saved = read();
  if (!nextOwnerId || (saved && saved.ownerId !== nextOwnerId)) {
    try { sessionStorage.removeItem(STORAGE_KEY); }
    catch (error) { console.warn("Job origin storage unavailable", error); }
  }
}

export function rememberJobOrigin(jobId: string, acceptedOwnerId: string, context: EventContext): void {
  if (ownerId !== acceptedOwnerId || typeof context.flow_id !== "string" || typeof context.attempt_id !== "string") return;
  const saved = read();
  const jobs = saved?.ownerId === ownerId ? saved.jobs : [];
  if (jobs.some(job => job.jobId === jobId)) return;
  jobs.push({ jobId, flowId: context.flow_id, attemptId: context.attempt_id });
  try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ ownerId, jobs: jobs.slice(-MAX_JOB_ORIGINS) })); }
  catch (error) { console.warn("Job origin storage unavailable", error); }
}

export function jobOriginContext(jobId?: string): EventContext {
  const saved = jobId && ownerId ? read() : null;
  const origin = saved?.ownerId === ownerId ? saved?.jobs.find(job => job.jobId === jobId) : undefined;
  return origin ? {
    origin_linkage: "known", origin_flow_id: origin.flowId, origin_attempt_id: origin.attemptId,
  } : { origin_linkage: "unknown" };
}
