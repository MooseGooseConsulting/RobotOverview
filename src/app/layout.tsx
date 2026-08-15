import type { Metadata } from 'next';
import { JetBrains_Mono, Inter, Outfit } from 'next/font/google';
import './globals.css';
import { HangarProvider } from '@/components/HangarProvider';
import { HangarDown } from '@/components/HangarDown';
import { Shell } from '@/components/Shell';
import { getHangarSpine } from '@/server/hangar/spine';
import { normalizeLibraryBaseUrl } from '@/lib/documents';

const jetbrainsMono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-jetbrains-mono' });
const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const outfit = Outfit({ subsets: ['latin'], variable: '--font-outfit' });

export const metadata: Metadata = {
  title: 'The Hangar',
  description: 'Fleet command for Patrick MacLyman. Every rig, radio, and acquisition — racked, statused, and mission-assigned.',
};

export const dynamic = 'force-dynamic';

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const spine = await getHangarSpine();
  const spineReadStatus =
    spine.source === 'postgres'
      ? { source: 'postgres' as const }
      : {
          source: 'unavailable' as const,
          fallbackReason: spine.fallbackReason,
        };
  const libraryBaseUrl = normalizeLibraryBaseUrl(process.env.DATACORE_LIBRARY_URL);

  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable} ${outfit.variable}`}>
      <body>
        {spine.source === 'unavailable' ? (
          <HangarDown reason={spine.fallbackReason} />
        ) : (
          <HangarProvider
            initialData={spine.data}
            initialSpineRead={spineReadStatus}
            initialLibraryBaseUrl={libraryBaseUrl}
          >
            <Shell>{children}</Shell>
          </HangarProvider>
        )}
        <div className="crt-overlay" aria-hidden />
      </body>
    </html>
  );
}
