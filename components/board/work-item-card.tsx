// ---------------------------------------------------------------------------
// WorkItemCard — a draggable card representing one Sitecore item in a column
// ---------------------------------------------------------------------------

"use client";

import type { GqlWorkItem } from "@/lib/api/graphql-types";
import { formatSitecoreDate } from "@/lib/date-utils";
import { useBoardDnd } from "./board-dnd-context";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { FileText, Globe, Clock, Layers } from "lucide-react";
import type React from "react";

interface WorkItemCardProps {
  item: GqlWorkItem;
  stateId: string;
  onClick?: (item: GqlWorkItem) => void;
}

export function WorkItemCard({ item, stateId, onClick }: WorkItemCardProps) {
  const { startDrag, endDrag, dragPayload } = useBoardDnd();

  const isDragging =
    dragPayload?.item.itemId === item.itemId &&
    dragPayload?.item.language.name === item.language.name;

  // ── HTML5 DnD handlers ────────────────────────────────────────────────

  function handleDragStart(e: React.DragEvent) {
    // Set a transfer payload so drop targets can identify the item
    e.dataTransfer.setData(
      "application/x-workitem",
      JSON.stringify({
        itemId: item.itemId,
        language: item.language.name,
        sourceStateId: stateId,
      })
    );
    e.dataTransfer.effectAllowed = "move";

    // Notify DnD context
    startDrag({ item, sourceStateId: stateId });
  }

  function handleDragEnd() {
    endDrag();
  }

  // ── Derived display values ────────────────────────────────────────────

  const lastUpdated = formatSitecoreDate(item.lastUpdated?.value);
  const lastUpdatedBy = item.lastUpdatedBy?.value ?? "—";

  function handleClick(e: React.MouseEvent) {
    // Don't open drawer if user is selecting text
    if (window.getSelection()?.toString()) return;
    onClick?.(item);
  }

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onClick={handleClick}
      className={cn(
        "group relative rounded-lg border bg-body-bg p-3 shadow-xs transition-all",
        "cursor-grab active:cursor-grabbing",
        "hover:shadow-sm hover:border-primary/30",
        isDragging && "opacity-40 ring-2 ring-primary/40"
      )}
    >
      {/* ── Item name ────────────────────────────────────────────────── */}
      <div className="flex items-start gap-2 mb-2">
        {item.hasPresentation ? (
          <Globe className="size-4 mt-0.5 shrink-0 text-primary" />
        ) : (
          <FileText className="size-4 mt-0.5 shrink-0 text-subtle-text" />
        )}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium leading-tight truncate">
            {item.displayName || item.name}
          </p>
          {item.displayName && item.displayName !== item.name && (
            <p className="text-xs text-subtle-text truncate">{item.name}</p>
          )}
        </div>
      </div>

      {/* ── Metadata rows ────────────────────────────────────────────── */}
      <div className="space-y-1 text-xs text-subtle-text">
        {/* Language */}
        <div className="flex items-center gap-1.5">
          <Globe className="size-3 shrink-0" />
          <span>Language: {item.language.name}</span>
        </div>

        {/* Last updated */}
    <div className="flex items-start gap-1.5">
  <Clock className="size-3 shrink-0 mt-1" /> {/* Added mt-1 to align icon with the first line */}
  <div className="flex flex-col text-sm">
    <span className="truncate">Last updated: {lastUpdated}</span>
    {lastUpdatedBy !== "—" && (
      <span className="text-muted-foreground">
        by <strong>{lastUpdatedBy}</strong>
      </span>
    )}
  </div>
</div>

        {/* Template */}
        <div className="flex items-center gap-1.5">
          <Layers className="size-3 shrink-0" />
          <span>Template name: {item.template.name}</span>
        </div>

        {/* Version */}
        <div className="flex items-center gap-1.5">
          <FileText className="size-3 shrink-0" />
          <span>Current Version: {item.version}</span>
        </div>
      </div>

      {/* ── Tags row ─────────────────────────────────────────────────── */}
      <div className="flex items-center gap-1.5 mt-2 flex-wrap">
        <Badge size="sm" colorScheme="primary">
          v{item.version}
        </Badge>
        <Badge size="sm" colorScheme="neutral">
          {item.language.name}
        </Badge>
        {item.hasPresentation && (
          <Badge size="sm" colorScheme="cyan">
            Page
          </Badge>
        )}
        {item.workflow.canEdit && (
          <Badge size="sm" colorScheme="success">
            Editable
          </Badge>
        )}
      </div>
    </div>
  );
}
