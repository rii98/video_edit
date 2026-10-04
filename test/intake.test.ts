import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { validateIntake } from '../server/intake.ts';
import type { Intake, Treatment } from '../src/shared/types.ts';

const treatment = (over: Partial<Treatment> = {}): Treatment => ({
  id: 'A',
  title: 'Rep by rep',
  pitch: 'A HUD that counts every rep.',
  theme: 'neon-sport',
  techniques: ['fitness-hud-overlays', 'cutting-to-music'],
  outline: [{ scene: 'Hook', seconds: 3, beat: 'First rep lands on the drop' }],
  music: 'Original track',
  durationInFrames: 180,
  ...over,
});
const intake = (treatments: Treatment[], over: Partial<Intake> = {}): Intake => ({
  brief: null,
  format: { width: 1080, height: 1920, fps: 30 },
  treatments,
  chosen: null,
  ...over,
});
const REGISTRY = 'export const treatmentComponents = { A: T_A, B: T_B };';

describe('validateIntake', () => {
  it('accepts a well-formed intake', () => {
    assert.deepEqual(validateIntake(intake([treatment(), treatment({ id: 'B', theme: 'keynote-mono' })]), REGISTRY), []);
  });

  it('names every problem precisely', () => {
    const errors = validateIntake(
      intake([treatment({ theme: 'neon', techniques: ['made-up'], durationInFrames: 5 }), treatment({ id: 'C', title: ' ' })], { chosen: 'Z' }),
      REGISTRY,
    );
    const expect = (fragment: string) => assert.ok(errors.some((e) => e.includes(fragment)), `missing error about "${fragment}" in:\n${errors.join('\n')}`);
    expect('treatment A: theme "neon" is not one of');
    expect('technique "made-up" has no card');
    expect('treatment A: durationInFrames');
    expect('treatment C: missing title');
    expect('no component registered as "C"');
    expect('chosen "Z" is not a treatment id');
  });

  it('rejects duplicate and malformed ids', () => {
    const errors = validateIntake(intake([treatment(), treatment(), treatment({ id: 'ab' })]), REGISTRY);
    assert.ok(errors.some((e) => e.includes('duplicate id')));
    assert.ok(errors.some((e) => e.includes('single capital letter')));
  });
});
