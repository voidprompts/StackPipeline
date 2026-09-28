/**
 * Minimal YAML-frontmatter <-> MDX helpers shared by the review-production CLIs.
 *
 * Uses the `yaml` package (already a transitive dependency of Astro's content layer, see
 * package-lock.json) so frontmatter emitted here parses identically to what Astro's content
 * loader will read at build time — no hand-rolled YAML string-building that could silently
 * diverge from real YAML semantics.
 */
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;

/**
 * Split an MDX file into { frontmatter (object), body (string, including any leading
 * import lines) }. Returns null if the file has no frontmatter block.
 */
export function readMdx(source) {
  const match = FRONTMATTER_RE.exec(source);
  if (!match) return null;
  const [, yamlBlock, body] = match;
  const frontmatter = parseYaml(yamlBlock) ?? {};
  return { frontmatter, body };
}

/**
 * Serialize { frontmatter, body } back into an MDX file. `stringifyYaml` sorts keys
 * insertion-order (not alphabetically) by default, so callers should build the frontmatter
 * object in the order they want it to render.
 */
export function writeMdx({ frontmatter, body }) {
  const yamlBlock = stringifyYaml(frontmatter, {
    lineWidth: 0, // never hard-wrap long descriptions/URLs mid-string
  }).trimEnd();
  return `---\n${yamlBlock}\n---\n${body.startsWith('\n') ? body : `\n${body}`}`;
}
