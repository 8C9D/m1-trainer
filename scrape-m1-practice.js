const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const OUTPUT_DIR = path.join(__dirname, "data");
const HOME_URL = "https://www.g1.ca/";
const TOTAL_TESTS = 5;

const SELECTORS = {
  motorcycleTab: "label#moto",
  firstTestLink: "#motoNextBtn a",
  startTestButton: "#atBtnStart",
  onboardingDismiss: 'button[data-target="#test-menu-dropdown"]',
  questionBlock: "#atQuestion",
  screenshotTarget: "#atQuestionWrp",
  questionImage: "#atMediaCoverWrp img",
  answerOptions: "#atAnswers .item",
  answerText: ".inner",
  correctAnswerText: "#atAnswers .item.correct .inner",
  explanation: ".atExplanation",
  nextButton: "#atNextBtn",
  nextTestButton: "#btnNextTest",
};

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function clean(text) {
  return (text || "").replace(/\s+/g, " ").trim();
}

function pad(n) {
  return String(n).padStart(3, "0");
}

async function textOrEmpty(locator, timeout = 2000) {
  try {
    return clean(await locator.innerText({ timeout }));
  } catch {
    return "";
  }
}

async function getQuestionText(page) {
  return page.locator(SELECTORS.questionBlock).evaluate((el) => {
    const clone = el.cloneNode(true);
    clone.querySelector("#atSection")?.remove();
    clone.querySelector("#atAnswers")?.remove();
    clone.querySelectorAll("svg").forEach((s) => s.remove());
    clone.querySelector(".btnWrp")?.remove();
    return clone.textContent.replace(/\s+/g, " ").trim();
  });
}

async function getAnswerOptions(page) {
  return page.locator(SELECTORS.answerOptions).evaluateAll((items) =>
    items
      .map((item) => ({
        index: item.getAttribute("data-i"),
        text: (item.querySelector(".inner")?.textContent || "").replace(/\s+/g, " ").trim(),
      }))
      .filter((o) => o.text)
  );
}

async function getQuestionImageUrl(page) {
  const urls = await page
    .locator(SELECTORS.questionImage)
    .evaluateAll((imgs) =>
      imgs.map((img) => img.currentSrc || img.src || img.getAttribute("src")).filter(Boolean)
    )
    .catch(() => []);

  return urls[0] ? new URL(urls[0], page.url()).href : null;
}

async function dismissPopupIfPresent(page) {
  const btn = page.locator(SELECTORS.onboardingDismiss);
  if (await btn.isVisible({ timeout: 500 }).catch(() => false)) {
    await btn.click();
    await page.waitForTimeout(500);
  }
}

async function waitForQuestion(page) {
  await page.locator(SELECTORS.questionBlock).waitFor({ state: "visible", timeout: 10000 });
  await page.locator(SELECTORS.answerOptions).first().waitFor({ state: "visible", timeout: 10000 });
}

async function scrapeTest(page, testName) {
  const testDir = path.join(OUTPUT_DIR, testName);
  const screenshotDir = path.join(testDir, "screenshots");
  ensureDir(testDir);
  ensureDir(screenshotDir);

  const results = [];
  let n = 1;

  while (true) {
    await dismissPopupIfPresent(page);
    await waitForQuestion(page);

    const questionId = `q${pad(n)}`;
    const question = await getQuestionText(page);
    const questionImageUrl = await getQuestionImageUrl(page);
    const answerOptions = await getAnswerOptions(page);

    if (!question || answerOptions.length === 0) {
      console.log(`[${testName}] ${questionId}: missing content, stopping.`);
      break;
    }

    // Screenshot before answering
    await page.locator(SELECTORS.screenshotTarget).screenshot({
      path: path.join(screenshotDir, `${questionId}-before.png`),
    });

    // Choose first answer option
    const firstOption = page.locator(SELECTORS.answerOptions).first();
    const chosenAnswer = await textOrEmpty(firstOption.locator(SELECTORS.answerText).first());
    await firstOption.click();
    await page.waitForTimeout(1000);

    // Screenshot after answering
    await page.locator(SELECTORS.screenshotTarget).screenshot({
      path: path.join(screenshotDir, `${questionId}-after.png`),
    });

    const correctAnswer = await textOrEmpty(page.locator(SELECTORS.correctAnswerText).first());
    const explanation = await textOrEmpty(page.locator(SELECTORS.explanation).first());

    results.push({
      testName,
      questionNumber: n,
      question,
      questionImageUrl,
      answerOptions,
      chosenAnswer,
      correctAnswer: correctAnswer || null,
      explanation: explanation || "",
    });

    console.log(`[${testName}] ${questionId}: ${question.slice(0, 80)}${question.length > 80 ? "..." : ""}`);

    // Click "Next question" or "View results" on the last question
    await page.locator(SELECTORS.nextButton).click();
    await page.waitForTimeout(1200);

    // If the question block is gone, we've landed on the results page
    const stillOnQuestion = await page
      .locator(SELECTORS.questionBlock)
      .isVisible({ timeout: 2000 })
      .catch(() => false);
    if (!stillOnQuestion) break;

    n++;
  }

  fs.writeFileSync(
    path.join(testDir, "questions.json"),
    JSON.stringify(results, null, 2),
    "utf8"
  );
  console.log(`[${testName}] Saved ${results.length} questions.\n`);

  return results;
}

async function getNextTestQuestionCount(page) {
  const text = await textOrEmpty(page.locator(SELECTORS.nextTestButton).first());
  const match = text.match(/(\d+)\s+new\s+question/i);
  return match ? Number(match[1]) : null;
}

async function main() {
  ensureDir(OUTPUT_DIR);

  const browser = await chromium.launch({ headless: false, slowMo: 75 });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();

  // Navigate to homepage and activate the Motorcycle Tests tab
  await page.goto(HOME_URL, { waitUntil: "domcontentloaded" });
  await page.locator(SELECTORS.motorcycleTab).click();
  await page.waitForTimeout(800);

  // Click the "Next: M1 Motorcycle License Practice Test 1" button
  await page.locator(SELECTORS.firstTestLink).click();
  await page.waitForTimeout(1000);

  const allResults = [];

  for (let testIndex = 1; testIndex <= TOTAL_TESTS; testIndex++) {
    const testName = `m1-practice-test-${testIndex}`;
    console.log(`\n--- Starting ${testName} ---`);

    // Start the test from the landing page
    await page.locator(SELECTORS.startTestButton).click();
    await page.waitForTimeout(1000);

    const testResults = await scrapeTest(page, testName);
    allResults.push(...testResults);

    if (testIndex < TOTAL_TESTS) {
      // Read the next test's question count from the results page button
      const nextCount = await getNextTestQuestionCount(page);
      console.log(`Next test has ${nextCount} questions. Navigating...`);

      await page.locator(SELECTORS.nextTestButton).click();
      await page.waitForTimeout(1000);
    }
  }

  fs.writeFileSync(
    path.join(OUTPUT_DIR, "all-questions.json"),
    JSON.stringify(allResults, null, 2),
    "utf8"
  );

  console.log(`\nDone. ${allResults.length} total questions saved to ${OUTPUT_DIR}`);
  await browser.close();
}

main().catch((err) => {
  console.error("\nScript failed:", err);
  process.exit(1);
});
