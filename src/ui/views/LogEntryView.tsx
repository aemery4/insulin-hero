import { useRef, useState, type FormEvent } from 'react';
import { NOTES_MAX, validateReading, type FieldErrors, type ReadingDraft } from '../../domain/validation';
import type { NewReading } from '../../storage/readingsRepo';
import { fromLocalInput, toLocalInput } from '../format';

interface Props {
  onSave: (reading: NewReading) => Promise<unknown>;
  now?: () => number;
}

const optionalNumber = (raw: string) => (raw.trim() === '' ? undefined : Number(raw));

export function LogEntryView({ onSave, now = Date.now }: Props) {
  const [draft, setDraft] = useState<ReadingDraft>(() => ({
    mgdl: '',
    timestamp: now(),
    notes: '',
    insulinGiven: false,
    insulinUnits: '',
    carbsEaten: false,
    carbsGrams: '',
  }));
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saving, setSaving] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  const set = <K extends keyof ReadingDraft>(key: K, value: ReadingDraft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    const found = validateReading(draft, now());
    setErrors(found);
    const firstBad = Object.keys(found)[0];
    if (firstBad) {
      formRef.current?.querySelector<HTMLElement>(`[name="${firstBad}"]`)?.focus();
      return;
    }
    setSaving(true);
    try {
      await onSave({
        mgdl: Number(draft.mgdl),
        timestamp: draft.timestamp,
        notes: draft.notes.trim() || undefined,
        insulinGiven: draft.insulinGiven,
        insulinUnitsEntered: draft.insulinGiven ? optionalNumber(draft.insulinUnits) : undefined,
        carbsEaten: draft.carbsEaten,
        carbsGramsEntered: draft.carbsEaten ? optionalNumber(draft.carbsGrams) : undefined,
      });
    } finally {
      setSaving(false);
    }
  }

  const err = (key: keyof ReadingDraft) =>
    errors[key] ? (
      <p id={`${key}-error`} className="field-error" role="alert">
        {errors[key]}
      </p>
    ) : null;
  const a11y = (key: keyof ReadingDraft) => ({
    'aria-invalid': errors[key] ? true : undefined,
    'aria-describedby': errors[key] ? `${key}-error` : undefined,
  });

  return (
    <section className="view" aria-labelledby="log-heading">
      <h2 id="log-heading">Add a reading</h2>
      <form ref={formRef} className="form" onSubmit={submit} noValidate>
        <div className="field">
          <label htmlFor="mgdl">Blood sugar (mg/dL)</label>
          <input
            id="mgdl"
            name="mgdl"
            className="input-big"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete="off"
            value={draft.mgdl}
            onChange={(e) => set('mgdl', e.target.value)}
            {...a11y('mgdl')}
          />
          {err('mgdl')}
        </div>

        <div className="field">
          <label htmlFor="timestamp">When</label>
          <input
            id="timestamp"
            name="timestamp"
            type="datetime-local"
            value={Number.isFinite(draft.timestamp) ? toLocalInput(draft.timestamp) : ''}
            onChange={(e) => set('timestamp', fromLocalInput(e.target.value))}
            {...a11y('timestamp')}
          />
          {err('timestamp')}
        </div>

        <fieldset className="field-group">
          <legend>Anything else that happened? (optional)</legend>
          <p className="hint">This only shows it in the animation. The app never suggests amounts.</p>

          <label className="check">
            <input
              type="checkbox"
              name="insulinGiven"
              checked={draft.insulinGiven}
              onChange={(e) => set('insulinGiven', e.target.checked)}
            />
            Insulin was given
          </label>
          {draft.insulinGiven && (
            <div className="field field-nested">
              <label htmlFor="insulinUnits">Units, for your log (optional)</label>
              <input
                id="insulinUnits"
                name="insulinUnits"
                inputMode="decimal"
                autoComplete="off"
                value={draft.insulinUnits}
                onChange={(e) => set('insulinUnits', e.target.value)}
                {...a11y('insulinUnits')}
              />
              {err('insulinUnits')}
            </div>
          )}

          <label className="check">
            <input
              type="checkbox"
              name="carbsEaten"
              checked={draft.carbsEaten}
              onChange={(e) => set('carbsEaten', e.target.checked)}
            />
            Food or fast sugar was eaten
          </label>
          {draft.carbsEaten && (
            <div className="field field-nested">
              <label htmlFor="carbsGrams">Carbs in grams, for your log (optional)</label>
              <input
                id="carbsGrams"
                name="carbsGrams"
                inputMode="decimal"
                autoComplete="off"
                value={draft.carbsGrams}
                onChange={(e) => set('carbsGrams', e.target.value)}
                {...a11y('carbsGrams')}
              />
              {err('carbsGrams')}
            </div>
          )}
        </fieldset>

        <div className="field">
          <label htmlFor="notes">Notes (optional)</label>
          <textarea
            id="notes"
            name="notes"
            rows={3}
            maxLength={NOTES_MAX}
            value={draft.notes}
            onChange={(e) => set('notes', e.target.value)}
            {...a11y('notes')}
          />
          {err('notes')}
        </div>

        <button type="submit" className="btn btn-primary btn-block" disabled={saving}>
          {saving ? 'Saving…' : 'Save and see what happens'}
        </button>
      </form>
    </section>
  );
}
