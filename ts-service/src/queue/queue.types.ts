// Job name constant
export const GENERATE_SUMMARY_JOB = "generate_candidate_summary";

// Payload for summary generation jobs
export interface GenerateSummaryJobPayload {
  summaryId: string;
  candidateId: string;
}
