import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { HangarProvider } from '@/lib/store';
import { hangarData } from '@/data/hangar';
import { ITEM_STATUS_META } from '@/lib/format';
import Items from '@/app/items/page';
import type { InventoryItem } from '@/data/types';

function renderItems(items?: InventoryItem[]) {
  return render(
    <HangarProvider initialData={items ? { ...hangarData, items } : undefined}>
      <Items />
    </HangarProvider>,
  );
}

beforeEach(() => {
  localStorage.clear();
});

describe('Items station', () => {
  it('renders every seeded inventory item by name', () => {
    renderItems();
    hangarData.items.forEach((it) => {
      expect(screen.getByText(it.name)).toBeInTheDocument();
    });
  });

  it('shows the cataloged count matching the data', () => {
    renderItems();
    // The "Cataloged" stat readout reflects the number of items in the spine.
    const cataloged = screen.getByText('Cataloged').parentElement;
    expect(cataloged).toHaveTextContent(String(hangarData.items.length));
  });

  it('renders the human-readable status label for each item', () => {
    renderItems();
    hangarData.items.forEach((it) => {
      const label = ITEM_STATUS_META[it.status].label;
      // At least one element should carry the status label text.
      expect(screen.getAllByText((_, el) => el?.textContent === label).length).toBeGreaterThan(0);
    });
  });

  it('links a related unit to its detail page', () => {
    const itemWithUnit: InventoryItem = {
      ...hangarData.items[0],
      id: 'db-related-item',
      name: 'DB Related Item',
      relatedUnits: ['beast'],
    };

    renderItems([itemWithUnit]);

    const link = screen.getByRole('link', { name: /UGV Beast/ });

    expect(link).toHaveAttribute('href', '/unit/beast');
  });

  it('opens external source links with tabnabbing protections', () => {
    renderItems();
    const itemWithSource = hangarData.items.find((it) => (it.sources ?? []).length > 0);
    if (!itemWithSource?.sources?.[0]) return;

    const source = itemWithSource.sources[0];
    const link = screen.getByRole('link', { name: source.label });

    expect(link).toHaveAttribute('href', source.url);
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('shows an empty-state hint only when there are no items', () => {
    renderItems();
    // Seed data has items, so the empty-state copy must NOT be present.
    expect(screen.queryByText(/No inventory items cataloged yet/i)).not.toBeInTheDocument();
  });
});
