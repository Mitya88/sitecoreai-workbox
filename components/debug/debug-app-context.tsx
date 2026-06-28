import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useAppContext } from "@/components/providers/marketplace";
import { Bug, ChevronDown } from "lucide-react";
import type { ApplicationResourceContext } from "@sitecore-marketplace-sdk/core";

export function DebugAppContext({
  appContext,
  selectedTenant,
}: {
  appContext: ReturnType<typeof useAppContext>;
  selectedTenant: ApplicationResourceContext | null;
}) {
  return (
    <Collapsible className="mt-4">
      <CollapsibleTrigger className="flex items-center gap-2 text-xs text-subtle-text hover:text-foreground transition-colors cursor-pointer">
        <Bug className="size-3.5" />
        <span className="font-medium">Debug: ApplicationContext</span>
        <ChevronDown className="size-3.5 transition-transform [[data-state=open]_&]:rotate-180" />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="mt-2 rounded-lg border bg-subtle-bg p-4 space-y-3 text-xs font-mono">
          {/* Key connection details */}
          <div className="space-y-1">
            <h5 className="font-sans font-semibold text-xs uppercase tracking-wider text-subtle-text">
              Connection Details
            </h5>
            <Row label="appContext.url" value={appContext.url} highlight />
            <Row label="appContext.id" value={appContext.id} />
            <Row label="appContext.name" value={appContext.name} />
            <Row label="appContext.type" value={appContext.type} />
            <Row label="appContext.state" value={appContext.state} />
            <Row label="appContext.organizationId" value={appContext.organizationId} />
            <Row label="appContext.installationId" value={appContext.installationId} />
            <Row label="appContext.iconUrl" value={appContext.iconUrl} />
          </div>

          {/* Selected tenant */}
          {selectedTenant && (
            <div className="space-y-1 border-t pt-2">
              <h5 className="font-sans font-semibold text-xs uppercase tracking-wider text-subtle-text">
                Selected Tenant
              </h5>
              <Row label="tenantId" value={selectedTenant.tenantId} />
              <Row label="tenantName" value={selectedTenant.tenantName} />
              <Row label="tenantDisplayName" value={selectedTenant.tenantDisplayName} />
              <Row label="resourceId" value={selectedTenant.resourceId} />
              <Row label="context.live" value={selectedTenant.context?.live} />
              <Row label="context.preview" value={selectedTenant.context?.preview} highlight />
            </div>
          )}

          {/* Full JSON dump */}
          <details className="border-t pt-2">
            <summary className="font-sans font-medium text-subtle-text cursor-pointer hover:text-foreground">
              Full ApplicationContext JSON
            </summary>
            <pre className="mt-2 max-h-64 overflow-auto rounded bg-body-bg p-2 text-[10px] leading-relaxed whitespace-pre-wrap break-all">
              {JSON.stringify(appContext, null, 2)}
            </pre>
          </details>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function Row({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string | undefined | null;
  highlight?: boolean;
}) {
  return (
    <div className="flex gap-2">
      <span className="text-subtle-text shrink-0 min-w-[180px]">{label}:</span>
      <span
        className={
          highlight
            ? value
              ? "text-success font-semibold break-all"
              : "text-danger font-semibold"
            : "break-all"
        }
      >
        {value || <em className="text-subtle-text italic">not set</em>}
      </span>
    </div>
  );
}
