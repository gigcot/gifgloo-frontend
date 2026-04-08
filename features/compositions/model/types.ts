export type CompositionJob = {
  job_id: string;
  status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";
  source_gif_url: string;
  target_url: string;
  result_url: string | null;
  created_at: string;
};
