import { zoneFor } from '../../domain/sceneState';
import type { Reading, Settings } from '../../domain/types';
import { ZoneBadge } from '../components/ZoneBadge';
import { formatDay, formatTime } from '../format';

interface Props {
  readings: Reading[];
  settings: Settings;
  onDelete: (id: string) => void;
}

function groupByDay(readings: Reading[]): [string, Reading[]][] {
  const groups = new Map<string, Reading[]>();
  for (const r of [...readings].reverse()) {
    const day = formatDay(r.timestamp);
    groups.set(day, [...(groups.get(day) ?? []), r]);
  }
  return [...groups];
}

export function HistoryView({ readings, settings, onDelete }: Props) {
  return (
    <section className="view" aria-labelledby="history-heading">
      <h2 id="history-heading">History</h2>
      {readings.length === 0 ? (
        <p className="empty">No readings yet. Tap Add to log one.</p>
      ) : (
        groupByDay(readings).map(([day, items]) => (
          <div key={day} className="day-group">
            <h3>{day}</h3>
            <ul className="reading-list">
              {items.map((r) => (
                <li key={r.id} className="reading-row">
                  <div className="reading-row-main">
                    <span className="reading-row-time">{formatTime(r.timestamp)}</span>
                    <span className="reading-row-mgdl">
                      {r.mgdl} <small>mg/dL</small>
                    </span>
                    <ZoneBadge zone={zoneFor(r.mgdl, settings.range)} size="sm" />
                  </div>
                  {(r.insulinGiven || r.carbsEaten || r.notes) && (
                    <p className="reading-row-extra">
                      {[
                        r.insulinGiven &&
                          `Insulin given${r.insulinUnitsEntered !== undefined ? ` (${r.insulinUnitsEntered} u logged)` : ''}`,
                        r.carbsEaten &&
                          `Food eaten${r.carbsGramsEntered !== undefined ? ` (${r.carbsGramsEntered} g logged)` : ''}`,
                        r.notes,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                  )}
                  <button
                    type="button"
                    className="btn btn-ghost btn-small"
                    onClick={() => {
                      if (window.confirm(`Delete the ${r.mgdl} reading from ${formatTime(r.timestamp)}?`)) onDelete(r.id);
                    }}
                  >
                    Delete<span className="visually-hidden"> reading {r.mgdl} at {formatTime(r.timestamp)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))
      )}
    </section>
  );
}
