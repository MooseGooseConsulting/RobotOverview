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

function renderFor(extra: Terminal[]) {
  const all = [...terminals, ...extra];
  return render(<DriftBadge layout={buildBoardLayout(units, all, nets)} terminals={all} />);
}

describe('DriftBadge', () => {
  it('renders nothing when every terminal is authored', () => {
    const { container } = renderFor([]);
    // The normal case. A badge that cries wolf on a clean board is worse than none.
    expect(container).toBeEmptyDOMElement();
  });

  it('counts guessed and undrawn terminals together', () => {
    renderFor([stray, orphan]);
    const button = screen.getByRole('button', { name: /2 unplaced terminals/i });
    expect(button).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'true');

    // Each kind is reported under its own reason, by name rather than by id.
    expect(screen.getByText(/no authored edge/i)).toBeInTheDocument();
    expect(screen.getByText(/Ingested Orin port/)).toBeInTheDocument();
    expect(screen.getByText(/unit has no place on this board/i)).toBeInTheDocument();
    expect(screen.getByText(/Orphan port/)).toBeInTheDocument();
  });

  it('singularises a lone finding and hides detail until asked', () => {
    renderFor([stray]);
    expect(screen.getByRole('button', { name: /1 unplaced terminal$/i })).toBeInTheDocument();
    expect(screen.queryByText(/no authored edge/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByText(/no authored edge/i)).toBeInTheDocument();
    // Only the guessed section appears; nothing was dropped from the board.
    expect(screen.queryByText(/unit has no place on this board/i)).not.toBeInTheDocument();
  });
});
