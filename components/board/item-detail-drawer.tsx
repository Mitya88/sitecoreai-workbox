// ---------------------------------------------------------------------------
// ItemDetailDrawer — side panel showing full item details
//
// Opened by clicking a card on the board. Fetches full item detail including
// fields, versions, workflow history, publish status, and access rights.
// Includes "Open in Content Editor" link using the host URL from AppContext.
// ---------------------------------------------------------------------------

"use client";

import { useCallback, useEffect, useState } from "react";
import type {
  GqlItemDetail,
  GqlWorkflowEvent,
} from "@/lib/api/graphql-types";
import type { WorkflowService } from "@/lib/api/workflow-service";
import { useAppContext } from "@/components/providers/marketplace";
import { formatSitecoreDate } from "@/lib/date-utils";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ExternalLink,
  Globe,
  Clock,
  Lock,
  Unlock,
  ShieldCheck,
  Layers,
  FileText,
  History,
  ArrowRight,
} from "lucide-react";

// ── Props ───────────────────────────────────────────────────────────────────

interface ItemDetailDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemId: string | null;
  language: string | null;
  workflowService: WorkflowService;
}

// ── Component ───────────────────────────────────────────────────────────────

export function ItemDetailDrawer({
  open,
  onOpenChange,
  itemId,
  language,
  workflowService,
}: ItemDetailDrawerProps) {
  const appContext = useAppContext();

  const [detail, setDetail] = useState<GqlItemDetail | null>(null);
  const [history, setHistory] = useState<GqlWorkflowEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Fetch item detail ─────────────────────────────────────────────────

  const fetchDetail = useCallback(async () => {
    if (!itemId || !language) return;
    setLoading(true);
    setError(null);

    try {
      const result = await workflowService.getItemDetail(itemId, language);
      setDetail(result.item);
      setHistory(result.history);
    } catch (err) {
      console.error("Failed to load item detail:", err);
      setError(err instanceof Error ? err.message : "Failed to load details");
    } finally {
      setLoading(false);
    }
  }, [itemId, language, workflowService]);

  useEffect(() => {
    if (open && itemId) {
      fetchDetail();
    }
    if (!open) {
      // Reset on close
      setDetail(null);
      setHistory([]);
      setError(null);
    }
  }, [open, itemId, fetchDetail]);

  // ── Content Editor URL ────────────────────────────────────────────────

  // const contentEditorUrl =
  //   appContext.url && itemId
  //     ? `${appContext.url.replace(/\/$/, "")}/sitecore/shell/Applications/Content%20Editor?fo=${encodeURIComponent(itemId)}&la=${encodeURIComponent(language ?? "en")}`
  //     : null;
 const contentEditorUrl = null; // Disabled for now
  // ── Pages (Page Builder) URL ──────────────────────────────────────────

  // Strip braces from itemId for Pages URL: {GUID} → GUID
  const pagesUrl =
    detail && itemId
      ? `https://pages.sitecorecloud.io/editor?sc_itemid=${itemId.replace(/[{}]/g, "")}&sc_lang=${encodeURIComponent(language ?? "en")}&sc_version=${detail.version}`
      : null;

  // ── Render ────────────────────────────────────────────────────────────

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>
            {loading ? (
              <span className="block animate-pulse rounded-md bg-accent h-6 w-48" />
            ) : detail ? (
              detail.displayName || detail.name
            ) : (
              "Item Details"
            )}
          </SheetTitle>
          <SheetDescription className="sr-only">Item details panel</SheetDescription>
          <div className="text-muted-foreground text-sm">
            {loading ? (
              <span className="block animate-pulse rounded-md bg-accent h-4 w-64" />
            ) : detail ? (
              detail.path
            ) : error ? (
              <span className="text-destructive">{error}</span>
            ) : (
              "Select an item to view its details"
            )}
          </div>
        </SheetHeader>

        {loading ? (
          <DrawerSkeleton />
        ) : detail ? (
          <div className="flex flex-col gap-5 px-4 pb-6">
            {/* ── Open in Content Editor / Pages ────────────────────── */}
            <div className="flex flex-wrap gap-2">
              {contentEditorUrl && (
                <Button variant="outline" size="sm" asChild>
                  <a href={contentEditorUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="size-3.5 mr-1.5" />
                    Open in Content Editor
                  </a>
                </Button>
              )}
              {pagesUrl && detail.hasPresentation && (
                <Button variant="outline" size="sm" asChild>
                  <a href={pagesUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="size-3.5 mr-1.5" />
                    Open in Pages
                  </a>
                </Button>
              )}
              {!contentEditorUrl && !pagesUrl && (
                <p className="text-xs text-subtle-text italic">
                  External links unavailable — host URL not set
                </p>
              )}
            </div>

            {/* ── Basic info ─────────────────────────────────────────── */}
            <Section title="Item Information">
              <InfoRow icon={<FileText className="size-3.5" />} label="Name" value={detail.name} />
              {detail.displayName !== detail.name && (
                <InfoRow icon={<FileText className="size-3.5" />} label="Display Name" value={detail.displayName} />
              )}
              <InfoRow icon={<Layers className="size-3.5" />} label="Template" value={detail.template.name} />
              <InfoRow icon={<Globe className="size-3.5" />} label="Language" value={`${detail.language.displayName} (${detail.language.name})`} />
              <InfoRow icon={<FileText className="size-3.5" />} label="Version" value={String(detail.version)} />
              <InfoRow icon={<FileText className="size-3.5" />} label="Item ID" value={detail.itemId} mono />
              <InfoRow icon={<FileText className="size-3.5" />} label="Path" value={detail.path} mono />
            </Section>

            <Separator />

            {/* ── Workflow state ──────────────────────────────────────── */}
            <Section title="Workflow">
              <div className="flex flex-wrap items-center gap-2">
                {detail.workflow.workflow && (
                  <Badge size="md" colorScheme="primary">
                    {detail.workflow.workflow.displayName}
                  </Badge>
                )}
                <Badge
                  size="md"
                  colorScheme={detail.workflow.workflowState.final ? "success" : "neutral"}
                >
                  {detail.workflow.workflowState.displayName}
                </Badge>
              </div>
              <div className="flex gap-3 mt-2 text-xs text-subtle-text">
                {detail.workflow.canEdit && (
                  <span className="flex items-center gap-1">
                    <ShieldCheck className="size-3" /> Can edit
                  </span>
                )}
                {detail.workflow.canSave && (
                  <span className="flex items-center gap-1">
                    <ShieldCheck className="size-3" /> Can save
                  </span>
                )}
              </div>
            </Section>

            <Separator />

            {/* ── Lock ───────────────────────────────────────────────── */}
            <Section title="Lock Status">
              <div className="flex items-center gap-2 text-sm">
                {detail.lock.isLocked ? (
                  <>
                    <Lock className="size-4 text-warning" />
                    <span>Locked by <strong>{detail.lock.lockedBy}</strong></span>
                  </>
                ) : (
                  <>
                    <Unlock className="size-4 text-success" />
                    <span>Not locked</span>
                  </>
                )}
              </div>
            </Section>

            <Separator />

            {/* ── Access rights ───────────────────────────────────────── */}
            <Section title="Access Rights">
              <div className="flex flex-wrap gap-1.5">
                <AccessBadge label="Read" allowed={detail.access.canRead} />
                <AccessBadge label="Write" allowed={detail.access.canWrite} />
                <AccessBadge label="Delete" allowed={detail.access.canDelete} />
                <AccessBadge label="Publish" allowed={detail.access.canPublish} />
              </div>
            </Section>

            <Separator />

            {/* ── Publish status ──────────────────────────────────────── */}
            <Section title="Publishing">
              <div className="flex flex-wrap gap-1.5">
                <Badge
                  size="sm"
                  colorScheme={detail.publish.hasPublishableVersion ? "success" : "neutral"}
                >
                  {detail.publish.hasPublishableVersion ? "Publishable" : "Not publishable"}
                </Badge>
                {detail.publish.neverPublish && (
                  <Badge size="sm" colorScheme="danger">Never Publish</Badge>
                )}
                {detail.publish.hideVersion && (
                  <Badge size="sm" colorScheme="warning">Hidden Version</Badge>
                )}
              </div>
            </Section>

            <Separator />

            {/* ── Fields ─────────────────────────────────────────────── */}
            {detail.fields.nodes.length > 0 && (
              <>
                <Section title={`Fields (${detail.fields.nodes.length})`}>
                  <div className="space-y-2">
                    {detail.fields.nodes.map((field) => (
                      <div
                        key={field.fieldId}
                        className="rounded-md border bg-body-bg p-2 text-xs"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium">{field.name}</span>
                          <Badge size="sm" colorScheme="neutral">
                            {field.templateField.type}
                          </Badge>
                        </div>
                        <p className="text-subtle-text break-all line-clamp-3">
                          {field.value || <em className="italic">empty</em>}
                        </p>
                        {field.containsStandardValue && (
                          <p className="text-xs text-warning mt-1 italic">Standard value</p>
                        )}
                      </div>
                    ))}
                  </div>
                </Section>
                <Separator />
              </>
            )}

            {/* ── Versions ───────────────────────────────────────────── */}
            {detail.versions.length > 0 && (
              <>
                <Section title={`Versions (${detail.versions.length})`}>
                  <div className="space-y-1.5">
                    {detail.versions.map((ver) => (
                      <div
                        key={ver.version}
                        className="flex items-center justify-between rounded-md border bg-body-bg px-2.5 py-1.5 text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <Badge
                            size="sm"
                            colorScheme={ver.version === detail.version ? "primary" : "neutral"}
                          >
                            v{ver.version}
                          </Badge>
                          <span className="text-subtle-text">
                            {ver.language.name}
                          </span>
                        </div>
                        <span className="text-subtle-text">
                          {formatSitecoreDate(ver.field_updated?.value)}
                          {ver.field_updatedBy?.value && (
                            <> by {ver.field_updatedBy.value}</>
                          )}
                        </span>
                      </div>
                    ))}
                  </div>
                </Section>
                <Separator />
              </>
            )}

            {/* ── Workflow history ────────────────────────────────────── */}
            {history.length > 0 && (
              <Section title={`Workflow History (${history.length})`}>
                <div className="space-y-2">
                  {history.filter(Boolean).map((event, i) => (
                    <div
                      key={i}
                      className="rounded-md border bg-body-bg p-2.5 text-xs"
                    >
                      <div className="flex items-center gap-1.5 mb-1">
                        <History className="size-3 shrink-0" />
                        <Clock className="size-3 shrink-0" />
                        <span className="text-subtle-text">
                          {event.date ? formatSitecoreDate(event.date) : "—"}
                        </span>
                        <span className="font-medium ml-auto">{event.user ?? "Unknown"}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-subtle-text">
                        {event.oldState && (
                          <Badge size="sm" colorScheme="neutral">
                            {event.oldState.displayName}
                          </Badge>
                        )}
                        <ArrowRight className="size-3" />
                        {event.newState && (
                          <Badge size="sm" colorScheme="primary">
                            {event.newState.displayName}
                          </Badge>
                        )}
                      </div>
                      {event.comments.length > 0 && (
                        <p className="mt-1 text-subtle-text italic">
                          {event.comments.join("; ")}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </Section>
            )}
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h4 className="text-xs font-semibold uppercase tracking-wider text-subtle-text mb-2">
        {title}
      </h4>
      {children}
    </div>
  );
}

function InfoRow({
  icon,
  label,
  value,
  mono,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start gap-2 text-sm py-0.5">
      <span className="mt-0.5 text-subtle-text shrink-0">{icon}</span>
      <span className="text-subtle-text shrink-0 min-w-[90px]">{label}:</span>
      <span className={mono ? "font-mono text-xs break-all" : "break-all"}>
        {value}
      </span>
    </div>
  );
}

function AccessBadge({ label, allowed }: { label: string; allowed: boolean }) {
  return (
    <Badge size="sm" colorScheme={allowed ? "success" : "danger"}>
      {allowed ? "✓" : "✗"} {label}
    </Badge>
  );
}

// ── Skeleton ────────────────────────────────────────────────────────────────

function DrawerSkeleton() {
  return (
    <div className="flex flex-col gap-4 px-4 pb-6">
      <Skeleton className="h-8 w-32" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-3/4" />
      <Separator />
      <Skeleton className="h-4 w-20" />
      <Skeleton className="h-6 w-40" />
      <Separator />
      <Skeleton className="h-4 w-20" />
      <div className="space-y-2">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
      <Separator />
      <Skeleton className="h-4 w-20" />
      <div className="space-y-1.5">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
      </div>
    </div>
  );
}
