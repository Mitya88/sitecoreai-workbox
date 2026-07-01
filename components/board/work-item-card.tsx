// ---------------------------------------------------------------------------
// WorkItemCard — a draggable card representing one Sitecore item in a column
// ---------------------------------------------------------------------------

"use client";

import { useState } from "react";
import type { GqlWorkItem } from "@/lib/api/graphql-types";
import { formatSitecoreDate } from "@/lib/date-utils";
import { useBoardDnd } from "./board-dnd-context";
import {
  useItemLinks,
  resolveSiteForItem,
} from "./item-links-context";
import {
  buildContentEditorUrl,
  buildPagesUrl,
} from "@/lib/api/host-url";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  FileText,
  Globe,
  Clock,
  Layers,
  MoreVertical,
  ExternalLink,
} from "lucide-react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import type React from "react";

interface WorkItemCardProps {
  item: GqlWorkItem;
  stateId: string;
  onClick?: (item: GqlWorkItem) => void;
}

/** True when `value` is a syntactically valid https:// URL. */
function isValidHttpsUrl(value: string | null | undefined): value is string {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:";
  } catch {
    return false;
  }
}

export function WorkItemCard({ item, stateId, onClick }: WorkItemCardProps) {
  const { startDrag, endDrag, dragPayload } = useBoardDnd();

  // Identify a card uniquely by itemId + language + version. Without the
  // version check, multiple versions of the same item in the same language
  // would all appear as "dragging" whenever any one of them is picked up.
  const isDragging =
    dragPayload?.item.itemId === item.itemId &&
    dragPayload?.item.language.name === item.language.name &&
    dragPayload?.item.version === item.version;

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
        <ItemIcon item={item} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium leading-tight truncate">
            {item.displayName || item.name}
          </p>
          {item.displayName && item.displayName !== item.name && (
            <p className="text-xs text-subtle-text truncate">{item.name}</p>
          )}
        </div>
        <ItemActionsMenu item={item} />
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

// ── Icon: prefer the item's `icon` URL (when it's a valid https:// URL) ──
function ItemIcon({ item }: { item: GqlWorkItem }) {
  const [imgFailed, setImgFailed] = useState(false);
  const useRemoteIcon = !imgFailed && isValidHttpsUrl(item.icon);

  if (useRemoteIcon) {
    return (
      
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={item.icon as string}
        alt=""
        aria-hidden="true"
        className="size-4 mt-0.5 shrink-0 object-contain"
        onError={() => setImgFailed(true)}
      />
    );
  }

  return item.hasPresentation ? (
    <Globe className="size-4 mt-0.5 shrink-0 text-primary" />
  ) : (
    <FileText className="size-4 mt-0.5 shrink-0 text-subtle-text" />
  );
}

// ── Per-card actions dropdown ────────────────────────────────────────────
// Renders the "Open in …" links. Pages-related options are only shown when
// the item has presentation. Content mode requires tenant + organization.
function ItemActionsMenu({ item }: { item: GqlWorkItem }) {
  const links = useItemLinks();
  if (!links) return null;

  const language = item.language.name;
  const version = item.version;
  const siteName = resolveSiteForItem(links, item)?.name ?? null;

  const contentEditorUrl = buildContentEditorUrl(
    links.hostOrigin,
    item.itemId,
    language,
  );

  const pagesArgs = {
    tenantName: links.tenantName,
    organizationId: links.organizationId,
    itemId: item.itemId,
    language,
    siteName,
    version,
  } as const;

  const pagesUrl = item.hasPresentation
    ? buildPagesUrl({ ...pagesArgs, mode: "editor" })
    : null;

  const pagesContentUrl = buildPagesUrl({ ...pagesArgs, mode: "content" });

  const hasAnyLink = Boolean(contentEditorUrl || pagesUrl || pagesContentUrl);
  if (!hasAnyLink) return null;

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          aria-label="Item actions"
          onClick={(e) => {
            // Prevent the card's click handler (which opens the drawer)
            e.stopPropagation();
          }}
          onPointerDown={(e) => {
            // Prevent the card's HTML5 drag from starting on the trigger
            e.stopPropagation();
          }}
          className="p-1 -mt-1 -mr-1 rounded shrink-0 text-subtle-text hover:bg-neutral-100 hover:text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40"
        >
          <MoreVertical className="size-4" />
        </button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className="bg-white border rounded-md p-1 shadow-md min-w-[220px] z-50"
          align="end"
          onClick={(e) => e.stopPropagation()}
        >
          {contentEditorUrl && (
            <ActionItem href={contentEditorUrl}>
              Open in Content Editor
            </ActionItem>
          )}
          {pagesUrl && (
            <ActionItem href={pagesUrl}>Open in Pages</ActionItem>
          )}
          {pagesContentUrl && (
            <ActionItem href={pagesContentUrl}>
              Open in Pages (Content Mode)
            </ActionItem>
          )}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

function ActionItem({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <DropdownMenu.Item
      asChild
      className="text-xs px-2 py-1.5 outline-none cursor-pointer hover:bg-neutral-100 rounded flex items-center gap-1.5"
    >
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
      >
        <ExternalLink className="size-3.5 shrink-0" />
        <span>{children}</span>
      </a>
    </DropdownMenu.Item>
  );
}
