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
