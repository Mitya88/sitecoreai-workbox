// ---------------------------------------------------------------------------
// Drag-and-drop types & context for the workflow board
//
// Uses HTML5 DnD API. The context tracks the item being dragged plus
// which column states are valid drop targets (based on workflow commands).
// ---------------------------------------------------------------------------

"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import type { GqlWorkItem, GqlWorkflowCommand } from "@/lib/api/graphql-types";

// ── Types ───────────────────────────────────────────────────────────────────

export interface DragPayload {
  item: GqlWorkItem;
  sourceStateId: string;
}

/** Maps stateId → commands available FROM that state */
export type CommandsByState = Map<string, GqlWorkflowCommand[]>;

export interface BoardDndContextValue {
  /** The item currently being dragged (null when idle) */
  dragPayload: DragPayload | null;

  /** Set of stateIds that are valid drop targets for the current drag */
  validTargetStateIds: Set<string>;

  /** Start a drag — computes valid targets from commands */
  startDrag: (payload: DragPayload) => void;

  /** End drag (drop or cancel) */
  endDrag: () => void;

  /** All commands keyed by state – set by the board when it fetches them */
  commandsByState: CommandsByState;

  /** Register commands for a state */
  setCommandsForState: (stateId: string, commands: GqlWorkflowCommand[]) => void;
}

// ── Context ─────────────────────────────────────────────────────────────────

const BoardDndContext = createContext<BoardDndContextValue | undefined>(
  undefined
);

export function useBoardDnd() {
  const ctx = useContext(BoardDndContext);
  if (!ctx)
    throw new Error("useBoardDnd must be used within BoardDndProvider");
  return ctx;
}

// ── Provider ────────────────────────────────────────────────────────────────

export function BoardDndProvider({ children }: { children: React.ReactNode }) {
  const [dragPayload, setDragPayload] = useState<DragPayload | null>(null);
  const [validTargetStateIds, setValidTargetStateIds] = useState<Set<string>>(
    new Set()
  );
  const [commandsByState, setCommandsByState] = useState<CommandsByState>(
    new Map()
  );

  const setCommandsForState = useCallback(
    (stateId: string, commands: GqlWorkflowCommand[]) => {
      setCommandsByState((prev) => {
        const next = new Map(prev);
        next.set(stateId, commands);
        return next;
      });
    },
    []
  );

  /**
   * When we start dragging an item from `sourceStateId`, determine which
   * other states it can be dropped into by looking at the commands available
   * from the source state. Each command transitions to a *different* state,
   * so every state that has a matching command from the source is a valid target.
   *
   * Computes valid drop targets by reading the `nextStateId` from each
   * command. Only columns whose stateId matches a command's `nextStateId`
   * are highlighted as valid targets.
   */
  const startDrag = useCallback(
    (payload: DragPayload) => {
      setDragPayload(payload);

      const cmds = commandsByState.get(payload.sourceStateId) ?? [];
      const targets = new Set<string>();
      for (const cmd of cmds) {
        if (cmd.nextStateId) {
          targets.add(cmd.nextStateId);
        }
      }


      setValidTargetStateIds(targets);
    },
    [commandsByState]
  );

  const endDrag = useCallback(() => {
    setDragPayload(null);
    setValidTargetStateIds(new Set());
  }, []);

  const value = useMemo<BoardDndContextValue>(
    () => ({
      dragPayload,
      validTargetStateIds,
      startDrag,
      endDrag,
      commandsByState,
      setCommandsForState,
    }),
    [
      dragPayload,
      validTargetStateIds,
      startDrag,
      endDrag,
      commandsByState,
      setCommandsForState,
    ]
  );

  return (
    <BoardDndContext.Provider value={value}>{children}</BoardDndContext.Provider>
  );
}
