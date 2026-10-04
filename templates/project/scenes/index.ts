// Scene registry: every id in timeline.json must map to a component here.
import type { ComponentType } from 'react';
import { S01_Start } from './S01_Start';

export const scenes: Record<string, ComponentType> = {
  S01: S01_Start,
};
