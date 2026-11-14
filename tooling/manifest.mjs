import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { orderSelection, parseSelection } from "./catalog.ts";

export const manifestName = "lint-ddd.config.json";
export const eslintConfigSource = `import { defineConfig } from "lint-ddd";

export default defineConfig();
`;

export const isOurEslintConfig = (source) => source.trim() === eslintConfigSource.trim();

export const usesOurConfig = (source) => source.includes('from "lint-ddd"') && source.includes("defineConfig(");

export const workflowSource = `name: lint
on:
  push:
  pull_request:
jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22.18
          cache: npm
      - run: npm ci
      - run: npx eslint .
`;

export const isOurWorkflow = (source) => source.trim() === workflowSource.trim();

export const workflowPath = (rootPath) => join(rootPath, ".github", "workflows", "lint.yml");

export const installWorkflow = (rootPath) => {
	const filePath = workflowPath(rootPath);
	if (existsSync(filePath) && !isOurWorkflow(readFileSync(filePath, "utf8"))) {
		throw new Error(".github/workflows/lint.yml already exists.");
	}
	mkdirSync(join(rootPath, ".github", "workflows"), { recursive: true });
	writeFileSync(filePath, workflowSource);
};

const readJson = (filePath) => {
	try {
		return JSON.parse(readFileSync(filePath, "utf8"));
	} catch (error) {
		const message = error instanceof Error ? error.message : "Unknown failure.";
		throw new Error(`Could not read ${filePath}. ${message.endsWith(".") ? message : `${message}.`}`);
	}
};

export const readSelection = (rootPath) => {
	const filePath = join(rootPath, manifestName);
	if (!existsSync(filePath)) {
		throw new Error("lint-ddd.config.json is missing. Run lint-ddd init first.");
	}

	return parseSelection(readJson(filePath));
};

export const writeSelection = (rootPath, selection) => {
	writeFileSync(join(rootPath, manifestName), `${JSON.stringify(orderSelection(selection), null, 2)}\n`);
};
