/**
 * Shared Datacore research corpus registry (metadata only).
 * Bodies are resolved from disk/git by gen-datacore-corpus / ingest helpers.
 *
 * Snapshot of the pre-cutover DATACORE_PACKS + DATACORE_BRIEFINGS (plus evidence
 * extra; cad-assets as plan → docs/hardware-library.md).
 */
export type BriefingKind = 'research' | 'plan';

export type CorpusBriefingMeta = {
  id: string;
  title: string;
  href: string;
  /** Repo-relative path the body was (or is) authored from — provenance. */
  source: string;
  kind: BriefingKind;
  summary: string;
  tags: string[];
  aliases?: string[];
  packId?: string;
  capturedAt: string;
};

export type CorpusPackMeta = {
  id: string;
  title: string;
  code: string;
  summary: string;
  hubBriefingId: string;
  topics: string[];
};

export const CORPUS_PACKS: CorpusPackMeta[] = [
  {
    id: 'beast-vision',
    title: 'Beast Vision & Capture',
    code: 'RND-BEAST-VISION',
    summary:
      'Non-definitive research pack: offline splat architecture, servo-head camera candidate, killed paths, open LiDAR choice, and the method post-mortem.',
    hubBriefingId: 'beast-vision',
    topics: [
      'vision',
      'splat',
      'gaussian',
      'colmap',
      'arducam',
      'imx678',
      'livox',
      'mid-360',
      'airy',
      'rejected',
      'thermal',
      'fpv',
    ],
  },
];

