"use client";

import { useTenantContext } from "@/components/providers/tenant-provider";
import { useAppContext } from "@/components/providers/marketplace";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { Columns3, GripVertical, ArrowRightLeft, Workflow } from "lucide-react";

export default function HomePage() {
  const appContext = useAppContext();
  const { selectedTenant, setSelectedTenant } = useTenantContext();
  const router = useRouter();

  const tenants = appContext.resourceAccess ?? [];

  function handleTenantChange(tenantId: string) {
    const tenant = tenants.find((t) => t.tenantId === tenantId) ?? null;
    setSelectedTenant(tenant);
  }

  function handleContinue() {
    if (selectedTenant) {
      router.push("/workflows");
    }
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-subtle-bg">
      <Card
        elevation="md"
        style="outline"
        padding="lg"
        className="w-full max-w-lg"
      >
        <CardHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="flex items-center justify-center size-10 rounded-lg bg-primary/10 text-primary">
              <Workflow className="size-5" />
            </div>
            <div>
              <CardTitle className="text-xl">Advanced Workbox</CardTitle>
              <CardDescription>SitecoreAI</CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          <p className="text-sm text-subtle-text">
            A modern workflow management tool for Sitecore content editors.
            Visualize, manage, and transition content items across workflow
            states with an intuitive drag-and-drop Kanban board.
          </p>

          <div className="grid grid-cols-3 gap-3">
            <div className="flex flex-col items-center gap-1.5 rounded-lg border border-border-color bg-body-bg p-3 text-center">
              <Columns3 className="size-5 text-primary" />
              <span className="text-xs font-medium">Kanban Board</span>
            </div>
            <div className="flex flex-col items-center gap-1.5 rounded-lg border border-border-color bg-body-bg p-3 text-center">
              <GripVertical className="size-5 text-primary" />
              <span className="text-xs font-medium">Drag & Drop</span>
            </div>
            <div className="flex flex-col items-center gap-1.5 rounded-lg border border-border-color bg-body-bg p-3 text-center">
              <ArrowRightLeft className="size-5 text-primary" />
              <span className="text-xs font-medium">State Transitions</span>
            </div>
          </div>

          <Separator />

          <div className="space-y-2">
            <label className="text-sm font-medium">
              Select a tenant to get started
            </label>
            {tenants.length === 0 ? (
              <p className="text-sm text-danger-fg">
                No tenants available. Ensure the app has resource access
                configured in the Sitecore Marketplace.
              </p>
            ) : (
              <Select
                value={selectedTenant?.tenantId ?? ""}
                onValueChange={handleTenantChange}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Choose a tenant…" />
                </SelectTrigger>
                <SelectContent>
                  {tenants.map((tenant) => (
                    <SelectItem key={tenant.tenantId} value={tenant.tenantId}>
                      <span className="flex items-center gap-2">
                        {tenant.tenantDisplayName ??
                          tenant.tenantName ??
                          tenant.tenantId}
                        {tenant.tenantDisplayName &&
                          tenant.tenantName &&
                          tenant.tenantDisplayName !== tenant.tenantName && (
                            <Badge size="sm" colorScheme="neutral">
                              {tenant.tenantName}
                            </Badge>
                          )}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <Button
            className="w-full"
            size="default"
            disabled={!selectedTenant}
            onClick={handleContinue}
          >
            Continue to Workflows
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
