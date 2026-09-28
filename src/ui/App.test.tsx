// @vitest-environment jsdom
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { START_MGDL } from '../domain/simulator';
import { simStore } from '../sim/simStore';
import { openStorage, type Storage } from '../storage';
import { App } from './App';

let n = 0;
let storage: Promise<Storage>;

beforeEach(() => {
  window.location.hash = '';
  simStore.reset();
  simStore.setRunning(false); // tests drive body time by hand
  storage = openStorage(`app-test-${++n}`);
});
afterEach(async () => (await storage).db.close());

const open = () => storage;
const go = (hash: string) =>
  act(() => {
    window.location.hash = hash;
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  });
const bodyTime = (minutes: number) => act(() => simStore.advanceMinutes(minutes));

describe('App', () => {
  it('shows the learning-only disclaimer on every screen', async () => {
    render(<App open={open} />);
    for (const hash of ['/', '/play', '/settings']) {
      go(hash);
      expect(await screen.findByRole('note')).toHaveTextContent(
        'For learning only. Follow your care team plan for all treatment decisions.',
      );
    }
  });

  it('has no reading log anymore: just Body, Play, Settings', async () => {
    render(<App open={open} />);
    await screen.findByRole('heading', { name: 'Example body' });
    const tabs = screen.getByRole('navigation', { name: 'Main' });
    expect(tabs).toHaveTextContent(/Body.*Play.*Settings/);
    expect(tabs).not.toHaveTextContent(/Add|History/);
  });

  it('starts as a steady, in-range example body', async () => {
    render(<App open={open} />);
    expect(await screen.findByText(String(START_MGDL))).toBeInTheDocument();
    expect(screen.getByText('IN RANGE')).toBeInTheDocument();
    expect(screen.getByText(/Example body with made-up numbers/)).toBeInTheDocument();
  });

  it('giving insulin brings the number down over body time', async () => {
    const user = userEvent.setup();
    render(<App open={open} />);
    await user.click(await screen.findByRole('button', { name: /Big insulin/ }));
    expect(screen.getByText(/Keys on the way/)).toBeInTheDocument();
    expect(screen.getByText(/Insulin working/)).toBeInTheDocument();
    bodyTime(60);
    expect(Number(document.querySelector('.mgdl')!.textContent)).toBeLessThan(START_MGDL - 10);
    bodyTime(240);
    // big insulin with no food drops the example body all the way to the meter's "LO"
    expect(document.querySelector('.mgdl')!.textContent).toBe('LO');
    expect(screen.getByText('LOW')).toBeInTheDocument();
  });

  it('eating a meal raises it, and it reads HIGH', async () => {
    const user = userEvent.setup();
    render(<App open={open} />);
    await user.click(await screen.findByRole('button', { name: /Meal/ }));
    bodyTime(120);
    expect(Number(document.querySelector('.mgdl')!.textContent)).toBeGreaterThan(180);
    expect(screen.getByText('HIGH')).toBeInTheDocument();
  });

  it('buttons never show amounts (no units or grams)', async () => {
    render(<App open={open} />);
    await screen.findByRole('heading', { name: 'Example body' });
    const controls = document.querySelector('.sim-controls')!.textContent!;
    expect(controls).not.toMatch(/\d|units?|grams?|\bg\b|\bu\b/i);
  });

  it('start over resets to the steady start', async () => {
    const user = userEvent.setup();
    render(<App open={open} />);
    await user.click(await screen.findByRole('button', { name: /Snack/ }));
    bodyTime(60);
    await user.click(screen.getByRole('button', { name: /Start over/ }));
    expect(screen.getByText(String(START_MGDL))).toBeInTheDocument();
  });

  it('uses the family-configured range and name from settings', async () => {
    const user = userEvent.setup();
    render(<App open={open} />);
    go('/settings');
    await user.type(await screen.findByLabelText('Whose body is this?'), 'Wyatt');
    const high = screen.getByLabelText('High');
    await user.clear(high);
    await user.type(high, '110');
    await user.click(screen.getByRole('button', { name: 'Save settings' }));
    await waitFor(() => expect(screen.getByRole('note')).toHaveTextContent("Follow Wyatt's care team plan"));
    go('/');
    expect(await screen.findByText('HIGH')).toBeInTheDocument(); // 120 is above a 110 high
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
  });
});
