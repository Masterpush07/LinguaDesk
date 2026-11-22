import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

// Public pages (marketplace, shops, products) may be listed; private ones (desks, accounts, chats, the API) may not.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/agent", "/seller", "/orders", "/chats", "/chat/", "/profile", "/continue/", "/join", "/recover", "/login"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
