import { describe, expect, it } from 'vitest';
import type { DocumentRef } from '@/data/types';
import {
  documentSubsystem,
  groupDocumentsBySubsystem,
  normalizeLibraryBaseUrl,
  resolveDocumentUrl,
  stripLibraryPrefix,
} from '@/lib/documents';
import { normalizeLibraryObjectKey } from '@/server/hangar/library';

function doc(partial: Partial<DocumentRef> & Pick<DocumentRef, 'libraryPath'>): DocumentRef {
  return {
    id: partial.id ?? 'doc-x',
    title: partial.title ?? 'Doc',
    kind: partial.kind ?? 'schematic',
    libraryPath: partial.libraryPath,
    url: partial.url,
    units: partial.units,
    note: partial.note,
  };
}

describe('stripLibraryPrefix', () => {
  it('drops the beast/ prefix', () => {
    expect(stripLibraryPrefix('beast/02-Driver-Board/x.pdf')).toBe('02-Driver-Board/x.pdf');
  });
  it('leaves already-relative paths alone', () => {
    expect(stripLibraryPrefix('02-Driver-Board/x.pdf')).toBe('02-Driver-Board/x.pdf');
  });
});

describe('normalizeLibraryBaseUrl', () => {
  it('returns null for unset/empty input', () => {
    expect(normalizeLibraryBaseUrl(undefined)).toBeNull();
    expect(normalizeLibraryBaseUrl(null)).toBeNull();
    expect(normalizeLibraryBaseUrl('')).toBeNull();
    expect(normalizeLibraryBaseUrl('   ')).toBeNull();
  });

  it('trims whitespace and trailing slashes', () => {
    expect(normalizeLibraryBaseUrl('  https://library.example.com/ ')).toBe('https://library.example.com');
    expect(normalizeLibraryBaseUrl('https://library.example.com///')).toBe('https://library.example.com');
  });
});

describe('resolveDocumentUrl', () => {
  it('returns null when no url and no base configured', () => {
    expect(resolveDocumentUrl(doc({ libraryPath: 'beast/02-Driver-Board/x.pdf' }), null)).toBeNull();
  });

  it('prefers an explicit url', () => {
    const url = resolveDocumentUrl(
      doc({ libraryPath: 'beast/02-Driver-Board/x.pdf', url: 'https://cdn.example.com/x.pdf' }),
      'https://library.example.com',
    );
    expect(url).toBe('https://cdn.example.com/x.pdf');
  });

  it('builds a url from base + library key', () => {
    const url = resolveDocumentUrl(
      doc({ libraryPath: 'beast/02-Driver-Board/x.pdf' }),
      'https://library.example.com',
    );
    expect(url).toBe('https://library.example.com/02-Driver-Board/x.pdf');
  });

  it('url-encodes path segments with spaces', () => {
    const url = resolveDocumentUrl(
      doc({ libraryPath: 'beast/05-Chassis-CAD/UGV Beast PT.step' }),
      'https://library.example.com',
    );
    expect(url).toBe('https://library.example.com/05-Chassis-CAD/UGV%20Beast%20PT.step');
  });
});

describe('documentSubsystem', () => {
  it('parses the numeric folder into order + human label', () => {
    const s = documentSubsystem(doc({ libraryPath: 'beast/06-Jetson-Orin/x.zip' }));
    expect(s).toEqual({ key: '06-Jetson-Orin', order: 6, label: 'Jetson Orin' });
  });
});

describe('groupDocumentsBySubsystem', () => {
  it('groups and orders by numeric folder prefix', () => {
    const groups = groupDocumentsBySubsystem([
      doc({ id: 'a', libraryPath: 'beast/06-Jetson-Orin/a.zip' }),
      doc({ id: 'b', libraryPath: 'beast/02-Driver-Board/b.pdf' }),
      doc({ id: 'c', libraryPath: 'beast/02-Driver-Board/c.zip' }),
    ]);
    expect(groups.map((g) => g.subsystem.key)).toEqual(['02-Driver-Board', '06-Jetson-Orin']);
    expect(groups[0].documents.map((d) => d.id)).toEqual(['b', 'c']);
  });

  it('breaks order ties deterministically by subsystem key', () => {
    const groups = groupDocumentsBySubsystem([
      doc({ id: 'a', libraryPath: 'zzz-unrecognized/a.zip' }),
      doc({ id: 'b', libraryPath: 'aaa-unrecognized/b.zip' }),
    ]);
    // both fall back to order 999 (no numeric prefix) — key breaks the tie
    expect(groups.map((g) => g.subsystem.key)).toEqual(['aaa-unrecognized', 'zzz-unrecognized']);
  });
});

describe('normalizeLibraryObjectKey', () => {
  it('accepts catalog subsystem keys', () => {
    expect(normalizeLibraryObjectKey(['05-Chassis-CAD', 'UGV_Beast_PT_AI_Kit_STEP.zip'])).toBe(
      '05-Chassis-CAD/UGV_Beast_PT_AI_Kit_STEP.zip',
    );
  });

  it('strips an accidental beast/ prefix', () => {
    expect(normalizeLibraryObjectKey(['beast', '02-Driver-Board', 'x.pdf'])).toBe(
      '02-Driver-Board/x.pdf',
    );
  });

  it('rejects path traversal and unknown roots', () => {
    expect(normalizeLibraryObjectKey(['05-Chassis-CAD', '..', 'secret'])).toBeNull();
    expect(normalizeLibraryObjectKey(['not-a-subsystem', 'x.pdf'])).toBeNull();
    expect(normalizeLibraryObjectKey([])).toBeNull();
  });

  it('decodes URI components', () => {
    expect(normalizeLibraryObjectKey(['05-Chassis-CAD', 'UGV%20Beast.step'])).toBe(
      '05-Chassis-CAD/UGV Beast.step',
    );
  });
});
