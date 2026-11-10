export type Project = {
  id: number;
  full_name: string;
  default_branch: string | null;
  html_url: string | null;
  enabled: boolean;
};
export type Coverage = {
  coverage: "complete" | "partial" | "unavailable";
  error?: string;
  pages?: number;
  observed_at?: string;
  retained?: boolean;
};
export type Metrics = {
  open_issues: number | null;
  open_prs: number | null;
  prs_needing_attention: number | null;
  labeled_bug_reports: number | null;
  ci_completed: number | null;
  ci_failures: number | null;
  ci_conclusions: Record<string, number> | null;
  issue_age_bins: Record<string, number> | null;
};
export type Overview = {
  project: Project;
  observed_at: string | null;
  last_successful_sync_at: string | null;
  last_attempt_at: string | null;
  last_attempt_status: string | null;
  stale: boolean;
  status: string;
  coverage: Record<string, Coverage>;
  metrics: Metrics | null;
  policy: Record<string, number>;
  scope: string;
};
export type Finding = {
  rule_id: string;
  rule_version: string;
  subject_type: string;
  subject_id: string;
  observed_at: string;
  evidence_url: string;
  observation: string;
  explanation: string;
  recommendation: string;
  limitations: string;
  severity: string;
};
export type RecordRow = {
  github_id: number;
  html_url: string;
  last_seen_at: string;
  number?: number;
  title?: string;
  name?: string;
  state?: string;
  labels?: { name: string }[];
  created_at?: string;
  updated_at?: string;
  draft?: boolean;
  requested_reviewers?: string[];
  status?: string;
  conclusion?: string | null;
  branch?: string | null;
  event?: string;
  due_on?: string | null;
  open_issues?: number;
  closed_issues?: number;
};
export type Page = {
  items: RecordRow[];
  total_in_observation: number;
  page: number;
  page_size: number;
  coverage: string;
  observed_at: string | null;
};
export type Trends = {
  status: string;
  points: {
    observed_at: string;
    metrics: Metrics;
    coverage: Record<string, Coverage>;
  }[];
  limitation: string;
};
export type Brief = {
  title: string;
  overview: Overview;
  findings: Finding[];
  limitations: string[];
};
export async function api<T>(path: string): Promise<T> {
  const response = await fetch(
    `${import.meta.env.VITE_PUBLIC_API_BASE_URL || ""}/api${path}`,
    { signal: AbortSignal.timeout(15000) },
  );
  if (!response.ok)
    throw new Error(
      response.status === 503
        ? "The database is currently unavailable. Please try again."
        : `Could not load data (HTTP ${response.status}).`,
    );
  return response.json();
}
export function timestamp(value: string | null | undefined) {
  return value
    ? new Date(value).toLocaleString("en-GB", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "UTC",
      }) + " UTC"
    : "Not yet observed";
}
export function age(value: string | undefined, observed: string | null) {
  return value && observed
    ? Math.max(
        0,
        Math.floor((Date.parse(observed) - Date.parse(value)) / 86400000),
      )
    : null;
}
