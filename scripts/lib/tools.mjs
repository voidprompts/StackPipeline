/**
 * Shared tool-directory lookup for the review-production CLIs.
 * Reads the same src/content/tools/tools.json the Astro content layer uses, so "does this
 * tool exist" checks here can never drift from what actually builds.
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const TOOLS_PATH = path.join(ROOT, 'src/content/tools/tools.json');
export const REVIEWS_DIR = path.join(ROOT, 'src/content/reviews');
export const PUBLIC_EVIDENCE_DIR = path.join(ROOT, 'public-evidence');

let cachedTools = null;

export async function loadTools() {
  if (cachedTools) return cachedTools;
  const raw = await readFile(TOOLS_PATH, 'utf8');
  cachedTools = JSON.parse(raw);
  return cachedTools;
}

export async function findTool(toolId) {
  const tools = await loadTools();
  return tools.find((tool) => tool.id === toolId) ?? null;
}

export async function toolExists(toolId) {
  return (await findTool(toolId)) !== null;
}
