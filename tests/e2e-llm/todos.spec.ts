import { expect, test } from "@playwright/test";

// Makes real model calls, so it is kept out of the default suite; see
// playwright.llm.config.ts. Hits data/app.db like tests/e2e/auth.spec.ts, hence
// the stamped email.
test("the tutor captures an item and the sidebar shows it", async ({
  page,
}) => {
  const email = `e2e-llm-${Date.now()}@example.com`;

  await page.goto("/signup");
  await page.getByLabel("Name").fill("Ada Lovelace");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("correct-horse-battery");
  await page.getByRole("button", { name: "Sign up" }).click();

  await expect(page).toHaveURL("/");

  const sidebar = page.getByTestId("todos-sidebar");
  await expect(sidebar).toContainText("Nothing on the list yet");

  const input = page.getByPlaceholder("Add something to the list…");
  await input.fill('Please add "buy milk" to my list.');
  await input.press("Enter");

  // The agent has to reach addTodo and the refresh has to land, so this waits
  // through a full model round trip rather than the default expect timeout.
  await expect(sidebar.getByText(/buy milk/i)).toBeVisible({ timeout: 90_000 });

  // The same call is shown in the transcript as a finished tool-call card.
  await expect(
    page.locator('[data-testid="tool-call"][data-tool="addTodo"]'),
  ).toHaveAttribute("data-phase", "done");
});
