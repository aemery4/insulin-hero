// @vitest-environment jsdom
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { openStorage, type Storage } from '../storage';
import { App } from './App';

let n = 0;
let storage: Promise<Storage>;

beforeEach(() => {
  window.location.hash = '';
  storage = openStorage(`app-test-${++n}`);
});
afterEach(async () => (await storage).db.close());

const open = () => storage;
const go = (hash: string) => act(() => {
  window.location.hash = hash;
  window.dispatchEvent(new HashChangeEvent('hashchange'));
});

describe('App', () => {
  it('shows the learning-only disclaimer on every screen', async () => {
    render(<App open={open} />);
    for (const hash of ['/', '/log', '/history', '/settings']) {
      go(hash);
      expect(await screen.findByRole('note')).toHaveTextContent(
        'For learning only. Follow your care team plan for all treatment decisions.',
      );
    }
  });

  it('starts with an empty scene prompt', async () => {
    render(<App open={open} />);
    expect(await screen.findByText('NO READING YET')).toBeInTheDocument();
  });

  it('logs a reading and shows the matching scene state', async () => {
    const user = userEvent.setup();
    render(<App open={open} />);
    go('/log');
    await user.type(await screen.findByLabelText('Blood sugar (mg/dL)'), '250');
    await user.click(screen.getByLabelText('Insulin was given'));
    await user.click(screen.getByRole('button', { name: /save/i }));

    expect(await screen.findByText('HIGH')).toBeInTheDocument();
    expect(screen.getByText('250')).toBeInTheDocument();
    expect(screen.getByText(/cells are locked/i)).toBeInTheDocument();
    expect(screen.getByText(/Insulin Hero is here with keys/)).toBeInTheDocument();
  });

  it('shows validation errors and does not save', async () => {
    const user = userEvent.setup();
    render(<App open={open} />);
    go('/log');
    await user.type(await screen.findByLabelText('Blood sugar (mg/dL)'), '5');
    await user.click(screen.getByRole('button', { name: /save/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/20 to 600/);
    expect(screen.getByLabelText('Blood sugar (mg/dL)')).toHaveFocus();
    expect(await (await storage).readings.list()).toEqual([]);
  });

  it('uses the family-configured range and name from settings', async () => {
    const user = userEvent.setup();
    const s = await storage;
    await s.readings.add({ mgdl: 160, timestamp: Date.now() - 60_000, insulinGiven: false, carbsEaten: false });
    render(<App open={open} />);
    expect(await screen.findByText('IN RANGE')).toBeInTheDocument();

    go('/settings');
    const name = await screen.findByLabelText('Whose body is this?');
    await user.type(name, 'Wyatt');
    const high = screen.getByLabelText('High');
    await user.clear(high);
    await user.type(high, '150');
    await user.click(screen.getByRole('button', { name: 'Save settings' }));

    await waitFor(() =>
      expect(screen.getByRole('note')).toHaveTextContent("Follow Wyatt's care team plan"),
    );
    go('/');
    expect(await screen.findByText('HIGH')).toBeInTheDocument();
  });

  it('rejects an invalid target range', async () => {
    const user = userEvent.setup();
    render(<App open={open} />);
    go('/settings');
    const low = await screen.findByLabelText('Low');
    await user.clear(low);
    await user.type(low, '200');
    await user.click(screen.getByRole('button', { name: 'Save settings' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/smaller than/);
    expect((await (await storage).settings.get()).range.low).toBe(70);
  });

  it('lists readings in history newest first', async () => {
    const s = await storage;
    const t = Date.now() - 3 * 60 * 60_000;
    await s.readings.add({ mgdl: 90, timestamp: t, insulinGiven: false, carbsEaten: false });
    await s.readings.add({ mgdl: 55, timestamp: t + 60_000, insulinGiven: false, carbsEaten: true, carbsGramsEntered: 15 });
    render(<App open={open} />);
    go('/history');
    await screen.findByRole('heading', { name: 'History' });
    const rows = screen.getAllByRole('listitem');
    expect(rows[0]).toHaveTextContent('55');
    expect(rows[0]).toHaveTextContent('LOW');
    expect(rows[0]).toHaveTextContent('Food eaten (15 g logged)');
    expect(rows[1]).toHaveTextContent('IN RANGE');
  });
});
