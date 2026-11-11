import { test, expect } from "@playwright/test";

test("live refinement: bounded findings, search, sort, disclosure and drawer keyboard", async ({
  page,
  request,
}) => {
  const findings = await (await request.get("/api/projects/1/findings")).json();
  await page.goto("/risks?project=1");
  await expect(page.locator(".finding")).toHaveCount(
    Math.min(3, findings.length),
  );
  await page.getByRole("button", { name: /Browse all/ }).click();
  await expect(page.locator(".finding")).toHaveCount(
    Math.min(10, findings.length),
  );
  if (findings.length > 10) {
    await page.getByRole("button", { name: "Next findings" }).click();
    await expect(page.locator(".pagination")).toContainText("Page 2");
  }
  await page.getByLabel("Search findings").fill("no-match-pdm-7328");
  await expect(
    page.getByRole("heading", { name: "No matching findings" }),
  ).toBeVisible();
  await page.getByLabel("Search findings").fill("");
  await page.getByLabel("Sort findings").selectOption("type");
  await page.locator(".finding summary").first().click();
  await expect(page.locator(".finding details").first()).toHaveAttribute(
    "open",
    "",
  );
  for (const route of ["issues", "pulls", "ci"]) {
    await page.goto(`/${route}?project=1`);
    await expect(page.locator("tbody tr").first()).toBeVisible();
    expect(await page.locator("tbody tr").count()).toBeLessThanOrEqual(10);
    await page
      .getByRole("button", { name: "Go to page 2", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Go to page 2", exact: true }),
    ).toHaveAttribute("aria-current", "page");
    await expect(page.locator(".pagination")).toContainText("Page 2");
  }
  await page.goto("/details?project=2");
  await page.getByLabel("Search milestones").fill("no-match-pdm-7328");
  await expect(page.locator(".milestone")).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Toggle navigation" }).click();
  await expect(
    page.getByRole("button", { name: "Close navigation", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "Toggle navigation" }),
  ).toBeFocused();
  await expect(page.locator(".sidebar")).not.toBeVisible();
});

test("executive conclusion precedes metrics and repeated findings share a rule group", async ({
  page,
}) => {
  await page.goto("/overview?project=1");
  await expect(page.locator(".executive-insight article")).toHaveCount(1);
  const hero = await page.locator(".executive-insight").boundingBox();
  const metrics = await page.locator(".metrics").first().boundingBox();
  expect(hero!.y).toBeLessThan(metrics!.y);
  expect(hero!.y + hero!.height).toBeLessThan(1000);
  await page.goto("/risks?project=1");
  await expect(page.locator(".rule-group")).toHaveCount(1);
  await expect(page.locator(".rule-group .group-action")).toHaveCount(1);
  await expect(page.locator(".rule-group .finding .action")).toHaveCount(0);
  await expect(page.locator(".rule-group .finding .evidence")).toHaveCount(3);
});
