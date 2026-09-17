// Production build into .next-build so it can run while `next dev` uses .next.
import { spawnSync } from "node:child_process";

const result = spawnSync("npx", ["next", "build"], {
  stdio: "inherit",
  shell: true,
  env: { ...process.env, NEXT_DIST_DIR: ".next-build" },
});
process.exit(result.status ?? 1);
