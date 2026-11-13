// Checks a Loom checkout against the Engine tab before it lands: builds every
// demo from it into a scratch folder and proves it as tools/loom-demos.mjs does.
// Loom's slots.ps1 merge runs it with the commit the branch started from, and
// it passes at once when the branch changes none of what the demos are built from.
//
// Run: node tools/check-loom.mjs <loom> [base commit]

import { execFileSync } from "node:child_process";
import { isLoomInput, provenLoomDemos } from "./loom-demos.mjs";

const [loom, base] = process.argv.slice(2);

const touchesDemos = () =>
  execFileSync("git", ["-C", loom, "diff", "--name-only", base, "HEAD"], { encoding: "utf8" })
    .split("\n")
    .some(isLoomInput);

if (!base || touchesDemos()) {
  try {
    await provenLoomDemos(loom, () => {});
  } catch (err) {
    console.error(`The Engine tab's demos fail against ${loom}: ${err.stderr || err.message}`);
    process.exitCode = 1;
  }
}
