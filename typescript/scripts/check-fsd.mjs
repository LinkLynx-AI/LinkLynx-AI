#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const PROJECT_ROOT = process.cwd();
const SRC_ROOT = path.join(PROJECT_ROOT, "src");

const TARGET_EXTENSIONS = new Set([".ts", ".tsx", ".mts", ".cts"]);
const IGNORE_DIRECTORY_NAMES = new Set(["node_modules", ".next", "dist", "coverage", "out"]);
const FSD_LAYER_ORDER = {
  shared: 1,
  entities: 2,
  features: 3,
  widgets: 4,
  pages: 5,
  app: 6,
};
const FSD_SLICE_LAYERS = new Set(["entities", "features", "widgets", "pages"]);
const IMPORT_SPECIFIER_PATTERNS = [
  /(?:import|export)\s+(?:[^"'`]*?\sfrom\s*)?["'`]([^"'`]+)["'`]/g,
  /import\s*\(\s*["'`]([^"'`]+)["'`]\s*\)/g,
];

/**
 * Collect TypeScript source files under src.
 *
 * @param {string} directory
 * @returns {Promise<string[]>}
 */
async function collectSourceFiles(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (IGNORE_DIRECTORY_NAMES.has(entry.name)) {
      continue;
    }

    const fullPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      const nestedFiles = await collectSourceFiles(fullPath);
      files.push(...nestedFiles);
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    const ext = path.extname(entry.name);
    if (!TARGET_EXTENSIONS.has(ext)) {
      continue;
    }

    if (entry.name.endsWith(".d.ts")) {
      continue;
    }

    if (entry.name.includes(".test.") || entry.name.includes(".spec.")) {
      continue;
    }

    files.push(fullPath);
  }

  return files;
}

/**
 * Resolve FSD layer/slice information from a source file path.
 *
 * @param {string} sourceFilePath
 * @returns {{layer: string, slice: string | null} | null}
 */
function getSourceLayerInfo(sourceFilePath) {
  const relativePath = path.relative(SRC_ROOT, sourceFilePath);
  const segments = relativePath.split(path.sep);
  const layer = segments[0];

  if (!layer || !(layer in FSD_LAYER_ORDER)) {
    return null;
  }

  const slice = segments[1] ?? null;
  return { layer, slice };
}

/**
 * Extract import/export specifiers and their approximate line numbers.
 *
 * @param {string} fileContent
 * @returns {Array<{specifier: string, line: number}>}
 */
function extractImportSpecifiers(fileContent) {
  const specifiers = [];

  for (const pattern of IMPORT_SPECIFIER_PATTERNS) {
    let match;
    while ((match = pattern.exec(fileContent)) !== null) {
      const [, specifier] = match;
      const line = fileContent.slice(0, match.index).split("\n").length;
      specifiers.push({ specifier, line });
    }
  }

  return specifiers;
}

/**
 * Return true when import path points to a slice public API.
 *
 * @param {string[]} targetSegments
 * @returns {boolean}
 */
function isPublicApiImport(targetSegments) {
  if (targetSegments.length === 1) {
    return true;
  }

  if (targetSegments.length === 2) {
    return true;
  }

  return targetSegments.length === 3 && targetSegments[2] === "index";
}

/**
 * Check one import against FSD constraints.
 *
 * @param {{layer: string, slice: string | null}} sourceInfo
 * @param {string} specifier
 * @returns {string | null}
 */
function validateImport(sourceInfo, specifier) {
  if (!specifier.startsWith("@/")) {
    return null;
  }

  const targetSegments = specifier.slice(2).split("/").filter(Boolean);
  if (targetSegments.length === 0) {
    return null;
  }

  const targetLayer = targetSegments[0];
  if (!(targetLayer in FSD_LAYER_ORDER)) {
    return null;
  }

  const sourceRank = FSD_LAYER_ORDER[sourceInfo.layer];
  const targetRank = FSD_LAYER_ORDER[targetLayer];

  if (sourceRank < targetRank) {
    return `Layer dependency violation: "${sourceInfo.layer}" cannot import upper layer "${targetLayer}".`;
  }

  if (sourceInfo.layer === targetLayer && FSD_SLICE_LAYERS.has(sourceInfo.layer)) {
    const targetSlice = targetSegments[1] ?? null;
    const sourceSlice = sourceInfo.slice;

    if (
      sourceSlice &&
      targetSlice &&
      sourceSlice !== targetSlice &&
      !isPublicApiImport(targetSegments)
    ) {
      return `Cross-slice import must use Public API: "${specifier}".`;
    }
  }

  if (sourceInfo.layer !== targetLayer && FSD_SLICE_LAYERS.has(targetLayer)) {
    if (!isPublicApiImport(targetSegments)) {
      return `Cross-layer import into "${targetLayer}" must use slice Public API: "${specifier}".`;
    }
  }

  return null;
}

/**
 * Run FSD validation and exit with non-zero on violation.
 */
async function main() {
  let stat;
  try {
    stat = await fs.stat(SRC_ROOT);
  } catch {
    console.error(`[fsd-check] src directory not found: ${SRC_ROOT}`);
    process.exit(1);
  }

  if (!stat.isDirectory()) {
    console.error(`[fsd-check] src is not a directory: ${SRC_ROOT}`);
    process.exit(1);
  }

  const files = await collectSourceFiles(SRC_ROOT);
  const violations = [];

  for (const filePath of files) {
    const sourceInfo = getSourceLayerInfo(filePath);
    if (!sourceInfo) {
      continue;
    }

    const content = await fs.readFile(filePath, "utf8");
    const imports = extractImportSpecifiers(content);

    for (const { specifier, line } of imports) {
      const error = validateImport(sourceInfo, specifier);
      if (!error) {
        continue;
      }

      const relPath = path.relative(PROJECT_ROOT, filePath);
      violations.push({ file: relPath, line, specifier, error });
    }
  }

  if (violations.length === 0) {
    console.log(`[fsd-check] OK (${files.length} files scanned)`);
    return;
  }

  console.error(`[fsd-check] Found ${violations.length} violation(s):`);
  for (const violation of violations) {
    console.error(`- ${violation.file}:${violation.line}`);
    console.error(`  import: ${violation.specifier}`);
    console.error(`  reason: ${violation.error}`);
  }

  process.exit(1);
}

await main();
