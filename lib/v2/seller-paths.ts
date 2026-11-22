// The one place that turns a seller slug into a public path, so links never disagree about the address.
export const storefrontPath = (slug: string) => `/s/${encodeURIComponent(slug)}`;
export const productPath = (slug: string, productId: string) => `${storefrontPath(slug)}/p/${encodeURIComponent(productId)}`;
export const chatPath = (slug: string) => `/chat/${encodeURIComponent(slug)}`;
