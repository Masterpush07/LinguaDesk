export type ShopSummary = {
  slug: string;
  name: string;
  tagline: string;
  country: string;
  languages: string[];
  teamOnline: boolean;
  productCount: number;
  responseTargetMin: number;
};

export type CatalogProduct = {
  id: string;
  name: string;
  description: string;
  category: string;
  priceUsd: number;
  colors: string[];
  sizes: string[];
  stock: number;
  imageUrl: string | null;
};

export type ListedProduct = CatalogProduct & { seller: { slug: string; name: string; country: string } };

export type ShopDetail = {
  seller: {
    slug: string;
    name: string;
    tagline: string;
    about: string;
    country: string;
    languages: string[];
    hours: string;
    shipping: { freeAbove?: number; fee?: number; worldwideDays?: string; domesticDays?: string; notes?: string };
    policies: { returns?: string; payment?: string; customOrders?: string; discounts?: string; giftWrap?: string; care?: string };
    teamOnline: boolean;
    responseTargetMin: number;
  };
  products: CatalogProduct[];
  faqs: { q: string; a: string }[];
};

export type ProductDetail = CatalogProduct & {
  seller: {
    slug: string;
    name: string;
    country: string;
    languages: string[];
    teamOnline: boolean;
    hours: string;
    shipping: ShopDetail["seller"]["shipping"];
    policies: ShopDetail["seller"]["policies"];
  };
};
