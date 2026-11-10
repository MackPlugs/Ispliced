import { expect, test } from "@playwright/test";

test("loop match opens a clickable drop area and explains the desktop requirement", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));

  await page.goto("/");
  await page.getByRole("button", { name: "Loop match", exact: true }).click();

  const dropArea = page.getByRole("button", { name: "Drop or choose a WAV loop to catalogue match" });
  await expect(dropArea).toBeVisible();
  await expect(page.getByText("Drop or upload a WAV loop here to catalogue match")).toBeVisible();
  await expect(page.getByText("Click to choose a .wav file.", { exact: false })).toBeVisible();

  await dropArea.click();
  await expect(page.getByText("Loop matching needs the desktop application.")).toBeVisible();
  expect(errors).toEqual([]);
});
