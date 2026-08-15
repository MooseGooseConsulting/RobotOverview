import { tool, type ToolSet } from 'ai';
import {
  backUpSchema,
  driveOnHeadingSchema,
  emptyToolSchema,
  spinSchema,
} from './schemas';
import { gateMotionIntent, statusLockReason } from './motion-gate';
import type { BeastRobotBridge } from './types';

/** Tool names that require human-in-the-loop approval before execute. */
export const MOTION_TOOL_NAMES = ['drive_on_heading', 'spin', 'back_up'] as const;

/** Tool names that never require approval. */
export const NO_APPROVAL_TOOL_NAMES = ['get_status', 'stop'] as const;

export function createAgentTools(bridge: BeastRobotBridge): ToolSet {
  return {
    get_status: tool({
      description:
        'Read BEAST-01 safety/telemetry snapshot: allow_motion, voltage, scan-alive, bridge connection. Call this before proposing motion.',
      inputSchema: emptyToolSchema,
      execute: async () => {
        const status = await bridge.getStatus();
        return {
          ...status,
          motionGated: status.allowMotion !== true,
          lockReason: statusLockReason(status),
        };
      },
    }),

    stop: tool({
      description:
        'Cancel active nav2 behavior goals (DriveOnHeading / Spin / BackUp). Always allowed; does not require approval.',
      inputSchema: emptyToolSchema,
      execute: async () => bridge.stop(),
    }),

    drive_on_heading: tool({
      description:
        'Drive forward a short distance at crawl speed via nav2 DriveOnHeading. Requires operator approval. Refuses when allow_motion is not true.',
      inputSchema: driveOnHeadingSchema,
      needsApproval: true,
      execute: async (input) => {
        const status = await bridge.getStatus();
        const gated = gateMotionIntent(status);
        if (gated) return gated;
        return bridge.driveOnHeading(input);
      },
    }),

    spin: tool({
      description:
        'Rotate in place by degrees via nav2 Spin. Requires operator approval. Refuses when allow_motion is not true.',
      inputSchema: spinSchema,
      needsApproval: true,
      execute: async (input) => {
        const status = await bridge.getStatus();
        const gated = gateMotionIntent(status);
        if (gated) return gated;
        return bridge.spin(input);
      },
    }),

    back_up: tool({
      description:
        'Reverse a short distance via nav2 BackUp. Requires operator approval. Refuses when allow_motion is not true.',
      inputSchema: backUpSchema,
      needsApproval: true,
      execute: async (input) => {
        const status = await bridge.getStatus();
        const gated = gateMotionIntent(status);
        if (gated) return gated;
        return bridge.backUp(input);
      },
    }),
  } satisfies ToolSet;
}

export function toolNeedsApproval(toolName: string, tools: ToolSet = createAgentTools(noopBridge())): boolean {
  const t = tools[toolName];
  if (!t || !('needsApproval' in t)) return false;
  return t.needsApproval === true;
}

/** Minimal bridge for metadata-only helpers (approval flags) in tests. */
function noopBridge(): BeastRobotBridge {
  const blank = async () => ({
    ok: false as const,
    status: 'bridge_unavailable' as const,
    message: 'noop',
  });
  return {
    getConnectionState: () => 'unconfigured',
    getStatus: async () => ({
      connection: 'unconfigured',
      bridgeUrl: null,
      allowMotion: null,
      voltage: null,
      scanAlive: null,
      lockReason: 'noop',
      updatedAt: null,
    }),
    driveOnHeading: blank,
    spin: blank,
    backUp: blank,
    navigateToPose: blank,
    stop: blank,
  };
}
