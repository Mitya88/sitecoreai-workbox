import type { GqlSite, GqlWorkItem } from "@/lib/api/graphql-types";

export function normalizePath(path: string): string {
  return path.trim().replace(/\\/g, "/").replace(/\/+$/, "").toLowerCase();
}

export function itemBelongsToSite(item: GqlWorkItem, site: GqlSite): boolean {
  const itemPath = normalizePath(item.path);
  const sitePaths = [site.contentStartPath, site.startPath, site.rootPath]
    .filter(Boolean)
    .map(normalizePath);

  return sitePaths.some(
    (sitePath) => itemPath === sitePath || itemPath.startsWith(`${sitePath}/`)
  );
}
