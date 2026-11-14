import { validateAppPromotion } from '../src/lib/appPromotion';

// Omitted fields stay omitted so partial/older clients cannot reset other sections.
export function homepagePatch(body: unknown): Record<string, unknown> {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('Invalid homepage settings.');
  const input = body as Record<string, unknown>;
  const patch: Record<string, unknown> = { id: 'mppsc_homepage' };
  for (const key of ['hero_title', 'hero_subtitle', 'faqs', 'testimonials', 'faculties', 'show_hero', 'show_faq', 'show_testimonials', 'show_faculty', 'app_promotion']) {
    if (!Object.hasOwn(input, key)) continue;
    const value = input[key];
    if (key === 'app_promotion') {
      const error = validateAppPromotion(value);
      if (error) throw new Error(error);
    } else if (key.startsWith('show_') ? typeof value !== 'boolean' : key.startsWith('hero_') ? typeof value !== 'string' : !Array.isArray(value)) {
      throw new Error(`Invalid ${key}.`);
    }
    patch[key] = value;
  }
  return patch;
}
