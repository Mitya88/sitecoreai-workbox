// ---------------------------------------------------------------------------
// WorkflowBoard — the full Kanban board for a selected workflow
//
// Renders one BoardColumn per workflow state in a horizontal scroll layout.
// Handles drop events by executing workflow commands via the service.
// Shows a command picker dialog when needed and toast notifications.
// ---------------------------------------------------------------------------

"use client";

import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import type {
  GqlWorkflow,
  GqlWorkItem,
  GqlWorkflowCommand,
  GqlSite,
} from "@/lib/api/graphql-types";
import type { WorkflowService } from "@/lib/api/workflow-service";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { BoardDndProvider } from "./board-dnd-context";
import { BoardColumn } from "./board-column";
import { ItemDetailDrawer } from "./item-detail-drawer";
import {
  CommandDialog,
  type CommandDialogPayload,
  type CommandDialogResult,
} from "./command-dialog";

// ── Props ───────────────────────────────────────────────────────────────────

interface WorkflowBoardProps {
  workflow: GqlWorkflow;
  workflowService: WorkflowService;
  selectedSite: GqlSite | null;
}

const BULK_COMMAND_BATCH_SIZE = 50;

interface BulkFailureDetail {
  itemName: string;
  reason: string;
}

interface BulkProgressState {
  status: "running" | "complete";
  commandName: string;
  sourceStateDisplayName: string;
  total: number;
  processed: number;
  succeeded: number;
  failed: number;
  batchIndex: number;
  batchCount: number;
  failureDetails: BulkFailureDetail[];
}

// ── Component ───────────────────────────────────────────────────────────────

