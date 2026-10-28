/**
 * Product inventory rules.
 *
 * `inventoryCount` is NULL when stock is not tracked (unlimited). When it is a
 * number, each new subscription consumes one unit and 0 means sold out.
 */

export function isInStock(inventoryCount: number | null | undefined): boolean {
  return inventoryCount === null || inventoryCount === undefined || inventoryCount > 0;
}

/** Prisma `where` fragment: products a visitor is allowed to see/buy. */
export const publicInStockWhere = {
  OR: [{ inventoryCount: null }, { inventoryCount: { gt: 0 } }],
};

/** Prisma `where` fragment: plans a visitor may see/buy (live and in stock). */
export const publicPlanWhere = {
  isDeleted: false,
  OR: [{ inventoryCount: null }, { inventoryCount: { gt: 0 } }],
};

/** Remove every `inventoryCount` (stock levels are business information) from a response tree. Only plain objects/arrays are walked, so Dates and Decimals pass through. */
export function stripStock<T>(value: T): T {
  if (Array.isArray(value)) return value.map(stripStock) as unknown as T;
  if (value && typeof value === 'object') {
    const proto = Object.getPrototypeOf(value);
    if (proto !== Object.prototype && proto !== null) return value;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (k !== 'inventoryCount') out[k] = stripStock(v);
    }
    return out as T;
  }
  return value;
}

/**
 * Shape a product for an API response. Visitors learn only whether it is
 * available; the exact stock level is business information for admins.
 *
 * Plans: visitors only get plans that are in stock (a sold-out plan disappears), and the
 * product itself counts as unavailable when it has plans but none can be bought.
 */
export function serializeProduct<T extends { inventoryCount: number | null; plans?: Array<{ inventoryCount?: number | null }> }>(product: T, isAdmin: boolean) {
  const { inventoryCount, plans, ...rest } = product;
  const allPlans = plans ?? [];
  const visible = isAdmin ? allPlans : allPlans.filter((p) => isInStock(p.inventoryCount));
  const anyPlanBuyable = allPlans.length === 0 || allPlans.some((p) => isInStock(p.inventoryCount));
  return {
    ...rest,
    ...(plans ? { plans: isAdmin ? visible : visible.map(({ inventoryCount: _hidden, ...p }) => p) } : {}),
    inStock: isInStock(inventoryCount) && anyPlanBuyable,
    ...(isAdmin ? { inventoryCount } : {}),
  };
}
