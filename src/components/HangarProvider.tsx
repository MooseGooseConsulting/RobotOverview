'use client';
import { HangarProvider as Provider } from '@/lib/store';
import type { HangarData } from '@/data/types';
import type { HangarReadStatus } from '@/lib/hangar-read-status';
import type { ReactNode } from 'react';

export function HangarProvider({
  children,
  initialData,
  initialSpineRead,
  initialLibraryBaseUrl,
}: {
  children: ReactNode;
  initialData?: HangarData;
  initialSpineRead?: HangarReadStatus;
  initialLibraryBaseUrl?: string | null;
}) {
  return (
    <Provider
      initialData={initialData}
      initialSpineRead={initialSpineRead}
      initialLibraryBaseUrl={initialLibraryBaseUrl}
    >
      {children}
    </Provider>
  );
}
