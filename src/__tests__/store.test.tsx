import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  HangarProvider,
  finiteContribution,
  selectedMissionWishes,
  useCalculatedConstraints,
  useHangar,
} from '@/lib/store';
import { hangarData } from '@/data/hangar';
import type { WishlistItem } from '@/data/types';

function wrapper({ children }: { children: React.ReactNode }) {
  return <HangarProvider>{children}</HangarProvider>;
}

beforeEach(() => {
  localStorage.clear();
});

// ─── selectedMissionWishes (pure function) ───────────────────────────────────

function makeWish(overrides: Partial<WishlistItem>): WishlistItem {
  return {
    id: 'w-test',
    name: 'Test Item',
    category: 'Lighting',
    status: 'buy-next',
    rationale: '',
    price: { us: 10, import: null },
    ...overrides,
  };
}

describe('selectedMissionWishes()', () => {
  it('returns [] for an empty list', () => {
    expect(selectedMissionWishes([])).toEqual([]);
  });

  it('excludes items with status "watching"', () => {
    const result = selectedMissionWishes([makeWish({ status: 'watching' })]);
    expect(result).toHaveLength(0);
  });

  it('excludes items with status "rejected"', () => {
    const result = selectedMissionWishes([makeWish({ status: 'rejected' })]);
    expect(result).toHaveLength(0);
  });

  it('includes items with status "buy-next"', () => {
    const result = selectedMissionWishes([makeWish({ id: 'a', status: 'buy-next' })]);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('a');
  });

  it('includes items with status "planned"', () => {
    const result = selectedMissionWishes([makeWish({ id: 'b', status: 'planned' })]);
    expect(result).toHaveLength(1);
  });

  it('includes items with status "received"', () => {
    const result = selectedMissionWishes([makeWish({ id: 'c', status: 'received' })]);
    expect(result).toHaveLength(1);
  });

  it('deduplicates same category — keeps the higher-priority item (buy-next beats planned)', () => {
    const planned = makeWish({ id: 'planned-id', status: 'planned', category: 'Lighting' });
    const buyNext = makeWish({ id: 'buynext-id', status: 'buy-next', category: 'Lighting' });
    const result = selectedMissionWishes([planned, buyNext]);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('buynext-id');
  });

  it('deduplicates in either order (buy-next first, planned second)', () => {
    const buyNext = makeWish({ id: 'buynext-id', status: 'buy-next', category: 'Lighting' });
    const planned = makeWish({ id: 'planned-id', status: 'planned', category: 'Lighting' });
    const result = selectedMissionWishes([buyNext, planned]);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('buynext-id');
  });

  it('uses acquisition pipeline priority for later committed statuses', () => {
    const buyNext = makeWish({ id: 'buynext-id', status: 'buy-next', category: 'Lighting' });
    const onOrder = makeWish({ id: 'onorder-id', status: 'on-order', category: 'Lighting' });
    const received = makeWish({ id: 'received-id', status: 'received', category: 'Lighting' });

    expect(selectedMissionWishes([received, onOrder, buyNext])).toEqual([received]);
    expect(selectedMissionWishes([buyNext, onOrder])).toEqual([onOrder]);
  });

  it('keeps both items when categories differ', () => {
    const lighting = makeWish({ id: 'a', status: 'buy-next', category: 'Lighting' });
    const sensing = makeWish({ id: 'b', status: 'planned', category: 'Sensing' });
    const result = selectedMissionWishes([lighting, sensing]);
    expect(result).toHaveLength(2);
  });

  it('"watching" item does not displace an equal-priority selected item of the same category', () => {
    const watcher = makeWish({ id: 'watcher', status: 'watching', category: 'Lighting' });
    const buyer = makeWish({ id: 'buyer', status: 'buy-next', category: 'Lighting' });
    const result = selectedMissionWishes([watcher, buyer]);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('buyer');
  });
});

describe('finiteContribution()', () => {
  it('keeps finite numeric contributions', () => {
    expect(finiteContribution(12)).toBe(12);
    expect(finiteContribution(0)).toBe(0);
    expect(finiteContribution(-3)).toBe(-3);
  });

  it('treats non-finite and malformed contributions as zero', () => {
    expect(finiteContribution(Number.NaN)).toBe(0);
    expect(finiteContribution(Number.POSITIVE_INFINITY)).toBe(0);
    expect(finiteContribution(Number.NEGATIVE_INFINITY)).toBe(0);
    expect(finiteContribution(null)).toBe(0);
    expect(finiteContribution(undefined)).toBe(0);
    expect(finiteContribution('12')).toBe(0);
  });
});

