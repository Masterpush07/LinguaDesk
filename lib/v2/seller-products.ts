import type { Check } from "@/lib/v2/seller-api";
import { iso, LIMITS } from "@/lib/v2/seller-api";
import type { ProductDto } from "@/lib/v2/seller-types";

type Row = Record<string, unknown>;

export function productDto(r: Row): ProductDto {
  return {
    id: r.id as string,
    name: r.name as string,
    description: r.description as string,
    category: r.category as string,
    priceUsd: r.price_usd as number,
    colors: r.colors as string[],
    sizes: r.sizes as string[],
    stock: r.stock as number,
    imageUrl: (r.image_url as string | null) ?? null,
    active: r.active as boolean,
    updatedAt: iso(r.updated_at) ?? "",
  };
}

export type ProductInput = Omit<ProductDto, "id" | "updatedAt">;

// Validates a full product. PATCH merges the stored row with the changes first, so both paths share these limits.
export function checkProduct(input: Record<string, unknown>, check: Check): ProductInput {
  return {
    name: check.text(input.name, "Product name", LIMITS.productName, true),
    description: check.text(input.description, "Description", LIMITS.productDescription),
    category: check.text(input.category, "Category", LIMITS.productCategory),
    priceUsd: check.whole(input.priceUsd, "Price", 1, 10000),
    colors: check.words(input.colors, "Colours", 8, 40),
    sizes: check.words(input.sizes, "Sizes", 8, 40),
    stock: check.whole(input.stock, "Stock", 0, 100000),
    imageUrl: check.imageUrl(input.imageUrl),
    active: input.active === undefined ? true : input.active === true,
  };
}
