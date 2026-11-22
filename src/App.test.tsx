import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';

describe('ClearText workflow', () => {
  it('analyses the demo text with all issue types', () => {
    window.location.hash = '/editor';
    render(<App />);
    expect(screen.getAllByText('Very long sentence').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Passive voice').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Replace In order to with To' })).toBeInTheDocument();
  });

  it('applies one suggestion, then all, reducing issues', async () => {
    window.location.hash = '/editor';
    const user = userEvent.setup();
    render(<App />);
    const before = Number(screen.getByTestId('issues').textContent);
    await user.click(screen.getByRole('button', { name: 'Replace regarding with about' }));
    expect(screen.getByText('Replaced “regarding” with “about”.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Apply all \d+ simpler words/ }));
    expect(Number(screen.getByTestId('issues').textContent)).toBeLessThan(before);
    expect(screen.queryAllByRole('button', { name: /^Replace / })).toHaveLength(0);
  });

  it('filters issue types, edits text and reports a clean result', async () => {
    window.location.hash = '/editor';
    const user = userEvent.setup();
    render(<App />);
    const types = screen.getByRole('group', { name: 'Show issue types' });
    await user.click(within(types).getByRole('button', { name: /^Passive voice/ }));
    expect(within(types).getByRole('button', { name: /^Passive voice/ })).toHaveAttribute('aria-pressed', 'false');
    await user.click(screen.getByRole('radio', { name: 'Edit' }));
    fireEvent.change(screen.getByLabelText('Your text'), { target: { value: 'We open at nine. Bring your card.' } });
    expect(screen.getByText(/No issues found/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Your text'), { target: { value: '' } });
    expect(screen.getByText('Nothing to check yet')).toBeInTheDocument();
  });
});
