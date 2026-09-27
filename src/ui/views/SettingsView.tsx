import { useState, type FormEvent } from 'react';
import type { Settings } from '../../domain/types';
import { validateRange } from '../../domain/validation';
import type { Storage } from '../../storage';
import { BackupPanel } from '../components/BackupPanel';
import { HeroPreview } from '../components/HeroPreview';

interface Props {
  settings: Settings;
  storage: Storage | null;
  onSave: (settings: Settings) => Promise<void>;
  onDataChanged: () => Promise<void>;
}

const SWATCHES = ['#3aa0ff', '#8a5cff', '#2ec27e', '#ff6b3d', '#ff4fa3', '#ffc83d', '#16c7d9', '#f2f2f2'];

function ColorChoice({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const id = label.toLowerCase().replace(/\s+/g, '-');
  return (
    <fieldset className="field-group color-choice">
      <legend>{label}</legend>
      <div className="swatches">
        {SWATCHES.map((c) => (
          <button
            key={c}
            type="button"
            className="swatch"
            style={{ background: c }}
            aria-label={`${label} ${c}`}
            aria-pressed={value.toLowerCase() === c}
            onClick={() => onChange(c)}
          />
        ))}
        <label className="swatch swatch-custom" htmlFor={id}>
          <span className="visually-hidden">Custom {label.toLowerCase()}</span>
          <input id={id} type="color" value={value} onChange={(e) => onChange(e.target.value)} />
        </label>
      </div>
    </fieldset>
  );
}

export function SettingsView({ settings, storage, onSave, onDataChanged }: Props) {
  const [draft, setDraft] = useState(settings);
  const [low, setLow] = useState(String(settings.range.low));
  const [high, setHigh] = useState(String(settings.range.high));
  const [rangeError, setRangeError] = useState<string | null>(null);
  const [status, setStatus] = useState('');

  async function submit(e: FormEvent) {
    e.preventDefault();
    const range = { low: Number(low), high: Number(high) };
    const problem = low.trim() === '' || high.trim() === '' ? 'Enter both numbers.' : validateRange(range);
    setRangeError(problem);
    if (problem) {
      document.getElementById('range-low')?.focus();
      return;
    }
    await onSave({ ...draft, range });
    setStatus('Saved!');
  }

  const hero = draft.hero;
  const setHero = (patch: Partial<Settings['hero']>) => setDraft((d) => ({ ...d, hero: { ...d.hero, ...patch } }));

  return (
    <section className="view" aria-labelledby="settings-heading">
      <h2 id="settings-heading">Settings</h2>
      <form className="form" onSubmit={submit} noValidate onChange={() => setStatus('')}>
        <div className="field">
          <label htmlFor="child-name">Whose body is this?</label>
          <input
            id="child-name"
            value={draft.childName}
            autoComplete="off"
            placeholder="First name"
            onChange={(e) => setDraft({ ...draft, childName: e.target.value })}
          />
          <p className="hint">Only saved on this device.</p>
        </div>

        <fieldset className="field-group">
          <legend>Target range (mg/dL)</legend>
          <p className="hint">Set this to match the care team&apos;s plan. 70–180 is only a starting value.</p>
          <div className="range-row">
            <div className="field">
              <label htmlFor="range-low">Low</label>
              <input
                id="range-low"
                inputMode="numeric"
                value={low}
                onChange={(e) => setLow(e.target.value)}
                aria-invalid={rangeError ? true : undefined}
                aria-describedby={rangeError ? 'range-error' : undefined}
              />
            </div>
            <span aria-hidden="true" className="range-dash">
              –
            </span>
            <div className="field">
              <label htmlFor="range-high">High</label>
              <input
                id="range-high"
                inputMode="numeric"
                value={high}
                onChange={(e) => setHigh(e.target.value)}
                aria-invalid={rangeError ? true : undefined}
                aria-describedby={rangeError ? 'range-error' : undefined}
              />
            </div>
          </div>
          {rangeError && (
            <p id="range-error" className="field-error" role="alert">
              {rangeError}
            </p>
          )}
        </fieldset>

        <fieldset className="field-group">
          <legend>Your insulin hero</legend>
          <HeroPreview hero={hero} />
          <div className="field">
            <label htmlFor="hero-name">Hero name</label>
            <input
              id="hero-name"
              value={hero.name}
              maxLength={24}
              autoComplete="off"
              onChange={(e) => setHero({ name: e.target.value })}
            />
          </div>
          <ColorChoice label="Body color" value={hero.bodyColor} onChange={(bodyColor) => setHero({ bodyColor })} />
          <ColorChoice label="Cape color" value={hero.capeColor} onChange={(capeColor) => setHero({ capeColor })} />
        </fieldset>

        <div className="field">
          <label htmlFor="motion">Animation</label>
          <select
            id="motion"
            value={draft.reducedMotion}
            onChange={(e) => setDraft({ ...draft, reducedMotion: e.target.value as Settings['reducedMotion'] })}
          >
            <option value="system">Match this device</option>
            <option value="off">Full animation</option>
            <option value="on">Calm (less motion)</option>
          </select>
        </div>

        <button type="submit" className="btn btn-primary btn-block">
          Save settings
        </button>
        <p className="status" role="status">
          {status}
        </p>
      </form>

      <BackupPanel storage={storage} onDataChanged={onDataChanged} />
    </section>
  );
}
