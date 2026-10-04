// Keeps the library's parallel lists in sync: catalog ↔ exports ↔ demos ↔ thumbnails,
// theme files ↔ theme index ↔ schema ↔ registered fonts, components ↔ technique cards.
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { catalog } from '../library/catalog.ts';
import { DEMO_FRAMES } from '../library/demo-frames.ts';

const ROOT = join(import.meta.dirname, '..');
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');
const names = catalog.map((c) => c.name).sort();
const visual = catalog.filter((c) => !c.audio).map((c) => c.name).sort();

describe('component catalog', () => {
  it('lists exactly the components exported from library/index.ts', () => {
    const exported = [...read('library/index.ts').matchAll(/export \{([^}]+)\}/g)]
      .flatMap((m) => m[1]!.split(','))
      .map((s) => s.trim())
      .filter((s) => /^[A-Z]/.test(s) && !s.startsWith('type '));
    // (speechIntervals/duckGain are lower-case helpers, so they're not components.)
    assert.deepEqual([...new Set(exported)].sort(), names);
  });

  it('has a demo and a settled frame for every component', () => {
    const demoNames = [...read('library/demos.tsx').matchAll(/^ {2}(\w+): \{$/gm)].map((m) => m[1]!).sort();
    assert.deepEqual(demoNames, visual);
    assert.deepEqual(Object.keys(DEMO_FRAMES).sort(), visual);
  });

  it('only links to technique cards that exist', () => {
    const cards = new Set(readdirSync(join(ROOT, 'library/techniques')).map((f) => f.replace(/\.md$/, '')));
    for (const c of catalog) for (const t of c.techniques) assert.ok(cards.has(t), `${c.name} → missing technique card "${t}"`);
  });
});

describe('themes', () => {
  const files = readdirSync(join(ROOT, 'library/themes')).filter((f) => f.endsWith('.json'));
  const fonts = [...read('src/video/fonts.ts').matchAll(/^ {2}'?([A-Z][\w ]+?)'?: \{ load/gm)].map((m) => m[1]!);
  const schema = JSON.parse(read('library/themes/warm-editorial.json')) as Record<string, unknown>;
  const shape = (o: unknown): unknown =>
    o && typeof o === 'object' && !Array.isArray(o) ? Object.fromEntries(Object.entries(o).sort().map(([k, v]) => [k, shape(v)])) : typeof o;

  it('are all listed in library/themes/index.ts', () => {
    const index = read('library/themes/index.ts');
    for (const f of files) assert.ok(index.includes(`'./${f}'`), `${f} is not imported in themes/index.ts`);
  });

  for (const f of files) {
    it(`${f} matches the token schema and uses registered fonts`, () => {
      const t = JSON.parse(read(`library/themes/${f}`)) as { fonts: Record<string, string>; easing: Record<string, number[]> };
      assert.deepEqual(shape(t), shape(schema));
      for (const font of Object.values(t.fonts)) assert.ok(fonts.includes(font), `${f}: font "${font}" is not in src/video/fonts.ts`);
      for (const curve of Object.values(t.easing)) assert.equal(curve.length, 4);
    });
  }

  it('the project theme follows the same schema', () => {
    assert.deepEqual(shape(JSON.parse(read('project/theme/tokens.json'))), shape(schema));
  });
});

describe('technique cards', () => {
  for (const f of readdirSync(join(ROOT, 'library/techniques')).filter((f) => f.endsWith('.md') && f !== 'README.md')) {
    it(`${f} has a title, a summary, rules and sources`, () => {
      const md = read(`library/techniques/${f}`);
      assert.match(md, /^---\ntitle: .+\nsummary: .+/);
      assert.match(md, /## Rules/);
      assert.match(md, /## Sources\n[\s\S]*https?:\/\//);
    });
  }
});
