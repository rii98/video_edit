import type { ComponentType } from 'react';
import { T_A } from './T_A';
import { T_B } from './T_B';

export const treatmentComponents: Record<string, ComponentType> = { A: T_A, B: T_B };
