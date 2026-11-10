import { describe, expect, it } from "vitest";
import { formatBrief, historyCoverage } from "./brief";
import type { Brief } from "./api";
import fixture from "../tests/fixtures/dashboard.json";

const base: Brief = {
  title: "Project Intelligence Brief",
  overview: fixture.overview as Brief["overview"],
  findings: fixture.findings,
  limitations: ["TEST DATA only."],
};
describe("Stakeholder brief and coverage", () => {
  it("uses readable facts and bounds the summary without hiding the full finding count", () => {
    const b = structuredClone(base);
    b.findings = Array.from({ length: 6 }, (_, i) => ({
      ...b.findings[0],
      observation: `TEST DATA: finding ${i + 1}`,
    }));
    const report = formatBrief(b);
    expect(report).toContain("Open issues: 0; open PRs: 26");
    expect(report).toContain("3 of 6 findings");
    expect(report).toContain("TEST DATA: finding 3");
    expect(report).not.toContain("TEST DATA: finding 4");
    expect(report).toContain("https://github.com/streamlit/streamlit/pull/1");
    expect(report).not.toContain('"open_issues"');
  });
  it("reports stale, failed and retained source metadata", () => {
    const b = structuredClone(base);
    b.overview.stale = true;
    b.overview.last_attempt_status = "failure";
    b.overview.coverage.pulls.retained = true;
    const report = formatBrief(b);
    expect(report).toContain("Freshness: Stale");
    expect(report).toContain("Last sync attempt: failure");
    expect(report).toContain("retained; refresh failed");
    expect(historyCoverage(b.overview.coverage)).toContain(
      "mixed observation times",
    );
  });
  it("keeps unknown values distinct from zero and does not imply healthy status", () => {
    const b = structuredClone(base);
    b.overview.metrics = null;
    b.overview.status = "unavailable";
    b.findings = [];
    const report = formatBrief(b);
    expect(report).toContain("Open issues: Data unavailable");
    expect(report).toContain("no assessment can be made");
  });
});
