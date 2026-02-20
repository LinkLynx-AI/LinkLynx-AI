import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import {
  generateRootCSSVariables,
  generateThemeCSSVariables,
  themeTokens,
} from "./tokens";

const currentDir = dirname(fileURLToPath(import.meta.url));
const globalsCssPath = resolve(currentDir, "../../styles/globals.css");
const globalsCssText = readFileSync(globalsCssPath, "utf-8");

describe("theme token css variables", () => {
  test("トークンからテーマ変数を生成できる", () => {
    const darkVariables = generateThemeCSSVariables(themeTokens.dark);

    expect(darkVariables["--color-bg-canvas"]).toBe("#1e1f22");
    expect(darkVariables["--color-text-on-accent"]).toBe("#ffffff");
  });

  test("globals.css が root/theme 変数と同期している", () => {
    const rootVariables = generateRootCSSVariables(themeTokens.dark);

    Object.entries(rootVariables).forEach(([name, value]) => {
      expect(globalsCssText).toContain(`${name}: ${value};`);
    });

    (["light", "dark"] as const).forEach((themeName) => {
      expect(globalsCssText).toContain(`[data-theme="${themeName}"]`);
      const variables = generateThemeCSSVariables(themeTokens[themeName]);
      Object.entries(variables).forEach(([name, value]) => {
        expect(globalsCssText).toContain(`${name}: ${value};`);
      });
    });
  });
});
