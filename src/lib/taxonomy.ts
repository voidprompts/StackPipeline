import { getCollection } from 'astro:content';

/**
 * Tag index shared by the tag archive route and the article layout.
 *
 * Why this exists: a tag archive holding a single article is thin content. Two bad
 * options are commonly shipped — index them anyway (dilutes site quality) or `noindex`
 * them while still listing them in the sitemap (a contradictory signal Google flags).
 *
 * Instead we only *generate* archives for tags that clear a minimum entry count, and the
 * article layout only links tags that have a real destination. No thin pages, no broken
 * links, no sitemap conflict.
 */

/** Minimum entries required for a tag to get its own indexable archive page. */
export const MIN_TAG_ENTRIES = 2;

export type TaggedItem = {
  id: string;
  base: string;
  type: string;
  /**
   * Author reference id, lifted out of `data` at construction time. `data` is a loose
   * Record because it spans four collections with different shapes, so reading
   * `data.author` back out would lose the type. This keeps author lookups typed.
   */
  authorId: string;
  data: Record<string, any>;
  body?: string;
};

export type TagRecord = {
  slug: string;
  label: string;
  items: TaggedItem[];
};

export function tagSlug(tag: string): string {
  return tag
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/** Build the full tag -> entries map across every editorial collection. */
export async function getTagIndex(): Promise<Map<string, TagRecord>> {
  const [integrations, reviews, alternatives, guides] = await Promise.all([
    getCollection('integrations', ({ data }) => !data.draft),
    getCollection('reviews', ({ data }) => !data.draft),
    getCollection('alternatives', ({ data }) => !data.draft),
    getCollection('guides', ({ data }) => !data.draft),
  ]);

  const all: TaggedItem[] = [
    ...integrations.map((entry) => ({
      id: entry.id,
      base: '/integrations',
      type: 'Integration',
      authorId: entry.data.author.id,
      data: entry.data as Record<string, any>,
      body: entry.body,
    })),
    ...reviews.map((entry) => ({
      id: entry.id,
      base: '/reviews',
      type: 'Review',
      authorId: entry.data.author.id,
      data: entry.data as Record<string, any>,
      body: entry.body,
    })),
    ...alternatives.map((entry) => ({
      id: entry.id,
      base: '/alternatives',
      type: 'Comparison',
      authorId: entry.data.author.id,
      data: entry.data as Record<string, any>,
      body: entry.body,
    })),
    ...guides.map((entry) => ({
      id: entry.id,
      base: '/guides',
      type: 'Guide',
      authorId: entry.data.author.id,
      data: entry.data as Record<string, any>,
      body: entry.body,
    })),
  ];

  const index = new Map<string, TagRecord>();

  for (const item of all) {
    const tags: string[] = item.data.tags ?? [];
    for (const tag of tags) {
      const slug = tagSlug(tag);
      if (!slug) continue;
      const record = index.get(slug) ?? { slug, label: tag, items: [] };
      record.items.push(item);
      index.set(slug, record);
    }
  }

  return index;
}

/** Tags that clear the threshold and therefore have a real archive page. */
export async function getIndexableTags(): Promise<TagRecord[]> {
  const index = await getTagIndex();
  return [...index.values()]
    .filter((record) => record.items.length >= MIN_TAG_ENTRIES)
    .sort((a, b) => b.items.length - a.items.length);
}

/** Set of tag slugs that have an archive page — used to decide whether to link a chip. */
export async function getLinkableTagSlugs(): Promise<Set<string>> {
  const indexable = await getIndexableTags();
  return new Set(indexable.map((record) => record.slug));
}
