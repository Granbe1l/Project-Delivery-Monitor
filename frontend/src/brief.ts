import { timestamp } from "./api";
import type { Brief, Coverage } from "./api";

export function historyCoverage(coverage: Record<string, Coverage>) {
  if (Object.values(coverage).some((c) => c.retained))
    return "Retained data — mixed observation times";
  return Object.values(coverage).every((c) => c.coverage === "complete")
    ? "Complete"
    : "Partial — not directly comparable";
}

/** A concise stakeholder summary; the full findings remain available in the dashboard. */
export function formatBrief(brief: Brief): string {
  const { overview: o } = brief;
  const m = o.metrics;
  const metric = (value: number | null | undefined) =>
    value == null ? "Data unavailable" : String(value);
  const coverage = Object.entries(o.coverage)
    .filter(([key]) => key !== "repository")
    .map(
      ([key, c]) =>
        `${key === "pulls" ? "Pull requests" : key === "workflows" ? "Workflow runs" : key[0].toUpperCase() + key.slice(1)}: ${c.coverage}${c.retained ? " (retained; refresh failed)" : ""}; observed ${timestamp(c.observed_at)}`,
    );
  const findings = brief.findings.slice(0, 3);
  const freshness =
    o.status === "unavailable"
      ? "Data unavailable"
      : o.stale
        ? "Stale — current conditions may differ"
        : "Within the configured freshness window";
  return [
    brief.title,
    o.project.full_name,
    `Observed: ${timestamp(o.observed_at)}`,
    `Freshness: ${freshness}`,
    `Last sync attempt: ${o.last_attempt_status ?? "Not yet attempted"}; ${timestamp(o.last_attempt_at)}`,
    "",
    "OBSERVED FACTS (collected scope)",
    `Open issues: ${metric(m?.open_issues)}; open PRs: ${metric(m?.open_prs)}; PRs crossing policy: ${metric(m?.prs_needing_attention)}.`,
    `CI failures: ${metric(m?.ci_failures)} / ${metric(m?.ci_completed)} completed default-branch runs.`,
    o.scope,
    "",
    "COVERAGE AND SOURCE TIMES",
    ...coverage,
    "",
    `WHAT TO REVIEW — ${findings.length} of ${brief.findings.length} findings`,
    ...(findings.length
      ? findings.map(
          (f, i) =>
            `${i + 1}. ${f.observation}\nWhy flagged: ${f.explanation}\nSuggested action: ${f.recommendation}\nEvidence: ${f.evidence_url}\nObserved: ${timestamp(f.observed_at)}; rule ${f.rule_id} v${f.rule_version}.\nLimit: ${f.limitations}`,
        )
      : [
          m
            ? "No rule matched the collected records; this is not an overall health assessment."
            : "Data unavailable; no assessment can be made.",
        ]),
    ...(brief.findings.length > findings.length
      ? [
          "Open Risks & recommendations in the dashboard for the complete findings.",
        ]
      : []),
    "",
    "INTERPRETATION LIMITS",
    ...brief.limitations.map((l) => `- ${l}`),
    `Demonstration policy: PR age ${o.policy.pr_age_days} days or inactivity ${o.policy.pr_idle_days} days; CI failures ${o.policy.ci_failure_threshold}; stale after ${o.policy.stale_hours} hours.`,
    ...(o.project.html_url ? [`Repository: ${o.project.html_url}`] : []),
  ].join("\n");
}
