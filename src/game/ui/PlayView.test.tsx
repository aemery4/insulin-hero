// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { openStorage, type Storage } from '../../storage';
import { DEFAULT_SETTINGS } from '../../storage/settingsRepo';
import { recordResult, EMPTY_PROGRESS } from '../progress';
import { PlayView } from './PlayView';

let n = 0;
let storage: Storage;
beforeEach(async () => {
  storage = await openStorage(`play-test-${++n}`);
});
afterEach(() => storage.db.close());

const settings = { ...DEFAULT_SETTINGS, childName: 'Wyatt', hero: { ...DEFAULT_SETTINGS.hero, name: 'Captain Key' } };

describe('PlayView', () => {
  it('shows chapter 1 with only the first mission open and later chapters coming soon', async () => {
    render(<PlayView storage={storage} settings={settings} calm />);
    expect(await screen.findByRole('heading', { name: 'Insulin Hero Academy' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /First Flight/ })).toBeEnabled();
    expect(screen.getByRole('button', { name: /Door Rush/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Filter Frenzy/ })).toBeDisabled();
    expect(screen.getAllByText('Coming soon').length).toBeGreaterThanOrEqual(3);
  });

  it('first mission plays the intro story, then the mission briefing', async () => {
    const user = userEvent.setup();
    render(<PlayView storage={storage} settings={settings} calm />);
    await user.click(await screen.findByRole('button', { name: /First Flight/ }));
    expect(screen.getByText('Commander Nova')).toBeInTheDocument();
    expect(screen.getByText(/Welcome to Glucose City/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Skip story' })); // intro
    expect(screen.getByText(/Drag your finger to fly/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Skip story' })); // mission briefing story

    expect(screen.getByRole('heading', { name: 'First Flight' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Start!' })).toBeInTheDocument();
    // the persistent disclaimer is on the mission screen too
    expect(screen.getByText(/For learning only. Follow Wyatt's care team plan/)).toBeInTheDocument();
    expect((await storage.progress.get()).seenScenes).toContain('c1-intro');
  });

  it('uses the hero name in the story', async () => {
    const user = userEvent.setup();
    render(<PlayView storage={storage} settings={settings} calm />);
    await user.click(await screen.findByRole('button', { name: /First Flight/ }));
    for (let i = 0; i < 6; i++) await user.click(screen.getByRole('button', { name: /Next/ }));
    expect(screen.getAllByText('Captain Key').length).toBeGreaterThan(0);
  });

  it('shows earned stars and unlocks the next mission', async () => {
    await storage.progress.save(recordResult(EMPTY_PROGRESS, 'm1-1', 7000, 2));
    render(<PlayView storage={storage} settings={settings} calm />);
    expect(await screen.findByRole('button', { name: /Door Rush/ })).toBeEnabled();
    expect(screen.getAllByLabelText('2 of 3 stars').length).toBeGreaterThan(0);
  });
});
