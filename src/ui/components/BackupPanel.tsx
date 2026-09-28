import { useState, type ChangeEvent } from 'react';
import type { Storage } from '../../storage';
import { BackupError, exportBackup, importBackup, parseBackup, type BackupFile } from '../../storage/backup';

interface Props {
  storage: Storage | null;
  onDataChanged: () => Promise<void>;
}

function saveFile(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function BackupPanel({ storage, onDataChanged }: Props) {
  const [pending, setPending] = useState<BackupFile | null>(null);
  const [message, setMessage] = useState('');

  async function doExport() {
    if (!storage) return;
    const backup = await exportBackup(storage.db);
    saveFile(`insulin-hero-backup-${backup.exportedAt.slice(0, 10)}.json`, JSON.stringify(backup, null, 2));
    setMessage('Saved a backup of game progress and settings.');
  }

  async function chooseFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      setPending(parseBackup(await file.text()));
      setMessage('');
    } catch (err) {
      setPending(null);
      setMessage(err instanceof BackupError ? err.message : "Couldn't read that file.");
    }
  }

  async function restore() {
    if (!storage || !pending) return;
    await importBackup(storage.db, pending, 'replace');
    setPending(null);
    await onDataChanged();
    setMessage('Restored game progress and settings.');
  }

  async function deleteAll() {
    if (!storage) return;
    if (!window.confirm('Delete ALL game progress and settings on this device? This cannot be undone.')) return;
    await storage.readings.clear();
    await storage.db.clear('settings');
    await storage.db.clear('progress');
    await onDataChanged();
    setMessage('All data on this device was deleted.');
  }

  return (
    <section className="panel" aria-labelledby="backup-heading">
      <h3 id="backup-heading">Backup</h3>
      <p className="hint">
        Game progress (stars, story) and settings are only stored on this device. Save a backup file to move them to
        another phone or keep them safe.
      </p>
      <div className="button-stack">
        <button type="button" className="btn btn-secondary" onClick={doExport} disabled={!storage}>
          Save backup file
        </button>
        <label className="btn btn-secondary file-btn">
          Restore from backup file
          <input type="file" accept="application/json,.json" onChange={chooseFile} className="visually-hidden" />
        </label>
      </div>

      {pending && (
        <div className="confirm-box">
          <p>Restore game progress and settings from this backup? It replaces what&apos;s on this device now.</p>
          <div className="button-stack">
            <button type="button" className="btn btn-primary" onClick={restore}>
              Restore
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setPending(null)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      <p className="status" role="status">
        {message}
      </p>

      <button type="button" className="btn btn-danger" onClick={deleteAll} disabled={!storage}>
        Delete all data on this device
      </button>
    </section>
  );
}
