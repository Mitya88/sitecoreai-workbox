// ---------------------------------------------------------------------------
// host-url — resolve the XM Cloud host origin (used by Content Editor links)
//
// The Marketplace SDK does not directly expose the authoring host URL of the
// connected XM Cloud environment. As a workaround we call `xmc.sites.listSites`
// and read the absolute thumbnail URL of the first site — its `origin` is the
// authoring host we need (e.g. `https://xmc-customer-tenant.sitecorecloud.io`).
//
// Returns `null` if no usable URL can be resolved or the call fails.
// ---------------------------------------------------------------------------

import type { ClientSDK } from "@sitecore-marketplace-sdk/client";

/** Subset of the `Site` response shape that we depend on. */
interface SiteWithThumbnail {
  thumbnail?: { url?: string | null } | null;
}

/**
 * Resolves the XM Cloud authoring host origin (scheme + host) by inspecting
 * the first site returned by `xmc.sites.listSites`. The thumbnail URL is an
 * absolute media URL on the same host as Content Editor.
 *
 * @param client            An initialized Marketplace `ClientSDK` instance.
 * @param sitecoreContextId The Sitecore context ID for the target environment
 *                          (e.g. `selectedTenant.context.preview`).
 * @returns The host origin (`https://<host>`) or `null` if unresolved.
 */
export async function resolveHostOrigin(
  client: ClientSDK,
  sitecoreContextId: string,
): Promise<string | null> {
  try {
    const result = await client.query("xmc.sites.listSites", {
      params: { query: { sitecoreContextId } },
    });

    // The SDK wraps the API response as `{ data: Site[] }`, but some callers
    // have observed `{ data: { data: Site[] } }`. Handle both defensively.
    const raw = (result as { data?: unknown })?.data ?? result;
    const sites: SiteWithThumbnail[] = Array.isArray(raw)
      ? (raw as SiteWithThumbnail[])
      : Array.isArray((raw as { data?: unknown })?.data)
        ? ((raw as { data: SiteWithThumbnail[] }).data)
        : [];

    for (const site of sites) {
      const url = site?.thumbnail?.url;
      if (typeof url === "string" && url.length > 0) {
        try {
          return new URL(url).origin;
        } catch {
          // Skip malformed URLs and try the next site.
        }
      }
    }

    return null;
  } catch (error) {
    console.error("Failed to resolve host origin from sites:", error);
    return null;
  }
}

/**
 * Builds the Content Editor deep-link URL for an item, given a previously
 * resolved host origin. Returns `null` if any required input is missing.
 */
export function buildContentEditorUrl(
  hostOrigin: string | null,
  itemId: string | null,
  language: string | null,
): string | null {
  if (!hostOrigin || !itemId) return null;
  const base = hostOrigin.replace(/\/$/, "");
  const fo = encodeURIComponent(itemId);
  const la = encodeURIComponent(language ?? "en");
  return `${base}/sitecore/shell/Applications/Content%20Editor?fo=${fo}&la=${la}`;
}

/** Strip Sitecore GUID braces: `{GUID}` → `GUID`. Returns `null` when input is falsy. */
function stripBraces(itemId: string | null | undefined): string | null {
  if (!itemId) return null;
  return itemId.replace(/[{}]/g, "");
}

const PAGES_ORIGIN = "https://pages.sitecorecloud.io";

/**
 * Builds a Pages deep-link URL for an item. Both `editor` and `content`
 * modes share the same query-string shape:
 *
 *   tenantName + organization + sc_itemid + sc_lang [+ sc_site] [+ sc_version]
 *
 * Example:
 *   https://pages.sitecorecloud.io/editor?tenantName=…&organization=…&sc_itemid=…&sc_lang=en&sc_site=…&sc_version=1
 *
 * Returns `null` if any of the strictly-required inputs are missing
 * (`itemId`, `tenantName`, `organizationId`).
 */
export function buildPagesUrl(input: {
  mode?: "editor" | "content";
  tenantName: string | null | undefined;
  organizationId: string | null | undefined;
  itemId: string | null;
  language: string | null;
  siteName?: string | null;
  version?: number | null;
}): string | null {
  const id = stripBraces(input.itemId);
  if (!id || !input.organizationId) return null;

  const params = new URLSearchParams();
  // TODO: Tenant name is coming null, excluding for now
  //params.set("tenantName", input.tenantName);
  params.set("organization", input.organizationId);
  params.set("sc_itemid", id);
  params.set("sc_lang", input.language ?? "en");
  if (input.siteName) params.set("sc_site", input.siteName);
  if (typeof input.version === "number") {
    params.set("sc_version", String(input.version));
  }

  return `${PAGES_ORIGIN}/${input.mode ?? "editor"}?${params.toString()}`;
}
