// ---------------------------------------------------------------------------
// CommandDialog — pick a workflow command + optional comment
//
// Shown when a card is dropped on a target column. If there's only one
// command available AND it has suppressComments: true, we skip the dialog and
// execute directly. Otherwise:
//  - Multiple commands → let the user pick one
//  - suppressComments: false → show a comment textarea
// ---------------------------------------------------------------------------

"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Loader2, ArrowRight, MessageSquare } from "lucide-react";
import type {
  GqlWorkItem,
  GqlWorkflowCommand,
} from "@/lib/api/graphql-types";

// ── Types ───────────────────────────────────────────────────────────────────

export interface CommandDialogPayload {
  item: GqlWorkItem;
  sourceStateId: string;
  sourceStateDisplayName: string;
  targetStateId: string;
  targetStateDisplayName: string;
  commands: GqlWorkflowCommand[];
}

export interface CommandDialogResult {
  command: GqlWorkflowCommand;
  comments: string;
}

interface CommandDialogProps {
  payload: CommandDialogPayload | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (result: CommandDialogResult) => void;
}

// ── Component ───────────────────────────────────────────────────────────────

export function CommandDialog({
  payload,
  open,
  onOpenChange,
  onConfirm,
}: CommandDialogProps) {
  const [selectedCommand, setSelectedCommand] =
    useState<GqlWorkflowCommand | null>(null);
  const [comments, setComments] = useState("");
  const [executing, setExecuting] = useState(false);

  // Auto-select if only one command
  useEffect(() => {
    if (payload?.commands.length === 1) {
      setSelectedCommand(payload.commands[0]);
    } else {
      setSelectedCommand(null);
    }
    setComments("");
    setExecuting(false);
  }, [payload]);

  const needsComment = selectedCommand
    ? !selectedCommand.suppressComments
    : false;

  const handleConfirm = useCallback(() => {
    if (!selectedCommand) return;
    setExecuting(true);
    onConfirm({ command: selectedCommand, comments });
  }, [selectedCommand, comments, onConfirm]);

  if (!payload) return null;

  const { item, sourceStateDisplayName, targetStateDisplayName, commands } =
    payload;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Execute Workflow Command
          </DialogTitle>
          <DialogDescription>
            Move{" "}
            <span className="font-semibold text-foreground">
              {item.displayName || item.name}
            </span>{" "}
            from{" "}
            <Badge size="sm" colorScheme="neutral">
              {sourceStateDisplayName}
            </Badge>{" "}
            to{" "}
            <Badge size="sm" colorScheme="primary">
              {targetStateDisplayName}
            </Badge>
          </DialogDescription>
        </DialogHeader>

        {/* ── Command selection (shown when multiple) ────────────── */}
        {commands.length > 1 && (
          <div className="space-y-2">
            <label className="text-sm font-medium">Choose a command</label>
            <div className="space-y-1.5">
              {commands.map((cmd) => (
                <button
                  key={cmd.commandId}
                  type="button"
                  onClick={() => setSelectedCommand(cmd)}
                  className={cn(
                    "w-full text-left rounded-lg border px-3 py-2.5 text-sm transition-colors",
                    "hover:bg-subtle-bg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    selectedCommand?.commandId === cmd.commandId
                      ? "border-primary bg-primary/5 ring-1 ring-primary"
                      : "border-border"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{cmd.displayName}</span>
                    <div className="flex items-center gap-1.5">
                      {!cmd.suppressComments && (
                        <MessageSquare className="size-3.5 text-subtle-text" />
                      )}
                      <ArrowRight className="size-3.5 text-subtle-text" />
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Single command display ─────────────────────────────── */}
        {commands.length === 1 && (
          <div className="rounded-lg border bg-subtle-bg px-3 py-2.5">
            <div className="flex items-center gap-2 text-sm">
              <ArrowRight className="size-3.5 text-subtle-text" />
              <span className="font-medium">
                {commands[0].displayName}
              </span>
            </div>
          </div>
        )}

        {/* ── Comment textarea (shown when command requires it) ─── */}
        {selectedCommand && needsComment && (
          <div className="space-y-2">
            <label htmlFor="workflow-comment" className="text-sm font-medium">
              Comment
            </label>
            <textarea
              id="workflow-comment"
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              placeholder="Enter a comment for this workflow transition…"
              className={cn(
                "w-full rounded-lg border border-border bg-body-bg px-3 py-2 text-sm",
                "placeholder:text-muted-foreground",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                "min-h-[80px] resize-y"
              )}
            />
          </div>
        )}

        {/* ── Footer ─────────────────────────────────────────────── */}
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={executing}
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!selectedCommand || executing}
          >
            {executing ? (
              <>
                <Loader2 className="size-4 animate-spin mr-1.5" />
                Executing…
              </>
            ) : (
              <>
                Execute
                {selectedCommand && (
                  <span className="ml-1.5 opacity-70">
                    "{selectedCommand.displayName}"
                  </span>
                )}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
