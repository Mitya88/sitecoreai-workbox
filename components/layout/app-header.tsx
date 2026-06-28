"use client";

import { useTenantContext } from "@/components/providers/tenant-provider";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Workflow } from "lucide-react";
import Link from "next/link";

export function AppHeader() {
  const { selectedTenant } = useTenantContext();

  return (
    <header className="border-b bg-body-bg">
      <div className="flex items-center h-14 px-6 gap-4">
        {/* Brand */}
        <Link href="/" className="flex items-center gap-2.5 shrink-0">
          <div className="flex items-center justify-center size-8 rounded-md bg-primary/10 text-primary">
            <Workflow className="size-4" />
          </div>
          <span className="text-sm font-semibold tracking-tight">
            SitecoreAI Advanced Workbox
          </span>
        </Link>

        {/* Tenant indicator */}
        {selectedTenant && (
          <>
            <Separator orientation="vertical" className="h-5" />
            <div className="flex items-center gap-2">
              <span className="text-xs text-subtle-text">Tenant:</span>
              <Badge size="md" colorScheme="primary">
                {selectedTenant.tenantDisplayName ??
                  selectedTenant.tenantName ??
                  selectedTenant.tenantId}
              </Badge>
            </div>
          </>
        )}
      </div>
    </header>
  );
}
