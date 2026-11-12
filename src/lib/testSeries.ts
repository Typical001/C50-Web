// Shared catalog classification; keep identical across the three applications.
export function isTestSeries(batch: { category?: string; tags?: unknown; custom_tag?: string; customTag?: string }) {
  return [batch.category, batch.custom_tag, batch.customTag, ...(Array.isArray(batch.tags) ? batch.tags : [])]
    .some(value => typeof value === 'string' && value.trim().toLowerCase().replace(/[-_]+/g, ' ') === 'test series');
}
export function seriesTags(tags: unknown) {
  const existing = Array.isArray(tags) ? tags.filter((x): x is string => typeof x === 'string') : [];
  return [...existing.filter(x => x.trim().toLowerCase().replace(/[-_]+/g, ' ') !== 'test series'), 'Test Series'];
}
