// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { App } from './App';

describe('App', () => {
  it('shows the learning-only disclaimer', () => {
    render(<App />);
    expect(screen.getByRole('note')).toHaveTextContent(/for learning only/i);
  });
});
