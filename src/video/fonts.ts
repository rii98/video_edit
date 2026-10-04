// Font registry. Themes name a family; it is loaded on first use through
// @remotion/google-fonts, which makes renders wait for the font (no fallback flashes).
import { loadFont as caveat } from '@remotion/google-fonts/Caveat';
import { loadFont as fredoka } from '@remotion/google-fonts/Fredoka';
import { loadFont as nunito } from '@remotion/google-fonts/Nunito';
import { loadFont as anton } from '@remotion/google-fonts/Anton';
import { loadFont as dmSans } from '@remotion/google-fonts/DMSans';
import { loadFont as fraunces } from '@remotion/google-fonts/Fraunces';
import { loadFont as instrumentSerif } from '@remotion/google-fonts/InstrumentSerif';
import { loadFont as inter } from '@remotion/google-fonts/Inter';
import { loadFont as jetBrainsMono } from '@remotion/google-fonts/JetBrainsMono';
import { loadFont as manrope } from '@remotion/google-fonts/Manrope';
import { loadFont as spaceGrotesk } from '@remotion/google-fonts/SpaceGrotesk';
import { loadFont as syne } from '@remotion/google-fonts/Syne';

type Loader = () => { fontFamily: string };
// Only the weights and subset we use: each extra weight is another network request at render.
const opts = (weights: string[]) => ({ weights, subsets: ['latin'] }) as never;
const REGULAR_TO_BOLD = ['400', '500', '600', '700'];

const loaders: Record<string, { load: Loader; fallback: string }> = {
  Inter: { load: () => inter('normal', opts(REGULAR_TO_BOLD)), fallback: 'Helvetica, Arial, sans-serif' },
  'Instrument Serif': { load: () => instrumentSerif('normal', opts(['400'])), fallback: 'Georgia, serif' },
  Anton: { load: () => anton('normal', opts(['400'])), fallback: 'Impact, sans-serif' },
  'DM Sans': { load: () => dmSans('normal', opts(REGULAR_TO_BOLD)), fallback: 'Helvetica, Arial, sans-serif' },
  Manrope: { load: () => manrope('normal', opts(REGULAR_TO_BOLD)), fallback: 'Helvetica, Arial, sans-serif' },
  'Space Grotesk': { load: () => spaceGrotesk('normal', opts(REGULAR_TO_BOLD)), fallback: 'Helvetica, Arial, sans-serif' },
  'JetBrains Mono': { load: () => jetBrainsMono('normal', opts(['400', '700'])), fallback: 'Menlo, monospace' },
  Fraunces: { load: () => fraunces('normal', opts(['400', '600'])), fallback: 'Georgia, serif' },
  Fredoka: { load: () => fredoka('normal', opts(['500', '600', '700'])), fallback: 'Helvetica, Arial, sans-serif' },
  Nunito: { load: () => nunito('normal', opts(['400', '700', '800'])), fallback: 'Helvetica, Arial, sans-serif' },
  Caveat: { load: () => caveat('normal', opts(['600', '700'])), fallback: 'cursive' },
  Syne: { load: () => syne('normal', opts(['600', '700'])), fallback: 'Helvetica, Arial, sans-serif' },
};

export const FONT_NAMES = Object.keys(loaders);

const loaded = new Map<string, string>();

/** CSS font-family stack for a registered font name; loads it once. Unknown names pass through. */
export function fontStack(name: string): string {
  const cached = loaded.get(name);
  if (cached) return cached;
  const entry = loaders[name];
  const stack = entry ? `"${entry.load().fontFamily}", ${entry.fallback}` : name;
  loaded.set(name, stack);
  return stack;
}
