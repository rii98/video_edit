// All theme presets, importable by both the editor (gallery) and Remotion (stills).
// A unit test checks that every *.json in this folder is listed here.
import type { ThemeTokens } from '../../src/shared/types.ts';
import marketDesk from './market-desk.json';
import keynoteMono from './keynote-mono.json';
import midnightGradient from './midnight-gradient.json';
import neonSport from './neon-sport.json';
import playfulPop from './playful-pop.json';
import warmEditorial from './warm-editorial.json';
import sunnyScrapbook from './sunny-scrapbook.json';
import pastelStorybook from './pastel-storybook.json';
import caseFileNoir from './case-file-noir.json';
import cinemaInk from './cinema-ink.json';

export const themes: Record<string, ThemeTokens> = {
  'warm-editorial': warmEditorial,
  'keynote-mono': keynoteMono,
  'neon-sport': neonSport,
  'playful-pop': playfulPop,
  'midnight-gradient': midnightGradient,
  'market-desk': marketDesk,
  'sunny-scrapbook': sunnyScrapbook,
  'pastel-storybook': pastelStorybook,
  'case-file-noir': caseFileNoir,
  'cinema-ink': cinemaInk,
};
