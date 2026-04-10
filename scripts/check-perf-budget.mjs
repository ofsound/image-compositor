import fs from "node:fs";
import path from "node:path";

const DIST_DIR = path.resolve(process.cwd(), "dist/client/assets");

if (!fs.existsSync(DIST_DIR)) {
  console.error("[perf-budget] Missing dist/client/assets. Run `npm run build` first.");
  process.exit(1);
}

const budgets = [
  {
    label: "main bundle",
    pattern: /^index-.*\.js$/,
    maxBytes: 850_000,
  },
  {
    label: "heic chunk",
    pattern: /^heic2any-.*\.js$/,
    maxBytes: 1_450_000,
  },
  {
    label: "worker chunk",
    pattern: /^image-worker-.*\.js$/,
    maxBytes: 120_000,
  },
  {
    label: "main css",
    pattern: /^index-.*\.css$/,
    maxBytes: 55_000,
  },
];

const files = fs.readdirSync(DIST_DIR);
const failures = [];

for (const budget of budgets) {
  const fileName = files.find((file) => budget.pattern.test(file));
  if (!fileName) {
    failures.push(`${budget.label}: file not found (${budget.pattern})`);
    continue;
  }

  const filePath = path.join(DIST_DIR, fileName);
  const size = fs.statSync(filePath).size;
  if (size > budget.maxBytes) {
    failures.push(
      `${budget.label}: ${fileName} is ${size.toLocaleString()} bytes (budget ${budget.maxBytes.toLocaleString()})`,
    );
  } else {
    console.log(
      `[perf-budget] OK ${budget.label}: ${fileName} (${size.toLocaleString()} bytes / ${budget.maxBytes.toLocaleString()} budget)`,
    );
  }
}

const jsFiles = files.filter((file) => file.endsWith(".js"));
const totalJsBytes = jsFiles
  .map((file) => fs.statSync(path.join(DIST_DIR, file)).size)
  .reduce((sum, bytes) => sum + bytes, 0);
const totalJsBudget = 2_400_000;
if (totalJsBytes > totalJsBudget) {
  failures.push(
    `total JS: ${totalJsBytes.toLocaleString()} bytes exceeds ${totalJsBudget.toLocaleString()} bytes`,
  );
} else {
  console.log(
    `[perf-budget] OK total JS: ${totalJsBytes.toLocaleString()} bytes / ${totalJsBudget.toLocaleString()} budget`,
  );
}

if (failures.length > 0) {
  console.error("[perf-budget] Budget check failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}
