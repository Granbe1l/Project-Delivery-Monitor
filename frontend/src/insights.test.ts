import { describe, it, expect } from "vitest";
import { keyFindings } from "./insights";
import fixture from "../tests/fixtures/dashboard.json";
import type { Overview } from "./api";
const info = () =>
  ({
    ...fixture.overview,
    metrics: {
      ...fixture.overview.metrics,
      open_issues: 122,
      issue_age_bins: { "30+ days": 84, "0–6 days": 38 },
      open_prs: 194,
      prs_needing_attention: 34,
      ci_completed: 20,
      ci_failures: 0,
    },
  }) as Overview;
describe("deterministic findings", () => {
  it("uses explicit denominators and rounded percentages", () => {
    const rows = keyFindings(info());
    expect(rows[0].title).toContain("69%");
    expect(rows[1].title).toContain("18%");
    expect(rows[2].title).toContain("0%");
  });
  it("does not replace unknown or zero denominators", () => {
    const i = info();
    i.metrics = null;
    expect(keyFindings(i)).toEqual([]);
    const j = info();
    j.metrics!.ci_completed = 0;
    expect(keyFindings(j).some((x) => x.source === "ci")).toBe(false);
  });
  it("rejects inconsistent bins and preserves partial scope", () => {
    const i = info();
    i.metrics!.open_issues = 1;
    expect(keyFindings(i).some((x) => x.source === "issues")).toBe(false);
    const j = info();
    j.coverage = {
      ...j.coverage,
      issues: { coverage: "partial", retained: true },
    };
    expect(keyFindings(j)[0].sample).toContain("partial · retained");
  });
});