// ─── useHangar() ─────────────────────────────────────────────────────────────

describe('useHangar()', () => {
  it('throws when used outside HangarProvider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => renderHook(() => useHangar())).toThrow('useHangar must be used within HangarProvider');
    spy.mockRestore();
  });

  it('falls back from unsupported persisted theme and source preferences', () => {
    localStorage.setItem('hangar:theme', 'sepia');
    localStorage.setItem('hangar:source', 'warehouse');

    const { result } = renderHook(() => useHangar(), { wrapper });

    expect(result.current.theme).toBe('blueprint');
    expect(result.current.source).toBe('us');
  });
});

// ─── useCalculatedConstraints() ───────────────────────────────────────────────

describe('useCalculatedConstraints()', () => {
  it('returns [] for an unknown mission ID', () => {
    const { result } = renderHook(() => useCalculatedConstraints('does-not-exist'), { wrapper });
    expect(result.current).toEqual([]);
  });

  it('augments the W constraint with buy-next wish power (light-bar)', () => {
    const { result } = renderHook(() => useCalculatedConstraints('undercroft'), { wrapper });
    const undercroft = hangarData.missions.find((m) => m.id === 'undercroft')!;
    const lightBar = hangarData.wishlist.find((w) => w.id === 'light-bar')!;
    const base = undercroft.constraints.find((c) => c.unit === 'W')!.value;
    const power = result.current.find((c) => c.unit === 'W');
    expect(power?.value).toBe(base + (lightBar.power?.watts ?? 0));
  });

  it('augments the g constraint with buy-next wish mass (light-bar)', () => {
    const { result } = renderHook(() => useCalculatedConstraints('undercroft'), { wrapper });
    const undercroft = hangarData.missions.find((m) => m.id === 'undercroft')!;
    const lightBar = hangarData.wishlist.find((w) => w.id === 'light-bar')!;
    const base = undercroft.constraints.find((c) => c.unit === 'g')!.value;
    const mass = result.current.find((c) => c.unit === 'g');
    expect(mass?.value).toBe(base + (lightBar.massGrams ?? 0));
  });

  it('uses US price by default for $ constraint (light-bar)', () => {
    const { result } = renderHook(() => useCalculatedConstraints('undercroft'), { wrapper });
    const undercroft = hangarData.missions.find((m) => m.id === 'undercroft')!;
    const lightBar = hangarData.wishlist.find((w) => w.id === 'light-bar')!;
    const base = undercroft.constraints.find((c) => c.unit === '$')!.value;
    const cost = result.current.find((c) => c.unit === '$');
    expect(cost?.value).toBe(base + (lightBar.price.us ?? 0));
  });

  it('uses import price when source is switched to "import" (light-bar)', () => {
    const { result } = renderHook(
      () => ({
        hangar: useHangar(),
        constraints: useCalculatedConstraints('undercroft'),
      }),
      { wrapper }
    );
    const undercroft = hangarData.missions.find((m) => m.id === 'undercroft')!;
    const lightBar = hangarData.wishlist.find((w) => w.id === 'light-bar')!;
    const base = undercroft.constraints.find((c) => c.unit === '$')!.value;
    act(() => {
      result.current.hangar.setSource('import');
    });
    const cost = result.current.constraints.find((c) => c.unit === '$');
    expect(cost?.value).toBe(base + (lightBar.price.import ?? lightBar.price.us ?? 0));
  });

  it('does not alter constraints for a mission whose wishlist items are all "researching" (excluded status)', () => {
    // perimeter-mapping wishlist: ['depth-cam'] — depth-cam is 'researching', not a committed requisition status.
    const { result } = renderHook(() => useCalculatedConstraints('perimeter-mapping'), { wrapper });
    const power = result.current.find((c) => c.unit === 'W');
    const perimeter = hangarData.missions.find((m) => m.id === 'perimeter-mapping')!;
    const base = perimeter.constraints.find((c) => c.unit === 'W')!.value;
    expect(power?.value).toBe(base);
  });
});

// ─── updateSlot() ────────────────────────────────────────────────────────────

