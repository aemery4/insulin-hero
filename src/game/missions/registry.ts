/** Builds the model + renderer for a mission definition. */
import type { Renderer } from 'pixi.js';
import type { HeroSettings } from '../../domain/types';
import type { MissionRenderer } from '../engine/stage';
import type { MissionDef } from '../story/content';
import { DoorRushModel } from './doorRush/model';
import { DoorRushRenderer } from './doorRush/renderer';
import { KeyRunModel } from './keyRun/model';
import { KeyRunRenderer } from './keyRun/renderer';
import type { MissionModel } from './types';

export interface BuiltMission {
  model: MissionModel;
  makeRenderer: (r: Renderer) => MissionRenderer;
}

export function buildMission(def: MissionDef, hero: HeroSettings, seed = Date.now() & 0xffff): BuiltMission {
  switch (def.kind) {
    case 'keyRun': {
      const model = new KeyRunModel(def.config, seed);
      return { model, makeRenderer: (r) => new KeyRunRenderer(r, model, hero) };
    }
    case 'doorRush': {
      const model = new DoorRushModel(def.config, seed);
      return { model, makeRenderer: (r) => new DoorRushRenderer(r, model, hero) };
    }
    case 'soon':
      throw new Error(`Mission ${def.id} isn't built yet`);
  }
}