export function WorkflowBoard({
  workflow,
  workflowService,
  selectedSite,
}: WorkflowBoardProps) {
  const [refreshKey, setRefreshKey] = useState(0);

  // ── Item detail drawer state ───────────────────────────────────────────
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [selectedItemLang, setSelectedItemLang] = useState<string | null>(null);

  const handleItemClick = useCallback((item: GqlWorkItem) => {
    setSelectedItemId(item.itemId);
    setSelectedItemLang(item.language.name);
    setDrawerOpen(true);
  }, []);

  // ── Command dialog state ───────────────────────────────────────────────
  const [commandDialogOpen, setCommandDialogOpen] = useState(false);
  const [commandPayload, setCommandPayload] =
    useState<CommandDialogPayload | null>(null);
  const [bulkProgress, setBulkProgress] =
    useState<BulkProgressState | null>(null);

  // Pre-build a map of stateId → displayName for quick lookup
  const stateDisplayNames = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of workflow.states.nodes) {
      map.set(s.stateId, s.displayName);
    }
    return map;
  }, [workflow.states.nodes]);

  // ── Execute a workflow command (shared logic) ──────────────────────────

  const executeCommand = useCallback(
    async (
      item: GqlWorkItem,
      command: GqlWorkflowCommand,
      comments: string
    ) => {
      const itemLabel = item.displayName || item.name;
      try {
        const result = await workflowService.executeWorkflowCommand({
          commandId: command.commandId,
          itemId: item.itemId,
          language: item.language.name,
          comments,
        });

        if (result.successful) {
          setRefreshKey((k) => k + 1);
          toast.success(`"${itemLabel}" — ${command.displayName}`, {
            description: result.message || "Command executed successfully.",
          });
        } else {
          toast.error(`Failed: "${itemLabel}"`, {
            description: result.error || "The workflow command was not successful.",
          });
        }
      } catch (err) {
        console.error("[Board] Failed to execute command:", err);
        toast.error(`Error executing "${command.displayName}"`, {
          description:
            err instanceof Error ? err.message : "An unexpected error occurred.",
        });
      }
    },
    [workflowService]
  );

  const executeBulkCommand = useCallback(
    async (
      items: GqlWorkItem[],
      sourceStateId: string,
      command: GqlWorkflowCommand
    ) => {
      const sourceStateDisplayName =
        stateDisplayNames.get(sourceStateId) ?? sourceStateId;

      if (items.length === 0) {
        toast.info("No items to move", {
          description: `${sourceStateDisplayName} does not contain any items.`,
        });
        return;
      }

      const batches = chunkItems(items, BULK_COMMAND_BATCH_SIZE);
      let processed = 0;
      let succeeded = 0;
      let failed = 0;
      const failureDetails: BulkFailureDetail[] = [];

      setBulkProgress({
        status: "running",
        commandName: command.displayName,
        sourceStateDisplayName,
        total: items.length,
        processed,
        succeeded,
        failed,
        batchIndex: 0,
        batchCount: batches.length,
        failureDetails,
      });

      for (let index = 0; index < batches.length; index++) {
        const batch = batches[index];
        const results = await Promise.allSettled(
          batch.map((item) =>
            workflowService.executeWorkflowCommand({
              commandId: command.commandId,
              itemId: item.itemId,
              language: item.language.name,
            })
          )
        );

        results.forEach((result, resultIndex) => {
          const item = batch[resultIndex];
          const itemName = item.displayName || item.name;

          if (result.status === "rejected") {
            failureDetails.push({
              itemName,
              reason:
                result.reason instanceof Error
                  ? result.reason.message
                  : String(result.reason),
            });
          } else if (!result.value.successful) {
            failureDetails.push({
              itemName,
              reason:
                result.value.error ??
                result.value.message ??
                "Command was not successful.",
            });
          }
        });

        const batchSucceeded = results.filter(
          (result) => result.status === "fulfilled" && result.value.successful
        ).length;

        succeeded += batchSucceeded;
        failed += results.length - batchSucceeded;
        processed += batch.length;

        setBulkProgress({
          status: "running",
          commandName: command.displayName,
          sourceStateDisplayName,
          total: items.length,
          processed,
          succeeded,
          failed,
          batchIndex: index + 1,
          batchCount: batches.length,
          failureDetails: [...failureDetails],
        });
      }

      setRefreshKey((k) => k + 1);

      setBulkProgress({
        status: "complete",
        commandName: command.displayName,
        sourceStateDisplayName,
        total: items.length,
        processed,
        succeeded,
        failed,
        batchIndex: batches.length,
        batchCount: batches.length,
        failureDetails: [...failureDetails],
      });
    },
    [stateDisplayNames, workflowService]
  );

  // ── Handle drop: either execute directly or open command dialog ────────

  const handleDrop = useCallback(
    (
      item: GqlWorkItem,
      sourceStateId: string,
      targetStateId: string,
      commands: GqlWorkflowCommand[]
    ) => {
      if (sourceStateId === targetStateId) return;
      if (commands.length === 0) {
        toast.warning("No commands available", {
          description: "This item cannot be moved to the target state.",
        });
        return;
      }

      // Fast path: single command with suppressComments → execute immediately
      if (commands.length === 1 && commands[0].suppressComments) {
        executeCommand(item, commands[0], "");
        return;
      }

      // Otherwise open the command dialog
      setCommandPayload({
        item,
        sourceStateId,
        sourceStateDisplayName:
          stateDisplayNames.get(sourceStateId) ?? sourceStateId,
        targetStateId,
        targetStateDisplayName:
          stateDisplayNames.get(targetStateId) ?? targetStateId,
        commands,
      });
      setCommandDialogOpen(true);
    },
    [executeCommand, stateDisplayNames]
  );

  // ── Handle dialog confirmation ─────────────────────────────────────────

  const handleCommandConfirm = useCallback(
    async (result: CommandDialogResult) => {
      if (!commandPayload) return;

      await executeCommand(
        commandPayload.item,
        result.command,
        result.comments
      );

      setCommandDialogOpen(false);
      setCommandPayload(null);
    },
    [commandPayload, executeCommand]
  );

  // ── Determine grid sizing based on number of states ───────────────────

  const stateCount = workflow.states.nodes.length;