export const CORPUS_BRIEFINGS: CorpusBriefingMeta[] = [
  {
    id: 'robot-control-llms',
    title: 'Robot Control LLMs — Hangar Briefing',
    href: '/datacore/briefing/robot-control-llms',
    source: 'content/datacore/robot-control-llms.md',
    kind: 'research',
    summary:
      'Three-lane taxonomy for LLM robot control (orchestrator / VLA / world-action model), Cosmos 3 Edge analysis, Orin Nano fit matrices, and the recommended Hangar progression. Codename RND-ROBOT-LLM; insights persisted in hangar.ts.',
    tags: ['llm', 'vla', 'autonomy', 'orin', 'control', 'research'],
    aliases: ['rnd-robot-llm', 'cosmos', 'world action model', 'orchestrator'],
    capturedAt: '2026-07-22',
  },
  {
    id: 'compute-workload',
    title: 'Compute Workload Sizing — Orin NX vs AGX Orin',
    href: '/datacore/briefing/compute-workload',
    source: 'content/datacore/compute-workload.md',
    kind: 'research',
    summary:
      'How engineers formally represent the workload that leads to Orin NX versus AGX Orin: linked views from requirements through measured runtime — not a single TOPS diagram.',
    tags: ['compute', 'jetson', 'orin', 'sizing'],
    aliases: ['tops', 'agx', 'orin nx', 'workload', 'pipeline'],
    capturedAt: '2026-07-23',
  },
  {
    id: 'artifact-intake',
    title: 'BEAST-01 Source Artifacts — Intake Register',
    href: '/datacore/briefing/artifact-intake',
    source: 'keyArtifactstosort/INTAKE-REGISTER.md',
    kind: 'research',
    summary:
      'Every source artifact verified by hash and opened: what each file actually is, what each image actually depicts, eleven anomalies where the filename lies about the contents, and five things the files cannot establish.',
    tags: ['artifacts', 'beast', 'provenance', 'schematic'],
    aliases: ['keyartifacts', 'hash', 'intake register', 'filename lies'],
    capturedAt: '2026-07-27',
  },
  {
    id: 'wiring-model-completion',
    title: 'Finish the Wiring Model — One Spine, Two Eyes',
    href: '/datacore/briefing/wiring-model-completion',
    source: 'docs/plans/2026-07-30-wiring-model-completion.md',
    kind: 'plan',
    summary:
      'The single wiring work order: close the half-fed spine so The Board and the console project from wiring.ts, extract the corpus (schematics, firmware, photos, CAD), land facts with zone citations, and put operator-critical answers on screen.',
    tags: ['architecture', 'wiring', 'beast', 'schematic', 'cad'],
    aliases: ['join key', 'the board', 'wiring spine', 'netlist', 'grain', 'x1'],
    capturedAt: '2026-07-30',
  },
  {
    id: 'cad-assets',
    title: 'CAD Assets — Where They Live and What They Are For',
    href: '/datacore/briefing/cad-assets',
    source: 'docs/hardware-library.md',
    kind: 'plan',
    summary:
      'Hardware Library hosting: Garage hangar-library + Hangar proxy Open links, N5 off-cluster mirror, CAD naming traps, and the library-manifest existence register. The X1–X6 exploration work moved into the wiring-model plan.',
    tags: ['cad', 'beast', 'mounting', 'jetson'],
    aliases: ['step', 'stl', 'mounting pattern', 'x1'],
    capturedAt: '2026-07-27',
  },
  {
    id: 'beast-vision',
    title: 'Beast Vision and Capture — Research Index',
    href: '/datacore/briefing/beast-vision',
    source: 'artifactIntake/00-MASTER-beast-vision.md',
    kind: 'research',
    summary:
      'Research index (non-definitive): Build A offline splat vs Build B live nav, current open questions, and reading order for the vision pack.',
    tags: ['vision', 'beast', 'research', 'splat', 'camera', 'lidar'],
    aliases: [
      'rnd-beast-vision',
      'build a',
      'build b',
      'gaussian splat',
      '3dgs',
      'appearance capture',
      'stop-and-shoot',
      'servo head',
      'pan-tilt camera',
    ],
    packId: 'beast-vision',
    capturedAt: '2026-07-28',
  },
  {
    id: 'beast-splat-architecture',
    title: 'Splatting Architecture — Images Carry Poses',
    href: '/datacore/briefing/beast-splat-architecture',
    source: 'artifactIntake/01-splatting-architecture.md',
    kind: 'research',
    summary:
      'Research ruling (non-definitive): Architecture B for Build A — COLMAP/SfM poses from parked stop-and-shoot images; LiDAR as geometry enrichment, not pose master.',
    tags: ['vision', 'beast', 'research', 'splat', 'architecture'],
    aliases: [
      'gaussian',
      '3dgs',
      'colmap',
      'sfm',
      'dn-splatter',
      'lidar-gsplat',
      'splatfacto',
      'nerfstudio',
      'architecture a',
      'architecture b',
      'depth supervision',
      'pose',
      'parked capture',
    ],
    packId: 'beast-vision',
    capturedAt: '2026-07-28',
  },
  {
    id: 'beast-servo-camera',
    title: 'Servo-Head Camera — Research Candidate',
    href: '/datacore/briefing/beast-servo-camera',
    source: 'artifactIntake/02-camera-decision.md',
    kind: 'research',
    summary:
      'Research candidate (not purchased): Arducam B0497 IMX678 for the pan-tilt head, pending focus / IR-cut / fps flags. Fixed slot stays owned OAK-D Lite.',
    tags: ['vision', 'beast', 'research', 'camera'],
    aliases: [
      'arducam',
      'b0497',
      'imx678',
      'starvis',
      'imx585',
      'uvc',
      'm12',
      'servo camera',
      'pan tilt',
      'oak-d',
      'rolling shutter',
    ],
    packId: 'beast-vision',
    capturedAt: '2026-07-28',
  },
  {
    id: 'beast-rejected-paths',
    title: 'Vision Paths Rejected — Do Not Re-Propose Blindly',
    href: '/datacore/briefing/beast-rejected-paths',
    source: 'artifactIntake/03-rejected-paths.md',
    kind: 'research',
    summary:
      'Research kill list: FPV chains, Insta360, IP PTZ, thermal, optical zoom, and machine-vision cameras killed under the current premise — read before reopening.',
    tags: ['vision', 'beast', 'research', 'rejected', 'camera'],
    aliases: [
      'killed',
      'kill list',
      'fpv',
      'dji',
      'walksnail',
      'o3',
      'insta360',
      'ptz',
      'thermal',
      'lepton',
      'infiray',
      'zoom',
      'blackfly',
      'lucid',
      'triton',
    ],
    packId: 'beast-vision',
    capturedAt: '2026-07-28',
  },
  {
    id: 'beast-lidar-open',
    title: 'LiDAR Upgrade — Still Open',
    href: '/datacore/briefing/beast-lidar-open',
    source: 'artifactIntake/04-lidar-open-decision.md',
    kind: 'research',
    summary:
      'Open research (not a ruling): Livox Mid-360S vs RoboSense Airy 96, plus unresolved servo-vs-rigid mounting for navigation SLAM.',
    tags: ['vision', 'beast', 'research', 'lidar'],
    aliases: [
      'livox',
      'mid-360',
      'mid360',
      'mid-360s',
      'robosense',
      'airy',
      'airy 96',
      'fast-lio',
      'fast-livo',
      'slam',
      'point rate',
    ],
    packId: 'beast-vision',
    capturedAt: '2026-07-28',
  },
  {
    id: 'beast-research-method',
    title: 'Vision Research Method Post-Mortem',
    href: '/datacore/briefing/beast-research-method',
    source: 'artifactIntake/05-research-method.md',
    kind: 'research',
    summary:
      'How the vision exploration went wrong (spec-sheet queries, self-citation) and which communities actually answer failure modes.',
    tags: ['vision', 'beast', 'research', 'method'],
    aliases: [
      'post-mortem',
      'spec sheet',
      'self-citation',
      'nvidia forums',
      'ros discourse',
      'radiancefields',
      'koide',
      'calibration toolbox',
      'hku-mars',
    ],
    packId: 'beast-vision',
    capturedAt: '2026-07-28',
  },
  {
    id: 'beast-evidence-manifest',
    title: 'BEAST-01 Source Evidence Manifest',
    href: '/datacore/briefing/beast-evidence-manifest',
    source: 'keyArtifactstosort/reference/EVIDENCE-MANIFEST.md',
    kind: 'research',
    summary:
      'Historical SHA256 manifest of BEAST-01 source evidence cached under UGV-Beast-Archive/ on 2026-07-01; verify local cache and upstream before migrating payloads.',
    tags: ['artifacts', 'beast', 'provenance', 'evidence'],
    packId: 'beast-vision',
    capturedAt: '2026-07-27',
  },
];
