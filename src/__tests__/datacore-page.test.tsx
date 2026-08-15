import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DatacoreClient } from '@/app/datacore/DatacoreClient';
import type { DatacoreBriefingRow, DatacorePack } from '@/lib/datacore-model';
import { HangarProvider } from '@/lib/store';

const FIXTURE_PACKS: DatacorePack[] = [
  {
    id: 'beast-vision',
    title: 'Beast Vision & Capture',
    code: 'RND-BEAST-VISION',
    summary:
      'Non-definitive research pack: offline splat architecture, servo-head camera candidate, killed paths, open LiDAR choice, and the method post-mortem.',
    hubBriefingId: 'beast-vision',
    topics: ['vision', 'splat', 'arducam', 'livox'],
  },
];

const FIXTURE_BRIEFINGS: DatacoreBriefingRow[] = [
  {
    id: 'compute-workload',
    title: 'Compute Workload Sizing — Orin NX vs AGX Orin',
    href: '/datacore/briefing/compute-workload',
    source: '',
    kind: 'research',
    summary: 'How engineers formally represent the workload that leads to Orin NX versus AGX Orin.',
    tags: ['compute', 'jetson', 'orin', 'sizing'],
    aliases: ['tops', 'agx', 'orin nx', 'workload'],
    capturedAt: '2026-07-23',
    bodyMarkdown: '# Compute Workload\n',
    repoPath: null,
  },
  {
    id: 'beast-vision',
    title: 'Beast Vision and Capture — Research Index',
    href: '/datacore/briefing/beast-vision',
    source: '',
    kind: 'research',
    summary: 'Research index for the vision pack.',
    tags: ['vision', 'beast', 'research'],
    aliases: ['rnd-beast-vision'],
    packId: 'beast-vision',
    capturedAt: '2026-07-28',
    bodyMarkdown: '# Beast Vision\n',
    repoPath: null,
  },
  {
    id: 'beast-servo-camera',
    title: 'Servo-Head Camera — Research Candidate',
    href: '/datacore/briefing/beast-servo-camera',
    source: '',
    kind: 'research',
    summary: 'Arducam B0497 IMX678 candidate.',
    tags: ['vision', 'beast', 'camera'],
    aliases: ['arducam', 'imx678', 'b0497'],
    packId: 'beast-vision',
    capturedAt: '2026-07-28',
    bodyMarkdown: '# Servo Camera\n',
    repoPath: null,
  },
  {
    id: 'beast-lidar-open',
    title: 'LiDAR Upgrade — Still Open',
    href: '/datacore/briefing/beast-lidar-open',
    source: '',
    kind: 'research',
    summary: 'Livox Mid-360S vs RoboSense Airy 96.',
    tags: ['vision', 'beast', 'lidar'],
    aliases: ['livox', 'mid-360', 'airy'],
    packId: 'beast-vision',
    capturedAt: '2026-07-28',
    bodyMarkdown: '# LiDAR\n',
    repoPath: null,
  },
];

function renderDatacore() {
  return render(
    <HangarProvider>
      <DatacoreClient
        briefings={FIXTURE_BRIEFINGS}
        packs={FIXTURE_PACKS}
        briefingsSource="postgres"
        packsSource="postgres"
      />
    </HangarProvider>,
  );
}

describe('Datacore page', () => {
  it('uses shared insight confidence labels in the filter', () => {
    renderDatacore();

    expect(screen.getByRole('option', { name: 'High' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Medium' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Low' })).toBeInTheDocument();
  });

  it('uses shared insight confidence classes on insight chips', () => {
    renderDatacore();

    const highChip = screen.getAllByText('high').find((node) => node.classList.contains('chip'));
    expect(highChip).toHaveClass(
      'chip',
      'border-signal-ok/40',
      'bg-signal-ok/10',
      'text-signal-ok',
    );
  });

  it('surfaces research briefings including compute-workload', () => {
    renderDatacore();

    expect(screen.getByRole('heading', { name: 'Datacore' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Compute Workload Sizing/i })).toHaveAttribute(
      'href',
      '/datacore/briefing/compute-workload',
    );
  });

  it('clusters Beast Vision as a findable research pack', () => {
    renderDatacore();

    expect(screen.getByRole('heading', { name: /Beast Vision & Capture/i })).toBeInTheDocument();
    expect(screen.getByText(/RND-BEAST-VISION/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Open index/i })).toHaveAttribute(
      'href',
      '/datacore/briefing/beast-vision',
    );
  });

  it('finds the vision pack via product aliases like arducam and livox', () => {
    renderDatacore();

    const search = screen.getByPlaceholderText(/Search: splat, arducam/i);
    fireEvent.change(search, { target: { value: 'arducam' } });
    expect(screen.getByRole('heading', { name: /Beast Vision & Capture/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Servo-Head Camera/i })).toBeInTheDocument();

    fireEvent.change(search, { target: { value: 'livox' } });
    expect(screen.getByRole('heading', { name: /Beast Vision & Capture/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /LiDAR Upgrade/i })).toBeInTheDocument();
  });

  it('switches to the Hardware Library tab and lists documents linking to detail pages', () => {
    renderDatacore();

    fireEvent.click(screen.getByRole('button', { name: /Hardware Library/i }));

    // A known seeded document surfaces, linking to its detail route.
    const link = screen.getByRole('link', { name: /General Driver for Robots — Schematic/i });
    expect(link).toHaveAttribute('href', '/datacore/doc-gdb-schematic');

    // The knowledge-only confidence filter is not shown on the library tab.
    expect(screen.queryByRole('option', { name: 'High' })).not.toBeInTheDocument();
  });

  it('shows DATACORE OFFLINE banner and hides packs when both lanes are unavailable', () => {
    render(
      <HangarProvider>
        <DatacoreClient briefings={[]} packs={[]} briefingsSource="unavailable" packsSource="unavailable" />
      </HangarProvider>,
    );

    expect(screen.getByText('DATACORE OFFLINE')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /Beast Vision & Capture/i })).not.toBeInTheDocument();
    expect(screen.getByText(/Research packs & briefs unavailable/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /\d+ insights?/i })).toBeInTheDocument();
  });

  it('unavailable lanes with fixture corpus still render packs under OFFLINE banner', () => {
    render(
      <HangarProvider>
        <DatacoreClient
          briefings={FIXTURE_BRIEFINGS}
          packs={FIXTURE_PACKS}
          briefingsSource="unavailable"
          packsSource="unavailable"
        />
      </HangarProvider>,
    );

    expect(screen.getByText('DATACORE OFFLINE')).toBeInTheDocument();
    expect(screen.getByText(/serving static research fixture/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Beast Vision & Capture/i })).toBeInTheDocument();
    expect(screen.queryByText(/Research packs & briefs unavailable/i)).not.toBeInTheDocument();
  });

  it('degrades per lane: briefings offline still renders packs', () => {
    render(
      <HangarProvider>
        <DatacoreClient
          briefings={[]}
          briefingsSource="unavailable"
          packs={FIXTURE_PACKS}
          packsSource="postgres"
        />
      </HangarProvider>,
    );

    expect(screen.getByText('DATACORE DEGRADED')).toBeInTheDocument();
    expect(screen.getByText(/Briefings lane static/i)).toBeInTheDocument();
  });
});
