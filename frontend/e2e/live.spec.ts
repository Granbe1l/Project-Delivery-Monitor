import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import type { Project, Overview, Page, Finding, Trends } from "../src/api";

// Uses the running app API and PostgreSQL observations. No routes or data are mocked.
test("live GitHub observations match the rendered dashboard for all projects", async ({
  page,
  request,
}) => {
  const projectsResponse = await request.get("/api/projects");
  expect(projectsResponse.status()).toBe(200);
  const projects: Project[] = await projectsResponse.json();
  expect(projects).toHaveLength(3);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  for (const project of projects) {
    const response = await request.get(`/api/projects/${project.id}/overview`);
    expect(response.status()).toBe(200);
    const overview: Overview = await response.json();
    expect(overview.metrics).not.toBeNull();
    expect(overview.observed_at).not.toBeNull();
    expect(overview.last_attempt_status).not.toBe("failure");
    await page.goto(`/overview?project=${project.id}`);
    await expect(page.getByLabel("Monitoring")).toHaveValue(String(project.id));
    const values = [
      overview.metrics!.open_issues,
      overview.metrics!.open_prs,
      overview.metrics!.prs_needing_attention,
      `${overview.metrics!.ci_failures} / ${overview.metrics!.ci_completed}`,
    ];
    for (let i = 0; i < values.length; i++)
      await expect(page.locator(".metric strong").nth(i)).toHaveText(
        String(values[i] ?? "—"),
      );
    await expect(page.getByText("TEST DATA", { exact: false })).toHaveCount(0);
    const issues: Page = await (
      await request.get(`/api/projects/${project.id}/issues`)
    ).json();
    expect(issues.items.length).toBeGreaterThan(0);
    await page.locator('nav a[href^="/issues"]').click();
    await expect(
      page.getByText(issues.items[0].title!, { exact: true }),
    ).toBeVisible();
    await expect(
      page
        .locator("tbody tr")
        .first()
        .getByRole("link", { name: "View evidence" }),
    ).toHaveAttribute("href", issues.items[0].html_url);
  }
  expect(errors).toEqual([]);
});

test("live records support search, paging, source evidence, history and brief download", async ({
  page,
  request,
}) => {
  const projects: Project[] = await (await request.get("/api/projects")).json();
  const project = projects.find((p) => p.full_name === "streamlit/streamlit")!;
  const pulls: Page = await (
    await request.get(`/api/projects/${project.id}/pull-requests`)
  ).json();
  expect(pulls.items.length).toBeGreaterThan(0);
  await page.goto(`/pulls?project=${project.id}`);
  await expect(
    page.getByText(pulls.items[0].title!, { exact: true }),
  ).toBeVisible();
  await page.getByLabel("Search titles").fill(pulls.items[0].title!);
  await expect(
    page.getByText(pulls.items[0].title!, { exact: true }),
  ).toBeVisible();
  await expect(page.locator("tbody a").first()).toHaveAttribute(
    "href",
    pulls.items[0].html_url,
  );
  await page.getByLabel("Search titles").fill("");
  if (pulls.total_in_observation > pulls.page_size) {
    const next: Page = await (
      await request.get(`/api/projects/${project.id}/pull-requests?page=2`)
    ).json();
    await page.getByRole("button", { name: "Next page" }).click();
    await expect(
      page.getByText(next.items[0].title!, { exact: true }),
    ).toBeVisible();
  }
  const findings: Finding[] = await (
    await request.get(`/api/projects/${project.id}/findings`)
  ).json();
  await page.locator('nav a[href^="/risks"]').click();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export brief (.txt)" }).click();
  const download = await downloadPromise;
  const text = await readFile((await download.path())!, "utf8");
  expect(text).toContain(project.full_name);
  expect(text).not.toContain("TEST DATA");
  if (findings.length) expect(text).toContain(findings[0].evidence_url);
  const trends: Trends = await (
    await request.get(`/api/projects/${project.id}/trends`)
  ).json();
  expect(trends.points.length).toBeGreaterThanOrEqual(2);
  await page.locator('nav a[href^="/details"]').click();
  await expect(
    page.getByRole("heading", { name: "Observation history" }),
  ).toBeVisible();
  await expect(page.locator("table tbody tr")).toHaveCount(
    trends.points.length,
  );
});

