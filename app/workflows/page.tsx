"use client";

import { useTenantContext } from "@/components/providers/tenant-provider";
import {
  useMarketplaceClient,
  useAppContext,
} from "@/components/providers/marketplace";
import { AppHeader } from "@/components/layout/app-header";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { WorkflowService } from "@/lib/api/workflow-service";
import { WorkflowBoard } from "@/components/board/workflow-board";
import { ItemLinksProvider } from "@/components/board/item-links-context";
import type { GqlSite, GqlWorkflow } from "@/lib/api/graphql-types";
import type { Xmapp } from "@sitecore-marketplace-sdk/xmc";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, Loader2 } from "lucide-react";
import { DebugAppContext } from "@/components/debug/debug-app-context";

const ALL_LANGUAGES = "all";

export default function WorkflowsPage() {
  const { selectedTenant, setSelectedTenant } = useTenantContext();
  const client = useMarketplaceClient();
  const appContext = useAppContext();
  const router = useRouter();

  // ── State ───────────────────────────────────────────────────────────────
  const [workflows, setWorkflows] = useState<GqlWorkflow[]>([]);
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string | null>(
    null
  );
  const [sites, setSites] = useState<GqlSite[]>([]);
  const [selectedSiteName, setSelectedSiteName] = useState("all");
  const [languages, setLanguages] = useState<Xmapp.Language[]>([]);
  const [selectedLanguageName, setSelectedLanguageName] =
    useState<string>(ALL_LANGUAGES);
  const [loadingWorkflows, setLoadingWorkflows] = useState(true);
  const [loadingSites, setLoadingSites] = useState(false);
  const [loadingLanguages, setLoadingLanguages] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hostOrigin, setHostOrigin] = useState<string | null>(null);

  // ── Derived ─────────────────────────────────────────────────────────────
  const workflowService = useMemo(() => {
    if (!selectedTenant) return null;
    return new WorkflowService(client, selectedTenant.context.preview);
  }, [client, selectedTenant]);

  const selectedWorkflow = useMemo(
    () => workflows.find((w) => w.workflowId === selectedWorkflowId) ?? null,
    [workflows, selectedWorkflowId]
  );

  const selectedSite = useMemo(
    () => sites.find((site) => site.name === selectedSiteName) ?? null,
    [selectedSiteName, sites]
  );

  const selectedLanguage = useMemo(
    () =>
      selectedLanguageName === ALL_LANGUAGES ? null : selectedLanguageName,
    [selectedLanguageName]
  );

  // ── Guard: restore tenant on direct entry, otherwise redirect ──────────
  useEffect(() => {
    if (selectedTenant) return;

    const tenants = appContext.resourceAccess ?? [];
    if (tenants.length === 1) {
      setSelectedTenant(tenants[0]);
      return;
    }

    router.replace("/");
  }, [appContext.resourceAccess, router, selectedTenant, setSelectedTenant]);

  // ── Fetch workflows on mount ──────────────────────────────────────────
  const fetchWorkflows = useCallback(async () => {
    if (!workflowService) return;
    setLoadingWorkflows(true);
    setError(null);

    try {
      const result = await workflowService.getWorkflows();
      setWorkflows(result);

      // Auto-select the first workflow
      if (result.length > 0) {
        setSelectedWorkflowId(result[0].workflowId);
      }
    } catch (err) {
      console.error("Failed to fetch workflows:", err);
      setError(
        err instanceof Error ? err.message : "Failed to fetch workflows"
      );
    } finally {
      setLoadingWorkflows(false);
    }
  }, [workflowService]);

  useEffect(() => {
    fetchWorkflows();
  }, [fetchWorkflows]);

  useEffect(() => {
    if (!workflowService) return;

    async function fetchSites() {
      setLoadingSites(true);

      if(!workflowService) {
        setSites([]);
        setSelectedSiteName("all");
        setLoadingSites(false);
        return;
      }
      
      try {
        const result = await workflowService.getSites();
        setSites(result);
        setSelectedSiteName("all");
      } catch (err) {
        console.error("Failed to fetch sites:", err);
        setSites([]);
        setSelectedSiteName("all");
      } finally {
        setLoadingSites(false);
      }
    }

    fetchSites();
  }, [workflowService]);

  // ── Fetch languages (from XMC Sites SDK, per tenant) ──────────────────
  useEffect(() => {
    if (!selectedTenant) return;

    const contextId = selectedTenant.context.preview;
    if (!contextId) {
      setLanguages([]);
      setSelectedLanguageName(ALL_LANGUAGES);
      return;
    }

    let cancelled = false;

    async function fetchLanguages() {
      setLoadingLanguages(true);
      try {
        const response = await client.query("xmc.sites.listLanguages", {
          params: { query: { sitecoreContextId: contextId } },
        });
        if (cancelled) return;
        const list = (response.data?.data ?? []) as Xmapp.Language[];
        setLanguages(list);
        setSelectedLanguageName(ALL_LANGUAGES);
      } catch (err) {
        if (cancelled) return;
        console.error("Failed to fetch languages:", err);
        setLanguages([]);
        setSelectedLanguageName(ALL_LANGUAGES);
      } finally {
        if (!cancelled) setLoadingLanguages(false);
      }
    }

    fetchLanguages();
    return () => {
      cancelled = true;
    };
  }, [client, selectedTenant]);

  // ── Resolve host origin once per workflow service (for Content Editor URL)
  useEffect(() => {
    if (!workflowService) {
      setHostOrigin(null);
      return;
    }
    let cancelled = false;
    workflowService.getHostOrigin().then((origin) => {
      if (!cancelled) setHostOrigin(origin);
    });
    return () => {
      cancelled = true;
    };
  }, [workflowService]);

  // ── Early returns ─────────────────────────────────────────────────────
  if (!selectedTenant) {
    return null;
  }

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col min-h-screen">
      <AppHeader />

      <main className="flex-1 p-6 space-y-4">
        {/* ── Toolbar: Workflow selector ─────────────────────────────── */}
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <label
              htmlFor="workflow-select"
              className="text-sm font-medium whitespace-nowrap"
            >
              Workflow
            </label>

            {loadingWorkflows ? (
              <div className="flex items-center gap-2 h-9 px-3 text-sm text-subtle-text">
                <Loader2 className="size-4 animate-spin" />
                <span>Loading workflows…</span>
              </div>
            ) : error ? (
              <div className="flex items-center gap-2 text-sm text-destructive">
                <AlertCircle className="size-4" />
                <span>{error}</span>
              </div>
            ) : (
              <Select
                value={selectedWorkflowId ?? undefined}
                onValueChange={(value) => setSelectedWorkflowId(value)}
              >
                <SelectTrigger id="workflow-select" className="w-[280px]">
                  <SelectValue placeholder="Select a workflow…" />
                </SelectTrigger>
                <SelectContent>
                  {workflows.map((wf) => (
                    <SelectItem key={wf.workflowId} value={wf.workflowId}>
                      {wf.displayName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="flex items-center gap-2">
            <label
              htmlFor="site-select"
              className="text-sm font-medium whitespace-nowrap"
            >
              Site
            </label>

            <Select
              value={selectedSiteName}
              onValueChange={setSelectedSiteName}
              disabled={loadingSites || sites.length === 0}
            >
              <SelectTrigger id="site-select" className="w-[240px]">
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {sites.map((site) => (
                  <SelectItem key={site.name} value={site.name}>
                    {site.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <label
              htmlFor="language-select"
              className="text-sm font-medium whitespace-nowrap"
            >
              Language
            </label>

            <Select
              value={selectedLanguageName}
              onValueChange={setSelectedLanguageName}
              disabled={loadingLanguages || languages.length === 0}
            >
              <SelectTrigger id="language-select" className="w-[240px]">
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_LANGUAGES}>All</SelectItem>
                {languages.map((lang) => {
                  const value = lang.name ?? lang.iso;
                  if (!value) return null;
                  const label =
                    lang.englishName ?? lang.displayName ?? value;
                  return (
                    <SelectItem key={value} value={value}>
                      {label} ({value})
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* ── Board ────────────────────────────────────────────────────── */}
        {loadingWorkflows ? (
          <BoardSkeleton />
        ) : selectedWorkflow && workflowService ? (
          <ItemLinksProvider
            value={{
              hostOrigin,
              tenantName: selectedTenant.tenantName ?? null,
              organizationId: appContext.organizationId ?? null,
              sites,
              selectedSite,
            }}
          >
            <WorkflowBoard
              key={selectedWorkflow.workflowId}
              workflow={selectedWorkflow}
              workflowService={workflowService}
              selectedSite={selectedSite}
              selectedLanguage={selectedLanguage}
            />
          </ItemLinksProvider>
        ) : workflows.length === 0 ? (
          <Card style="outline" padding="lg">
            <CardContent className="py-10 text-center text-sm text-subtle-text">
              No workflows found for this tenant.
            </CardContent>
          </Card>
        ) : null}

        {/* ── Debug: ApplicationContext ─────────────────────────────── */}
       {process.env.NODE_ENV !== "production" && (
          <DebugAppContext appContext={appContext} selectedTenant={selectedTenant} />
        )}
      </main>
    </div>
  );
}

// ── Board loading skeleton ──────────────────────────────────────────────────

function BoardSkeleton() {
  return (
    <div className="grid gap-4 grid-cols-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          className="flex flex-col rounded-xl border bg-subtle-bg"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-5 w-8 rounded-full" />
          </div>
          {/* Cards */}
          <div className="p-3 space-y-2">
            {Array.from({ length: 2 }).map((_, j) => (
              <div
                key={j}
                className="rounded-lg border bg-body-bg p-3 space-y-2"
              >
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
        </div>
      ))}
    </div>
  );
}


