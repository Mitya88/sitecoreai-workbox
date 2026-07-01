// ---------------------------------------------------------------------------
// BoardColumn — one state column in the Kanban board
//
// Renders a header (state name + count), a scrollable list of WorkItemCards,
// and acts as an HTML5 DnD drop target. Highlights when it's a valid target
// for the currently-dragged item.
// ---------------------------------------------------------------------------

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  GqlWorkItem,
  GqlWorkflowCommand,
  GqlWorkflowState,
  GqlPageInfo,
  GqlSite,
} from "@/lib/api/graphql-types";
import type { WorkflowService } from "@/lib/api/workflow-service";
import { WorkItemCard } from "./work-item-card";
import { useBoardDnd } from "./board-dnd-context";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { itemBelongsToSite } from "@/lib/site-utils";
import { Loader2, MoreVertical } from "lucide-react";
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';

// ── Props ───────────────────────────────────────────────────────────────────

interface BoardColumnProps {
  workflowId: string;
  state: GqlWorkflowState;
  workflowService: WorkflowService;
  selectedSite: GqlSite | null;
  /** ISO name of the selected language filter (e.g. "en", "fr-FR") or null for all */
  selectedLanguage: string | null;
  /** Callback when a drop occurs on this column */
  onDrop: (
    item: GqlWorkItem,
    sourceStateId: string,
    targetStateId: string,
    commands: GqlWorkflowCommand[]
  ) => void;
  /** Callback when a bulk command is requested for this column */
  onBulkCommand: (
    items: GqlWorkItem[],
    sourceStateId: string,
    command: GqlWorkflowCommand
  ) => Promise<void>;
  /** Callback when a card is clicked */
  onItemClick?: (item: GqlWorkItem) => void;
}

// ── Component ───────────────────────────────────────────────────────────────

