import type { Overview } from "./api";
export type Insight = {
  title: string;
  meaning: string;
  action: string;
  source: string;
  sample: string;
};
export function keyFindings(info: Overview): Insight[] {
  const m = info.metrics;
  if (!m) return [];
  const out: Insight[] = [];
  const valid = (n: number | null | undefined, d: number | null | undefined) =>
    n != null &&
    d != null &&
    Number.isInteger(n) &&
    Number.isInteger(d) &&
    n >= 0 &&
    d > 0 &&
    n <= d;
  const scope = (source: string, n: number, d: number) =>
    `${n} / ${d} collected records · ${info.coverage[source]?.coverage ?? "unavailable"}${info.coverage[source]?.retained ? " · retained" : ""}`;
  const available = (source: string) =>
    info.coverage[source] && info.coverage[source].coverage !== "unavailable";
  const old = m.issue_age_bins?.["30+ days"];
  if (
    available("issues") &&
    valid(old, m.open_issues) &&
    Object.values(m.issue_age_bins!).reduce((a, b) => a + b, 0) ===
      m.open_issues
  )
    out.push({
      title: `${Math.round((old! / m.open_issues!) * 100)}% of collected open issues are at least 30 days old.`,
      meaning: "This describes age, not delay or backlog quality.",
      action:
        "Review older issues for relevance, ownership and the next decision.",
      source: "issues",
      sample: scope("issues", old!, m.open_issues!),
    });
  if (available("pulls") && valid(m.prs_needing_attention, m.open_prs))
    out.push({
      title: `${Math.round((m.prs_needing_attention! / m.open_prs!) * 100)}% of collected open PRs meet an attention rule.`,
      meaning: `Non-draft PRs cross the ${info.policy.pr_age_days}-day age or ${info.policy.pr_idle_days}-day inactivity threshold. The denominator includes drafts.`,
      action:
        "Check review requests and recent discussion before deciding a next step.",
      source: "pulls",
      sample: scope("pulls", m.prs_needing_attention!, m.open_prs!),
    });
  if (available("workflows") && valid(m.ci_failures, m.ci_completed))
    out.push({
      title: `${Math.round((m.ci_failures! / m.ci_completed!) * 100)}% of collected completed checks ended in failure.`,
      meaning:
        "Default branch, 30-day collection window. Other conclusions remain distinct; this does not measure production reliability.",
      action: m.ci_failures
        ? "Inspect failed run logs and subsequent runs for the same workflow."
        : "Review skipped and other outcomes before drawing conclusions from zero failures.",
      source: "ci",
      sample: scope("workflows", m.ci_failures!, m.ci_completed!),
    });
  return out;
}
