import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      ".next-build/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
    ],
  },
  {
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            { name: "lucide-react", message: "Use @phosphor-icons/react." },
            { name: "next-themes", message: "Theme state lives in @/stores/theme-store." },
          ],
        },
      ],
    },
  },
  {
    // Phase 2 swaps src/lib/mock for Catalyst; only the API layer and data scripts may touch it.
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/lib/api/**", "src/lib/mock/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            { name: "lucide-react", message: "Use @phosphor-icons/react." },
            { name: "next-themes", message: "Theme state lives in @/stores/theme-store." },
          ],
          patterns: [
            {
              group: ["@/lib/mock", "@/lib/mock/*", "**/lib/mock/*"],
              message: "Import data access from @/lib/api, never from the mock.",
            },
          ],
        },
      ],
    },
  },
];

export default eslintConfig;
