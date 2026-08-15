import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { HangarProvider } from '@/lib/store';
import { Shell } from '@/components/Shell';
import { hangarData } from '@/data/hangar';

vi.mock('next/navigation', () => ({
  usePathname: () => '/items',
}));

describe('Shell spine fallback status', () => {
  it('shows Postgres spine fallback as a visible warning, not silent fallback', () => {
    render(
      <HangarProvider initialSpineRead={{ source: 'unavailable', fallbackReason: 'postgres-error' }}>
        <Shell>
          <div>Items content</div>
        </Shell>
      </HangarProvider>,
    );

    const banner = screen.getByRole('status');

    expect(banner).toHaveTextContent('STATIC SPINE');
    expect(banner).toHaveTextContent(
      'Hangar Postgres spine read failed. There is no offline inventory.',
    );
    expect(banner).not.toHaveTextContent(/silently/i);
    expect(screen.getByText(/DATA · DOWN · PG ERR/)).toBeInTheDocument();
  });

  it('does not show the static-data banner for Postgres-backed reads', () => {
    render(
      <HangarProvider
        initialData={{ ...hangarData, items: [hangarData.items[0]] }}
        initialSpineRead={{ source: 'postgres' }}
      >
        <Shell>
          <div>Items content</div>
        </Shell>
      </HangarProvider>,
    );

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});
