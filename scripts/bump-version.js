#!/usr/bin/env node
/**
 * Bump version across all files in the project.
 * Usage: node scripts/bump-version.js <new-version>
 * Example: node scripts/bump-version.js 2.3.1
 *
 * Files updated:
 *   package.json              — "version" field
 *   src-tauri/tauri.conf.json — "version" field
 *   src-tauri/Cargo.toml     — package.version
 *   src/config/version.ts    — APP_VERSION constant
 *   README.md                — shields.io badge
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");

const FILES = [
  {
    path: "package.json",
    pattern: /"version":\s*"\d+\.\d+\.\d+"/,
    replacement: (v) => `"version": "${v}"`,
  },
  {
    path: "src-tauri/tauri.conf.json",
    pattern: /"version":\s*"\d+\.\d+\.\d+"/,
    replacement: (v) => `"version": "${v}"`,
  },
  {
    path: "src-tauri/Cargo.toml",
    pattern: /^version\s*=\s*"\d+\.\d+\.\d+"/m,
    replacement: (v) => `version = "${v}"`,
  },
  {
    path: "src/config/version.ts",
    pattern: /export const APP_VERSION = "v?\d+\.\d+\.\d+"/,
    replacement: (v) => `export const APP_VERSION = "v${v}"`,
  },
  {
    path: "README.md",
    pattern: /version-\d+\.\d+\.\d+-blue/,
    replacement: (v) => `version-${v}-blue`,
  },
];

function bumpVersion(newVersion) {
  if (!newVersion || !/^\d+\.\d+\.\d+$/.test(newVersion)) {
    console.error("Usage: node scripts/bump-version.js <version>");
    console.error('  version format: X.Y.Z (e.g. 2.3.1)');
    process.exit(1);
  }

  let updated = 0;
  let skipped = 0;

  for (const file of FILES) {
    const filePath = path.join(ROOT, file.path);
    if (!fs.existsSync(filePath)) {
      console.log(`  SKIP ${file.path} (not found)`);
      skipped++;
      continue;
    }
    const content = fs.readFileSync(filePath, "utf-8");
    const newContent = content.replace(file.pattern, () => file.replacement(newVersion));
    if (newContent !== content) {
      fs.writeFileSync(filePath, newContent);
      console.log(`  DONE ${file.path}`);
      updated++;
    } else {
      console.log(`  SAME ${file.path} (already at ${newVersion}?)`);
      skipped++;
    }
  }

  console.log(`\nUpdated ${updated} file(s), ${skipped} unchanged.`);
}

bumpVersion(process.argv[2]);
