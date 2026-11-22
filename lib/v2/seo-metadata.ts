import type { Metadata } from "next";
import { clip } from "@/lib/site";
import { productPath, storefrontPath } from "@/lib/v2/seller-paths";

// Titles, descriptions and share previews come from the seller record, and the canonical address from the slug stored on it.
type ShopMeta = { slug: string; name: string; text: string; country: string; imageUrl: string | null; listed?: boolean };
type ProductMeta = { id: string; slug: string; name: string; description: string; priceUsd: number; imageUrl: string | null; shopName: string; listed?: boolean };

// Shops kept out of the marketplace (see visibility.ts) also ask search engines not to index their pages.
const NO_INDEX: Metadata = { robots: { index: false, follow: false } };

function build(title: string, description: string, canonical: string, imageUrl: string | null): Metadata {
  return {
    title,
    description,
    alternates: { canonical },
    openGraph: { title, description, url: canonical, type: "website", siteName: "LinguaDesk", ...(imageUrl ? { images: [imageUrl] } : {}) },
    twitter: { card: imageUrl ? "summary_large_image" : "summary", title, description },
  };
}

export function storefrontMetadata(shop: ShopMeta): Metadata {
  const description = clip(shop.text || `A shop in ${shop.country} on LinguaDesk. Ask your questions in your own language.`);
  return { ...build(`${shop.name} · LinguaDesk`, description, storefrontPath(shop.slug), shop.imageUrl), ...(shop.listed === false ? NO_INDEX : {}) };
}

export function productMetadata(item: ProductMeta): Metadata {
  const price = `USD ${item.priceUsd.toFixed(2)}`;
  const description = clip(item.description ? `${item.description} ${price}.` : `${item.name} from ${item.shopName}. ${price}.`);
  return { ...build(`${item.name} · ${item.shopName} · LinguaDesk`, description, productPath(item.slug, item.id), item.imageUrl), ...(item.listed === false ? NO_INDEX : {}) };
}
