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
import { loadFont as unbounded } from '@remotion/google-fonts/Unbounded';
import { loadFont as bricolage } from '@remotion/google-fonts/BricolageGrotesque';
import { loadFont as archivoBlack } from '@remotion/google-fonts/ArchivoBlack';
import { loadFont as archivo } from '@remotion/google-fonts/Archivo';
import { loadFont as permanentMarker } from '@remotion/google-fonts/PermanentMarker';
import { loadFont as interTight } from '@remotion/google-fonts/InterTight';
import { loadFont as luckiestGuy } from '@remotion/google-fonts/LuckiestGuy';
import { loadVariableFont as monaSans } from '@remotion/google-fonts/MonaSans';
import { loadVariableFont as anybody } from '@remotion/google-fonts/Anybody';
import { loadVariableFont as geist } from '@remotion/google-fonts/Geist';
import { loadFont as teko } from '@remotion/google-fonts/Teko';
import { loadFont as poppins } from '@remotion/google-fonts/Poppins';
import { loadFont as bigShoulders } from '@remotion/google-fonts/BigShoulders';
import { loadFont as plexMono } from '@remotion/google-fonts/IBMPlexMono';
import { loadFont as courierPrime } from '@remotion/google-fonts/CourierPrime';
import { loadFont as mukta } from '@remotion/google-fonts/Mukta';
import { loadVariableFont as anekDevanagari } from '@remotion/google-fonts/AnekDevanagari';
import { loadFont as rozhaOne } from '@remotion/google-fonts/RozhaOne';

type Loader = () => { fontFamily: string };
// Only the weights and subset we use: each extra weight is another network request at render.
const opts = (weights: string[]) => ({ weights, subsets: ['latin'] }) as never;
const REGULAR_TO_BOLD = ['400', '500', '600', '700'];

const loaders: Record<string, { load: Loader; fallback: string }> = {
  Inter: { load: () => inter('normal', opts(REGULAR_TO_BOLD)), fallback: 'Helvetica, Arial, sans-serif' },
  'Instrument Serif': { load: () => (instrumentSerif('italic', opts(['400'])), instrumentSerif('normal', opts(['400']))), fallback: 'Georgia, serif' },
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
  Unbounded: { load: () => unbounded('normal', opts(['300', '500', '700'])), fallback: 'Helvetica, Arial, sans-serif' },
  'Bricolage Grotesque': { load: () => bricolage('normal', opts(['400', '800'])), fallback: 'Helvetica, Arial, sans-serif' },
  'Archivo Black': { load: () => archivoBlack('normal', opts(['400'])), fallback: 'Arial Black, sans-serif' },
  Archivo: { load: () => archivo('normal', opts(['400', '700'])), fallback: 'Helvetica, Arial, sans-serif' },
  'Permanent Marker': { load: () => permanentMarker('normal', opts(['400'])), fallback: 'cursive' },
  'Inter Tight': { load: () => interTight('normal', opts(['400', '600', '800'])), fallback: 'Helvetica, Arial, sans-serif' },
  'Luckiest Guy': { load: () => luckiestGuy('normal', opts(['400'])), fallback: 'Impact, sans-serif' },
  // Variable fonts (full wght, and wdth where the family has it): animate font-stretch/weight.
  'Mona Sans': { load: () => monaSans('normal', { subsets: ['latin'] } as never), fallback: 'Helvetica, Arial, sans-serif' },
  Anybody: { load: () => anybody('normal', { subsets: ['latin'] } as never), fallback: 'Impact, sans-serif' },
  Geist: { load: () => geist('normal', { subsets: ['latin'] } as never), fallback: 'Helvetica, Arial, sans-serif' },
  // Geometric, close to the ileyy wordmark (thin round e, straight y).
  Poppins: { load: () => poppins('normal', { weights: ['300', '400', '500'], subsets: ['latin', 'latin-ext'] } as never), fallback: 'Helvetica, Arial, sans-serif' },
  // money: case-file stamps (Big Shoulders), thermal receipt (IBM Plex Mono), typed dossier (Courier Prime).
  'Big Shoulders': { load: () => bigShoulders('normal', opts(['700', '900'])), fallback: 'Impact, sans-serif' },
  'IBM Plex Mono': { load: () => plexMono('normal', opts(['400', '600', '700'])), fallback: 'Menlo, monospace' },
  'Courier Prime': { load: () => courierPrime('normal', opts(['400', '700'])), fallback: 'Courier, monospace' },
  // Condensed with Devanagari: Nepali words set in their own script.
  Teko: { load: () => teko('normal', { weights: ['500', '700'], subsets: ['latin', 'devanagari'] } as never), fallback: 'Impact, sans-serif' },
  // group-of: काग (kaag, crow) in its own script, one face per treatment.
  Mukta: { load: () => mukta('normal', { weights: ['500', '800'], subsets: ['latin', 'devanagari'] } as never), fallback: 'Helvetica, Arial, sans-serif' },
  'Anek Devanagari': { load: () => anekDevanagari('normal', { subsets: ['latin', 'devanagari'] } as never), fallback: 'Impact, sans-serif' },
  'Rozha One': { load: () => rozhaOne('normal', { weights: ['400'], subsets: ['latin', 'devanagari'] } as never), fallback: 'Georgia, serif' },
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
