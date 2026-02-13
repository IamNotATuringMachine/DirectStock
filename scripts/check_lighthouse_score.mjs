import fs from "node:fs";

const reportPath = process.argv[2];
const thresholdArg = process.argv[3] ?? "0.90";

if (!reportPath) {
  console.error("Usage: node scripts/check_lighthouse_score.mjs <report.json> [threshold]");
  process.exit(2);
}

const threshold = Number(thresholdArg);
if (Number.isNaN(threshold)) {
  console.error(`Invalid threshold: ${thresholdArg}`);
  process.exit(2);
}

if (!fs.existsSync(reportPath)) {
  console.error(`Lighthouse report not found: ${reportPath}`);
  process.exit(2);
}

const report = JSON.parse(fs.readFileSync(reportPath, "utf8"));
const pwaScore = report?.categories?.pwa?.score;

if (typeof pwaScore !== "number") {
  console.error("PWA score missing in Lighthouse report.");
  process.exit(1);
}

console.log(`PWA score: ${pwaScore} (threshold: ${threshold})`);
if (pwaScore < threshold) {
  process.exit(1);
}
