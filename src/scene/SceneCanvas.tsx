import type { HeroSettings, SceneState } from '../domain/types';

interface Props {
  state: SceneState;
  hero: HeroSettings;
  /** Changes whenever one-shot event animations should (re)play. */
  playKey: string;
  reducedMotion: boolean;
}

// Placeholder until the Pixi scene lands (M4).
export function SceneCanvas({ state }: Props) {
  return (
    <div className="scene-stage" data-zone={state.zone} aria-hidden="true">
      <div className="scene-placeholder">Scene: {state.zone}</div>
    </div>
  );
}
