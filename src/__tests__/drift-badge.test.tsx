import { describe, it, expect } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { DriftBadge } from '@/components/board/DriftBadge';
import { hangarData } from '@/data/hangar';
import { buildBoardLayout } from '@/lib/twin';
import type { Terminal } from '@/data/types';

const { units, terminals, nets } = hangarData;

const stray: Terminal = {
  id: 'zz-orin-stray',
  unitId: 'orin-nano',
  name: 'Ingested Orin port',
};
const orphan: Terminal = {
  id: 'zz-orphan',
  unitId: 'zz-unplaced-unit',
  name: 'Orphan port',
};

function renderFor(extra: Terminal[], compact = false) {
  const all = [...terminals, ...extra];
  return render(
    <DriftBadge
      layout={buildBoardLayout(units, all, nets)}
      terminals={all}
      units={units}
      compact={compact}
    />,
  );
}

describe('DriftBadge', () => {
  it('renders nothing when every terminal is authored', () => {
    const { container } = renderFor([]);
    // The normal case. A badge that cries wolf on a clean board is worse than none.
    expect(container).toBeEmptyDOMElement();
  });

  it('counts guessed and undrawn terminals together', () => {
    renderFor([stray, orphan]);
    // One of each: the label names what happened to each, because "unplaced"
    // is untrue of a terminal that is drawn from a guess.
    const button = screen.getByRole('button', { name: /1 guessed, 1 unplaced/i });
    expect(button).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'true');

    // Each kind is reported under its own reason, by name rather than by id.
    expect(screen.getByText(/no authored edge/i)).toBeInTheDocument();
    expect(screen.getByText(/Ingested Orin port/)).toBeInTheDocument();
    expect(screen.getByText(/unit has no place in this view/i)).toBeInTheDocument();
    expect(screen.getByText(/Orphan port/)).toBeInTheDocument();
  });

  it('singularises a lone finding and hides detail until asked', () => {
    renderFor([stray]);
    // Drawn from a guess, so "guessed" — not "unplaced".
    expect(screen.getByRole('button', { name: /^1 guessed$/i })).toBeInTheDocument();
    expect(screen.queryByText(/unplaced/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/no authored edge/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByText(/no authored edge/i)).toBeInTheDocument();
    // Only the guessed section appears; nothing was dropped from the board.
    expect(screen.queryByText(/unit has no place in this view/i)).not.toBeInTheDocument();
  });

  it('shows the count but no detail in compact preview mode', () => {
    // Unit pages render a 64px-tall preview with no room to expand. Silence
    // there would hide drift on every unit page, so the count still shows.
    renderFor([stray, orphan], true);
    // Inert text, not a control: the preview sits inside a card-wide <Link>,
    // where a nested button is invalid and a disabled one eats the card click.
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByText(/1 guessed, 1 unplaced/i)).toBeInTheDocument();
    expect(screen.queryByText(/no authored edge/i)).not.toBeInTheDocument();
  });

  it('attributes each entry to its owning unit', () => {
    // Connector names repeat across units — the seed already has "USB Host
    // Ports" on both the Pi and the Orin — so a bare name cannot tell an
    // operator which placement to fix.
    const dupA: Terminal = { id: 'zz-dup-a', unitId: 'pi5', name: 'USB Host Ports' };
    const dupB: Terminal = { id: 'zz-dup-b', unitId: 'orin-nano', name: 'USB Host Ports' };
    renderFor([dupA, dupB]);
    fireEvent.click(screen.getByRole('button'));

    const items = screen.getAllByRole('listitem').map((li) => li.textContent ?? '');
    const dupes = items.filter((t) => t.includes('USB Host Ports'));
    expect(dupes).toHaveLength(2);
    // Same connector name, but the rows are distinguishable.
    expect(new Set(dupes).size).toBe(2);
  });
});
