export type CompositionJob = {
  job_id: string;
  status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";
  source_gif_url: string;
  target_asset_id: string | null;
  result_url: string | null;
  result_asset_id: string | null;
  created_at: string;
};
