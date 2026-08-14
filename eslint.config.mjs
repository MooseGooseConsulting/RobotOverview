import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "dist/**",
    "next-env.d.ts",
    // Independently tested ROS/Python/C++ workspace with vendored browser assets.
    "robot/beast/ros2_ws/**",
    // Agent worktrees: a full second copy of src that would be linted as if it
    // were this branch's code. CI never sees these (clean checkout), so the
    // noise is local-only — and misleading, since the findings aren't yours.
    ".claude/**",
  ]),
]);

export default eslintConfig;
