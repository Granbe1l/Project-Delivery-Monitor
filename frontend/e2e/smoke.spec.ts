import { test, expect } from "@playwright/test";

test("TEST DATA only: empty states, routes, selection and mobile layout", async ({
  page,
}) => {
  const { default: empty } = await import(
    "../tests/fixtures/empty-dashboard.json",
    { with: { type: "json" } }
  );
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    const project =
      empty.projects.find((p) => path.includes(`/projects/${p.id}/`)) ??
      empty.projects[0];
    if (path === "/api/projects")
      return route.fulfill({ json: empty.projects });
    if (path.endsWith("/overview"))
      return route.fulfill({ json: { ...empty.overview, project } });
    if (path.endsWith("/findings")) return route.fulfill({ json: [] });
    if (path.endsWith("/brief"))
      return route.fulfill({
        json: {
          title: "TEST DATA brief",
          overview: { ...empty.overview, project },
          findings: [],
          limitations: [],
        },
      });
    if (path.endsWith("/trends"))
      return route.fulfill({
        json: {
          status: "insufficient_data",
          points: [],
          limitation: "TEST DATA",
        },
      });
    return route.fulfill({
      json: {
        items: [],
        total_in_observation: 0,
        page: 1,
        page_size: 10,
        coverage: "unavailable",
        observed_at: null,
      },
    });
  });
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/overview");
  await expect(
    page.getByRole("heading", { name: "Project Delivery Monitor" }),
  ).toBeVisible();
  await expect(
    page.locator(".metric").first().getByText("Data unavailable"),
  ).toBeVisible();
  await expect(page.locator(".metrics")).not.toContainText("NaN");
  await page.getByLabel("Monitoring").selectOption({ label: "apache/airflow" });
  await expect(page).toHaveURL(/project=/);
  for (const [route, heading] of [
    ["details", "Project details"],
    ["issues", "Issues & backlog"],
    ["pulls", "Pull request review"],
    ["ci", "CI/CD activity"],
    ["risks", "Risks & recommendations"],
  ]) {
    await page.locator(`nav a[href^="/${route}"]`).click();
    await expect(
      page.getByRole("heading", { name: heading, exact: true }),
    ).toBeVisible();
  }
  await expect(
    page.getByRole("button", { name: "Export brief (.txt)" }),
  ).toHaveCount(0);
  await page.goto("/overview");
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    page.getByRole("button", { name: "Toggle navigation" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Toggle navigation" }).click();
  await page.locator('nav a[href^="/issues"]').click();
  await expect(
    page.getByRole("heading", { name: "Issues & backlog", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
});

test("API outage is visible and can be retried", async ({ page }) => {
  await page.route("**/api/projects", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: '{"detail":"Database unavailable"}',
    }),
  );
  await page.goto("/overview");
  await expect(page.getByRole("alert")).toContainText(
    "We couldn’t load this view",
  );
  await page.unroute("**/api/projects");
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.getByLabel("Monitoring")).toBeEnabled();
  await expect(
    page.getByRole("heading", { name: "Delivery at a glance" }),
  ).toBeVisible();
});