const gridClass = {
  1: "grid grid-cols-1 gap-4",
  2: "grid grid-cols-2 gap-4",
  3: "grid grid-cols-3 gap-4",
  4: "grid grid-cols-4 gap-4",
}[stateCount] || "flex gap-4 overflow-x-auto pb-4";

  return (
    <BoardDndProvider>
      <div className={gridClass}>
        {workflow.states.nodes.map((state) => (
          <BoardColumn
            key={`${state.stateId}-${refreshKey}`}
            workflowId={workflow.workflowId}
            state={state}
            workflowService={workflowService}
            selectedSite={selectedSite}
            onDrop={handleDrop}
            onBulkCommand={executeBulkCommand}
            onItemClick={handleItemClick}
          />
        ))}
      </div>

      <ItemDetailDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        itemId={selectedItemId}
        language={selectedItemLang}
        workflowService={workflowService}
      />

      <CommandDialog
        payload={commandPayload}
        open={commandDialogOpen}
        onOpenChange={(open) => {
          setCommandDialogOpen(open);
          if (!open) setCommandPayload(null);
        }}
        onConfirm={handleCommandConfirm}
      />

      <BulkProgressDialog
        progress={bulkProgress}
        onClose={() => setBulkProgress(null)}
      />
    </BoardDndProvider>
  );
}

function chunkItems(items: GqlWorkItem[], size: number) {
  const chunks: GqlWorkItem[][] = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
}

function BulkProgressDialog({
  progress,
  onClose,
}: {
  progress: BulkProgressState | null;
  onClose: () => void;
}) {
  const isRunning = progress?.status === "running";
  const percent = progress
    ? Math.round((progress.processed / progress.total) * 100)
    : 0;

  return (
    <Dialog
      open={progress !== null}
      onOpenChange={(open) => {
        if (!open && !isRunning) onClose();
      }}
    >
      <DialogContent showCloseButton={!isRunning} className="sm:max-w-[520px]">
        {progress && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {isRunning ? (
                  <Loader2 className="size-5 animate-spin text-primary" />
                ) : progress.failed > 0 ? (
                  <AlertCircle className="size-5 text-destructive" />
                ) : (
                  <CheckCircle2 className="size-5 text-success" />
                )}
                {progress.commandName} all items
              </DialogTitle>
              <DialogDescription>
                Moving items from {progress.sourceStateDisplayName} in batches of {BULK_COMMAND_BATCH_SIZE}.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{percent}% complete</span>
                  <span className="text-subtle-text">
                    {progress.processed} of {progress.total}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-subtle-bg">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${percent}%` }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 text-sm">
                <div className="rounded-md border p-3">
                  <div className="text-xs text-subtle-text">Succeeded</div>
                  <div className="text-lg font-semibold text-success">
                    {progress.succeeded}
                  </div>
                </div>
                <div className="rounded-md border p-3">
                  <div className="text-xs text-subtle-text">Failed</div>
                  <div className="text-lg font-semibold text-destructive">
                    {progress.failed}
                  </div>
                </div>
                <div className="rounded-md border p-3">
                  <div className="text-xs text-subtle-text">Batch</div>
                  <div className="text-lg font-semibold">
                    {progress.batchIndex}/{progress.batchCount}
                  </div>
                </div>
              </div>

              {progress.failureDetails.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-destructive">
                    Failed items ({progress.failureDetails.length})
                  </p>
                  <div className="max-h-40 overflow-y-auto rounded-md border border-destructive/20 bg-destructive/5 divide-y divide-destructive/10">
                    {progress.failureDetails.map((detail, i) => (
                      <div key={i} className="px-3 py-2 text-xs">
                        <span className="font-medium">{detail.itemName}</span>
                        <span className="text-subtle-text"> — </span>
                        <span className="text-destructive">{detail.reason}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {!isRunning && (
              <DialogFooter>
                <Button onClick={onClose}>Close</Button>
              </DialogFooter>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