test("live UI desktop and mobile screenshots, with no browser errors or overflow", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/overview?project=1");
  await expect(
    page.getByRole("heading", { name: "What needs attention" }),
  ).toBeVisible();
  await expect(page.locator(".finding").first()).toBeVisible();
  await page.screenshot({
    path: new URL(
      "../../docs/screenshots/overview-live-desktop.png",
      import.meta.url,
    ).pathname,
    fullPage: true,
  });
  await page.goto("/ci?project=1");
  await expect(page.locator("tbody tr").first()).toBeVisible();
  await page.screenshot({
    path: new URL("../../docs/screenshots/ci-live-desktop.png", import.meta.url)
      .pathname,
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/overview?project=1");
  await expect(page.locator(".finding").first()).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: new URL(
      "../../docs/screenshots/overview-live-mobile.png",
      import.meta.url,
    ).pathname,
    fullPage: true,
  });
  await page.getByRole("button", { name: "Toggle navigation" }).click();
  await page.locator('nav a[href^="/issues"]').click();
  await expect(page.locator("tbody tr").first()).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
});

test("all six live views, creation-period filters, CI branches and milestone pagination", async ({
  page,
  request,
}) => {
  const projects: Project[] = await (await request.get("/api/projects")).json();
  const project = projects.find((p) => p.full_name === "apache/airflow")!;
  await page.goto(`/overview?project=${project.id}`);
  for (const [path, title] of [
    ["details", "Project details"],
    ["issues", "Issues & backlog"],
    ["pulls", "Pull request review"],
    ["ci", "CI/CD activity"],
    ["risks", "Risks & recommendations"],
    ["overview", "Delivery at a glance"],
  ]) {
    await page.locator(`nav a[href^="/${path}"]`).click();
    await expect(
      page.getByRole("heading", { name: title, exact: true }),
    ).toBeVisible();
    await expect(page.locator('[role="alert"]')).toHaveCount(0);
  }
  await page.locator('nav a[href^="/issues"]').click();
  const issues: Page = await (
    await request.get(`/api/projects/${project.id}/issues?period=7`)
  ).json();
  await page.getByLabel("Created within").selectOption("7");
  await expect(
    page.getByText(`${issues.total_in_observation} matching collected records`),
  ).toBeVisible();
  await page.getByLabel("Search titles").fill("pdm-no-matching-title-8fe72cc3");
  await expect(
    page.getByRole("heading", { name: "No matching records" }),
  ).toBeVisible();
  await page.locator('nav a[href^="/ci"]').click();
  const ci: Page = await (
    await request.get(
      `/api/projects/${project.id}/ci?period=7&branch=${encodeURIComponent(project.default_branch!)}`,
    )
  ).json();
  await page.getByLabel("Created within").selectOption("7");
  await page
    .getByRole("textbox", { name: "Branch", exact: true })
    .fill(project.default_branch!);
  await expect(
    page.getByText(`${ci.total_in_observation} matching collected records`),
  ).toBeVisible();
  if (ci.items.length)
    await expect(page.locator("tbody tr").first()).toContainText(
      ci.items[0].branch!,
    );
  await page
    .getByRole("textbox", { name: "Branch", exact: true })
    .fill("pdm-nonexistent-branch-8fe72cc3");
  await expect(
    page.getByRole("heading", { name: "No matching records" }),
  ).toBeVisible();
  await page.locator('nav a[href^="/details"]').click();
  const second: Page = await (
    await request.get(
      `/api/projects/${project.id}/milestones?page_size=10&page=2`,
    )
  ).json();
  expect(second.items.length).toBeGreaterThan(0);
  await page.getByRole("button", { name: "Next milestone page" }).click();
  await expect(page.locator(".milestone h3").first()).toHaveText(
    second.items[0].title!,
  );
  await page
    .getByLabel("Monitoring")
    .selectOption({ label: "streamlit/streamlit" });
  await expect(
    page.getByRole("button", { name: "Previous milestone page" }),
  ).toBeDisabled();
});

for (const viewport of [
  { width: 1440, height: 1000 },
  { width: 390, height: 844 },
]) {
  test(`live accessibility checks on all six views at ${viewport.width}px`, async ({
    page,
  }) => {
    const { default: AxeBuilder } = await import("@axe-core/playwright");
    await page.setViewportSize(viewport);
    for (const route of [
      "overview",
      "details",
      "issues",
      "pulls",
      "ci",
      "risks",
    ]) {
      await page.goto(`/${route}?project=1`);
      await expect(page.locator(".skeleton")).toHaveCount(0);
      await expect(page.locator("h1")).toBeVisible();
      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze();
      expect(
        results.violations.map((v) => ({
          rule: v.id,
          impact: v.impact,
          description: v.description,
          nodes: v.nodes.map((n) => ({
            target: n.target,
            summary: n.failureSummary,
          })),
        })),
        route,
      ).toEqual([]);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    }
    await page.goto("/overview?project=1");
    await page.keyboard.press("Tab");
    await expect(
      page.getByRole("link", { name: "Skip to content" }),
    ).toBeFocused();
    if (viewport.width === 390) {
      await page.keyboard.press("Tab");
      await expect(
        page.getByRole("button", { name: "Toggle navigation" }),
      ).toBeFocused();
    }
  });
}