describe('updateSlot()', () => {
  it('sets filledBy when slotting a unit into an empty slot', () => {
    const { result } = renderHook(() => useHangar(), { wrapper });
    act(() => {
      result.current.updateSlot('beast', '21mm Picatinny Rail', 'orin-nano');
    });
    const beast = result.current.units.find((u) => u.id === 'beast');
    const slot = beast?.loadout?.find((s) => s.slot === '21mm Picatinny Rail');
    expect(slot?.filledBy).toBe('orin-nano');
  });

  it('clears filledBy when null is passed', () => {
    const { result } = renderHook(() => useHangar(), { wrapper });
    // 'Host Controller Mount' starts with filledBy: 'pi5'
    act(() => {
      result.current.updateSlot('beast', 'Host Controller Mount', null);
    });
    const beast = result.current.units.find((u) => u.id === 'beast');
    const slot = beast?.loadout?.find((s) => s.slot === 'Host Controller Mount');
    expect(slot?.filledBy).toBeNull();
  });

  it('does not alter other units when updating a slot', () => {
    const { result } = renderHook(() => useHangar(), { wrapper });
    const unitCountBefore = result.current.units.length;
    act(() => {
      result.current.updateSlot('beast', 'Middle Deck', 'orin-nano');
    });
    expect(result.current.units.length).toBe(unitCountBefore);
  });
});

// ─── item() accessor ─────────────────────────────────────────────────────────

describe('item() accessor', () => {
  it('exposes all seeded inventory items', () => {
    const { result } = renderHook(() => useHangar(), { wrapper });
    expect(result.current.items.length).toBe(hangarData.items.length);
    expect(result.current.items.length).toBeGreaterThan(0);
  });

  it('uses server-provided inventory items when present', () => {
    const dbItem = {
      ...hangarData.items[0],
      id: 'db-backed-item',
      name: 'DB-backed item',
    };
    const customWrapper = ({ children }: { children: React.ReactNode }) => (
      <HangarProvider
        initialData={{ ...hangarData, items: [dbItem] }}
        initialSpineRead={{ source: 'postgres' }}
      >
        {children}
      </HangarProvider>
    );

    const { result } = renderHook(() => useHangar(), { wrapper: customWrapper });

    expect(result.current.items).toEqual([dbItem]);
    expect(result.current.data.items).toEqual([dbItem]);
    expect(result.current.inventoryRead).toEqual({ source: 'postgres' });
    expect(result.current.item('db-backed-item')?.name).toBe('DB-backed item');
    expect(result.current.item(hangarData.items[0].id)).toBeUndefined();
  });

  it('trusts the caller-supplied read status even when initialData is not overridden', () => {
    // initialData / initialSpineRead are supplied atomically by the caller (see
    // src/app/layout.tsx, which derives both from a single getHangarSpine() read) —
    // unlike the removed deprecated initialItems/initialInventoryRead pair, the
    // supported props are never reconciled against each other; the provider takes
    // initialSpineRead at face value regardless of whether initialData was given.
    const customWrapper = ({ children }: { children: React.ReactNode }) => (
      <HangarProvider initialSpineRead={{ source: 'postgres' }}>
        {children}
      </HangarProvider>
    );

    const { result } = renderHook(() => useHangar(), { wrapper: customWrapper });

    expect(result.current.items).toBe(hangarData.items);
    expect(result.current.inventoryRead).toEqual({ source: 'postgres' });
  });

  it('exposes unavailable inventory fallback status when no server read status is supplied', () => {
    const { result } = renderHook(() => useHangar(), { wrapper });

    expect(result.current.inventoryRead).toEqual({
      source: 'unavailable',
      fallbackReason: 'not-configured',
    });
  });

  it('resolves a known item id to its record', () => {
    const seeded = hangarData.items[0];
    const { result } = renderHook(() => useHangar(), { wrapper });
    expect(result.current.item(seeded.id)?.name).toBe(seeded.name);
  });

  it('returns undefined for an unknown item id', () => {
    const { result } = renderHook(() => useHangar(), { wrapper });
    expect(result.current.item('does-not-exist')).toBeUndefined();
  });
});

// ─── openDrawer() / closeDrawer() ────────────────────────────────────────────

describe('openDrawer() / closeDrawer()', () => {
  it('openDrawer sets drawerOpen to true and stores the slot context', () => {
    const { result } = renderHook(() => useHangar(), { wrapper });
    act(() => {
      result.current.openDrawer('beast', 'Host Controller Mount');
    });
    expect(result.current.drawerOpen).toBe(true);
    expect(result.current.drawerSlotContext).toEqual({ parentId: 'beast', slotName: 'Host Controller Mount' });
  });

  it('closeDrawer sets drawerOpen to false and nulls the context', () => {
    const { result } = renderHook(() => useHangar(), { wrapper });
    act(() => {
      result.current.openDrawer('beast', 'Serial Bus Servo');
    });
    act(() => {
      result.current.closeDrawer();
    });
    expect(result.current.drawerOpen).toBe(false);
    expect(result.current.drawerSlotContext).toBeNull();
  });
});
