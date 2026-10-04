// Intake state (project/intake/intake.json): the creative brief and the treatments Claude
// proposes. Validation is strict and specific because Claude writes these files by hand.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { EditRequest, Intake } from '../src/shared/types.ts';
import { createRequest, PROJECT_DIR, ROOT, writeJsonAtomic } from './store.ts';

const INTAKE_DIR = join(PROJECT_DIR, 'intake');
const INTAKE_FILE = join(INTAKE_DIR, 'intake.json');

export function readIntake(): Intake {
  return JSON.parse(readFileSync(INTAKE_FILE, 'utf8')) as Intake;
}

const slugs = (dir: string, ext: string) =>
  readdirSync(join(ROOT, dir))
    .filter((f) => f.endsWith(ext) && f !== 'README.md')
    .map((f) => f.slice(0, -ext.length));

/** Every problem with the intake, phrased so it can be fixed directly. Empty = valid. */
export function validateIntake(intake: Intake, registry = readFileSync(join(INTAKE_DIR, 'index.ts'), 'utf8')): string[] {
  const errors: string[] = [];
  const themes = slugs('library/themes', '.json');
  const techniques = slugs('library/techniques', '.md');
  const { width, height, fps } = intake.format ?? {};
  if (![width, height, fps].every((n) => Number.isInteger(n) && n! > 0)) errors.push('format needs integer width, height and fps');

  const ids = new Set<string>();
  for (const t of intake.treatments ?? []) {
    const at = `treatment ${t.id ?? '?'}`;
    if (!/^[A-Z]$/.test(t.id ?? '')) errors.push(`${at}: id must be a single capital letter`);
    if (ids.has(t.id)) errors.push(`${at}: duplicate id`);
    ids.add(t.id);
    if (!t.title?.trim()) errors.push(`${at}: missing title`);
    if (!t.pitch?.trim()) errors.push(`${at}: missing pitch`);
    if (!themes.includes(t.theme)) errors.push(`${at}: theme "${t.theme}" is not one of ${themes.join(', ')}`);
    for (const tech of t.techniques ?? []) if (!techniques.includes(tech)) errors.push(`${at}: technique "${tech}" has no card in library/techniques`);
    if (!t.outline?.length) errors.push(`${at}: outline is empty`);
    if (!Number.isInteger(t.durationInFrames) || t.durationInFrames < fps! || t.durationInFrames > fps! * 20) {
      errors.push(`${at}: durationInFrames should be 1–20 s of frames`);
    }
    if (!new RegExp(`\\b${t.id}\\s*:`).test(registry)) errors.push(`${at}: no component registered as "${t.id}" in project/intake/index.ts`);
  }
  if (intake.chosen && !ids.has(intake.chosen)) errors.push(`chosen "${intake.chosen}" is not a treatment id`);
  return errors;
}

/**
 * The user picked a direction in the editor: record it and queue the build for Claude
 * through the normal request flow (so it shows up in the editor and `ev wait`).
 */
export function chooseTreatment(id: string, notes: string): EditRequest {
  const intake = readIntake();
  const treatment = intake.treatments.find((t) => t.id === id);
  if (!treatment) throw new Error(`No treatment "${id}"`);
  writeJsonAtomic(INTAKE_FILE, { ...intake, chosen: id });
  const extra = notes.trim() ? ` Notes from the user: ${notes.trim()}` : '';
  return createRequest({
    prompt: `Build version 1 of the video from treatment ${id} ("${treatment.title}"), following project/intake/intake.json (brief, outline, theme ${treatment.theme}, techniques).${extra}`,
    scope: 'video',
    frame: 0,
    sceneId: null,
    pin: null,
    region: null,
    layers: [],
  });
}

export const intakeExists = () => existsSync(INTAKE_FILE);
