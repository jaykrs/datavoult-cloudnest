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

/**
 * Shape a product for an API response. Visitors learn only whether it is
 * available; the exact stock level is business information for admins.
 */
export function serializeProduct<T extends { inventoryCount: number | null }>(product: T, isAdmin: boolean) {
  const { inventoryCount, ...rest } = product;
  return {
    ...rest,
    inStock: isInStock(inventoryCount),
    ...(isAdmin ? { inventoryCount } : {}),
  };
}