export function BoardColumn({
  workflowId,
  state,
  workflowService,
  selectedSite,
  selectedLanguage,
  onDrop,
  onBulkCommand,
  onItemClick,
}: BoardColumnProps) {
  const {
    dragPayload,
    validTargetStateIds,
    commandsByState,
    setCommandsForState,
    endDrag,
  } = useBoardDnd();

  // ── State ───────────────────────────────────────────────────────────────
  const [items, setItems] = useState<GqlWorkItem[]>([]);
  const [itemsCount, setItemsCount] = useState<number>(0);
  const [pageInfo, setPageInfo] = useState<GqlPageInfo>({
    hasNextPage: false,
    endCursor: null,
  });
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [bulkCommandId, setBulkCommandId] = useState<string | null>(null);

  const columnRef = useRef<HTMLDivElement>(null);

  // Is this column a valid drop target right now?
  const isDragging = dragPayload !== null;
  const isValidTarget = validTargetStateIds.has(state.stateId);
  const isSource = dragPayload?.sourceStateId === state.stateId;
  // Exclude system commands (prefixed with "_") from bulk action buttons
  const commands = (commandsByState.get(state.stateId) ?? []).filter(
    (cmd) => !cmd.displayName.startsWith("_")
  );

  const filterItemsForSite = useCallback(
    (nextItems: GqlWorkItem[]) => {
      if (!selectedSite) return nextItems;
      return nextItems.filter((item) => itemBelongsToSite(item, selectedSite));
    },
    [selectedSite]
  );

  const filterItemsForLanguage = useCallback(
    (nextItems: GqlWorkItem[]) => {
      if (!selectedLanguage) return nextItems;
      return nextItems.filter(
        (item) => item.language.name === selectedLanguage
      );
    },
    [selectedLanguage]
  );

  // When any client-side filter is active we cannot rely on server pagination
  // (the server only paginates unfiltered results), so fetch everything and
  // filter locally.
  const hasClientFilter = selectedSite !== null || selectedLanguage !== null;

  const getAllItemsForState = useCallback(async () => {
    const allItems: GqlWorkItem[] = [];
    let cursor: string | undefined;
    let hasNextPage = true;

    while (hasNextPage) {
      const result = await workflowService.getWorkflowBoard(
        workflowId,
        state.stateId,
        50,
        cursor
      );

      allItems.push(...result.items);
      hasNextPage = result.pageInfo.hasNextPage;
      cursor = result.pageInfo.endCursor ?? undefined;
    }

    return allItems;
  }, [workflowService, workflowId, state.stateId]);

  // ── Fetch items for this state ──────────────────────────────────────────

  const fetchItems = useCallback(
    async (after?: string) => {
      if (after) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }

      try {
        if (hasClientFilter && !after) {
          const allItems = await getAllItemsForState();
          const filteredItems = filterItemsForLanguage(
            filterItemsForSite(allItems)
          );

          setItems(filteredItems);
          setItemsCount(filteredItems.length);
          setPageInfo({ hasNextPage: false, endCursor: null });
          return;
        }

        const result = await workflowService.getWorkflowBoard(
          workflowId,
          state.stateId,
          50,
          after || undefined
        );

        setItems((prev) => (after ? [...prev, ...result.items] : result.items));
        setItemsCount(result.itemsCount);
        setPageInfo(result.pageInfo);
      } catch (err) {
        console.error(
          `Failed to load items for state ${state.displayName}:`,
          err
        );
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [
      hasClientFilter,
      filterItemsForSite,
      filterItemsForLanguage,
      workflowService,
      workflowId,
      state.stateId,
      state.displayName,
      getAllItemsForState,
    ]
  );

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  // ── Fetch commands for this state ───────────────────────────────────────

  useEffect(() => {
    async function loadCommands() {
      try {
        const cmds = await workflowService.getCommandsForState(
          workflowId,
          state.stateId
        );
        setCommandsForState(state.stateId, cmds);
      } catch (err) {
        console.error(
          `Failed to load commands for state ${state.displayName}:`,
          err
        );
      }
    }

    loadCommands();
  }, [
    workflowService,
    workflowId,
    state.stateId,
    state.displayName,
    setCommandsForState,
  ]);

  // ── HTML5 DnD drop target handlers ────────────────────────────────────

  function handleDragOver(e: React.DragEvent) {
    if (!isValidTarget) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOver(true);
  }

  function handleDragEnter(e: React.DragEvent) {
    if (!isValidTarget) return;
    e.preventDefault();
    setDragOver(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    // Only deactivate when leaving the column entirely
    if (
      columnRef.current &&
      !columnRef.current.contains(e.relatedTarget as Node)
    ) {
      setDragOver(false);
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);

    if (!dragPayload || !isValidTarget) return;

    const allCommands = commandsByState.get(dragPayload.sourceStateId) ?? [];
    // Only pass commands whose nextStateId matches this column's state
    const targetCommands = allCommands.filter(
      (cmd) => cmd.nextStateId === state.stateId
    );
    onDrop(dragPayload.item, dragPayload.sourceStateId, state.stateId, targetCommands);
    endDrag();
  }

  async function handleBulkCommand(command: GqlWorkflowCommand) {
    setBulkCommandId(command.commandId);

    try {
      const allItems = filterItemsForLanguage(
        filterItemsForSite(await getAllItemsForState())
      );
      await onBulkCommand(allItems, state.stateId, command);
    } finally {
      setBulkCommandId(null);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────

  return (
    <div
      ref={columnRef}
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={cn(
        "flex flex-col rounded-xl border bg-subtle-bg transition-all min-w-[280px]",
        // Drop-target highlighting
        isDragging && isValidTarget && !dragOver && "ring-2 ring-primary/30 border-primary/30",
        isDragging && isValidTarget && dragOver && "ring-2 ring-primary border-primary bg-primary/5",
        isDragging && !isValidTarget && !isSource && "opacity-40",
        isDragging && isSource && "border-warning/40 ring-1 ring-warning/30"
      )}
    >
     {/* ── Column header Alternative ───────────────────────────────── */}
<div className="flex items-center justify-between px-4 py-3 border-b h-12">
  <div className="flex items-center gap-2 min-w-0">
    <h3 className="text-sm font-semibold truncate">{state.displayName}</h3>
    <Badge size="sm" colorScheme="neutral" className="shrink-0">
      {loading ? "…" : itemsCount}
    </Badge>
    {state.final && <Badge size="sm" colorScheme="success">Final</Badge>}
  </div>

  {/* Drodown Menu Button instead of inline buttons */}
  {!loading && commands.length > 0 && itemsCount > 0 && (
  <DropdownMenu.Root>
    <DropdownMenu.Trigger asChild>
      <button className="p-1 rounded hover:bg-neutral-100" aria-label="Custom actions">
        <MoreVertical className="size-4" />
      </button>
    </DropdownMenu.Trigger>

    <DropdownMenu.Portal>
      <DropdownMenu.Content 
        className="bg-white border rounded-md p-1 shadow-md min-w-[160px] z-50" 
        align="end"
      >
        {commands.map((command) => (
          <DropdownMenu.Item 
            key={command.commandId}
            className="text-xs px-2 py-1.5 outline-none cursor-pointer hover:bg-neutral-100 rounded"
            disabled={bulkCommandId !== null}
            onClick={() => handleBulkCommand(command)}
          >
            {command.displayName} (All)
          </DropdownMenu.Item>
        ))}
      </DropdownMenu.Content>
    </DropdownMenu.Portal>
  </DropdownMenu.Root>
)}
</div>

      {/* ── Items area ─────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-[120px] max-h-[calc(100vh-260px)]">
        {loading ? (
          <ColumnSkeleton />
        ) : items.length === 0 ? (
          <div className="flex items-center justify-center h-full min-h-[80px]">
            <p className="text-xs text-subtle-text text-center">
              No items in this state
            </p>
          </div>
        ) : (
          <>
            {items.map((item) => (
              <WorkItemCard
                key={`${item.itemId}-${item.language.name}-${item.version}`}
                item={item}
                stateId={state.stateId}
                onClick={onItemClick}
              />
            ))}

            {/* Load more button */}
            {pageInfo.hasNextPage && (
              <div className="pt-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full"
                  disabled={loadingMore}
                  onClick={() => fetchItems(pageInfo.endCursor ?? undefined)}
                >
                  {loadingMore ? (
                    <>
                      <Loader2 className="size-3 animate-spin mr-1" />
                      Loading…
                    </>
                  ) : (
                    `Load more (${items.length} of ${itemsCount})`
                  )}
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Drop zone indicator ───────────────────────────────────── */}
      {isDragging && isValidTarget && (
        <div
          className={cn(
            "mx-3 mb-3 rounded-md border-2 border-dashed py-3 text-center text-xs font-medium transition-colors",
            dragOver
              ? "border-primary bg-primary/10 text-primary"
              : "border-primary/30 text-subtle-text"
          )}
        >
          Drop here to move to {state.displayName}
        </div>
      )}
    </div>
  );
}

// ── Column loading skeleton ─────────────────────────────────────────────────

function ColumnSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="rounded-lg border bg-body-bg p-3 space-y-2">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-2/3" />
          <Skeleton className="h-3 w-1/2" />
          <div className="flex gap-1 pt-1">
            <Skeleton className="h-4 w-8 rounded" />
            <Skeleton className="h-4 w-8 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}
