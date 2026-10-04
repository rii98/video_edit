// Theme presets live in library/themes; applying one copies it into the project's
// tokens.json and commits, so a theme change is a version like any other edit.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ThemeTokens } from '../src/shared/types.ts';
import { commitAll } from './git.ts';
import { PROJECT_DIR, ROOT, writeJsonAtomic } from './store.ts';

export const THEMES_DIR = join(ROOT, 'library/themes');
const PROJECT_TOKENS = join(PROJECT_DIR, 'theme/tokens.json');

export interface ThemePreset {
  slug: string;
  tokens: ThemeTokens;
}

export function listThemes(): ThemePreset[] {
  return readdirSync(THEMES_DIR)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((f) => ({ slug: f.replace(/\.json$/, ''), tokens: JSON.parse(readFileSync(join(THEMES_DIR, f), 'utf8')) as ThemeTokens }));
}

export function currentThemeName(): string {
  return (JSON.parse(readFileSync(PROJECT_TOKENS, 'utf8')) as ThemeTokens).name;
}

/** Returns the new version's short sha, or null if the project already used this theme. */
export function applyTheme(slug: string): string | null {
  const preset = listThemes().find((t) => t.slug === slug);
  if (!preset) throw new Error(`Unknown theme "${slug}". Available: ${listThemes().map((t) => t.slug).join(', ')}`);
  writeJsonAtomic(PROJECT_TOKENS, preset.tokens);
  return commitAll(`Theme: ${preset.tokens.name}`);
}