test("TEST DATA only: populated search, pagination, evidence and brief export", async ({
  page,
}) => {
  const { default: fixture } = await import(
    "../tests/fixtures/dashboard.json",
    { with: { type: "json" } }
  );
  const { readFile } = await import("node:fs/promises");
  const observed = fixture.overview.observed_at;
  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    let response: unknown;
    if (url.pathname === "/api/projects") response = [fixture.project];
    else if (url.pathname.endsWith("/overview")) response = fixture.overview;
    else if (url.pathname.endsWith("/findings")) response = fixture.findings;
    else if (url.pathname.endsWith("/brief"))
      response = {
        title: "Project Intelligence Brief",
        overview: fixture.overview,
        findings: fixture.findings,
        limitations: ["SYNTHETIC TEST DATA — no real GitHub assessment."],
      };
    else if (url.pathname.endsWith("/pull-requests")) {
      const q = url.searchParams.get("q") || "";
      const pageNumber = Number(url.searchParams.get("page") || "1");
      const pageSize = Number(url.searchParams.get("page_size") || "25");
      const matching = fixture.pulls.filter((p) =>
        p.title.toLowerCase().includes(q.toLowerCase()),
      );
      response = {
        items: matching.slice(
          (pageNumber - 1) * pageSize,
          pageNumber * pageSize,
        ),
        total_in_observation: matching.length,
        page: pageNumber,
        page_size: pageSize,
        coverage: "complete",
        observed_at: observed,
      };
    } else
      return route.fulfill({
        status: 404,
        json: { detail: "Unexpected fixture endpoint" },
      });
    await route.fulfill({ json: response });
  });
  await page.goto("/pulls?project=1");
  await expect(page.getByText("26 matching collected records")).toBeVisible();
  await page.getByRole("button", { name: "Next page" }).click();
  await expect(
    page.getByText("TEST DATA: change 11", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("TEST DATA: change 01", { exact: true }),
  ).toHaveCount(0);
  await page.getByLabel("Search titles").fill("change 01");
  await expect(page.getByText("1 matching collected records")).toBeVisible();
  await expect(
    page.getByText("TEST DATA: change 01", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "View evidence" }),
  ).toHaveAttribute("href", fixture.pulls[0].html_url);
  await page.locator('nav a[href^="/risks"]').click();
  await expect(page.getByText(fixture.findings[0].observation)).toBeVisible();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export brief (.txt)" }).click();
  const download = await downloadPromise;
  const content = await readFile((await download.path())!, "utf8");
  expect(content).toContain(fixture.findings[0].evidence_url);
  expect(content).toContain("pr_age v1.0");
  expect(content).toContain("SYNTHETIC TEST DATA");
  await page
    .getByLabel("Finding type", { exact: true })
    .selectOption("milestone_due");
  await expect(
    page.getByRole("heading", { name: "No matching findings" }),
  ).toBeVisible();
});

test("TEST DATA only: stale and retained sources preserve warnings, scope and export metadata", async ({
  page,
}) => {
  const { default: fixture } = await import(
    "../tests/fixtures/dashboard.json",
    { with: { type: "json" } }
  );
  const overview = structuredClone(fixture.overview);
  overview.stale = true;
  overview.status = "stale";
  overview.last_attempt_status = "failure";
  const coverage = {
    ...overview.coverage,
    pulls: {
      ...overview.coverage.pulls,
      retained: true,
      observed_at: "2026-10-01T00:00:00Z",
    },
  };
  const info = { ...overview, coverage };
  await page.route("**/api/**", (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/projects")
      return route.fulfill({ json: [fixture.project] });
    if (path.endsWith("/overview")) return route.fulfill({ json: info });
    if (path.endsWith("/findings"))
      return route.fulfill({ json: fixture.findings });
    if (path.endsWith("/trends"))
      return route.fulfill({
        json: {
          status: "available",
          points: [
            { observed_at: info.observed_at, metrics: info.metrics, coverage },
          ],
          limitation: "TEST DATA: retained scope",
        },
      });
    if (path.endsWith("/milestones"))
      return route.fulfill({
        json: {
          items: [],
          total_in_observation: 0,
          page: 1,
          page_size: 10,
          coverage: "complete",
          observed_at: info.observed_at,
        },
      });
    return route.fulfill({
      status: 404,
      json: { detail: "Unexpected fixture endpoint" },
    });
  });
  await page.goto("/overview");
  await expect(page.locator(".notice")).toContainText(
    "This observation is stale",
  );
  await expect(page.locator(".notice")).toContainText(
    "last successful observations",
  );
  await expect(page.locator(".metric strong").nth(1)).toHaveText("26");
  await page.locator(".source-quality > summary").click();
  await expect(page.getByText("retained · refresh failed")).toBeVisible();
  await page.locator('nav a[href^="/details"]').click();
  await expect(page.locator("table tbody")).toContainText(
    "Retained data — mixed observation times",
  );
});
