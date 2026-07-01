// ---------------------------------------------------------------------------
// ItemLinksContext — provides the environment info required to build
// Content Editor / Pages / Pages-Content deep links for board items,
// without prop-drilling through Board → Column → Card.
// ---------------------------------------------------------------------------

"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { GqlSite, GqlWorkItem } from "@/lib/api/graphql-types";
import { itemBelongsToSite } from "@/lib/site-utils";

export interface ItemLinksContextValue {
  /** XM Cloud authoring host origin (e.g. https://xmc-tenant.sitecorecloud.io). */
  hostOrigin: string | null;
  /** Tenant name used in the Pages "Content" URL `tenantName` query param. */
  tenantName: string | null;
  /** Organization id used in the Pages "Content" URL `organization` param. */
  organizationId: string | null;
  /** All sites for this tenant — used to infer `sc_site` when possible. */
  sites: GqlSite[];
  /** The site currently selected in the toolbar (or null when "All"). */
  selectedSite: GqlSite | null;
}

const ItemLinksContext = createContext<ItemLinksContextValue | null>(null);

export function ItemLinksProvider({
  value,
  children,
}: {
  value: ItemLinksContextValue;
  children: ReactNode;
}) {
  const memoized = useMemo(() => value, [
    value.hostOrigin,
    value.tenantName,
    value.organizationId,
    value.sites,
    value.selectedSite,
  ]);

  return (
    <ItemLinksContext.Provider value={memoized}>
      {children}
    </ItemLinksContext.Provider>
  );
}

/**
 * Access item-link environment data. Returns `null` when the provider is not
 * mounted (e.g. in isolated tests) so consumers can degrade gracefully.
 */
export function useItemLinks(): ItemLinksContextValue | null {
  return useContext(ItemLinksContext);
}

/**
 * Resolves the best `sc_site` for a given item:
 *   1. selectedSite from the toolbar, if set
 *   2. otherwise the first site whose path contains the item
 */
export function resolveSiteForItem(
  ctx: ItemLinksContextValue,
  item: GqlWorkItem,
): GqlSite | null {
  if (ctx.selectedSite) return ctx.selectedSite;
  return ctx.sites.find((site) => itemBelongsToSite(item, site)) ?? null;
}
