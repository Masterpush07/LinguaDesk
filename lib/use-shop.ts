"use client";

import { useEffect, useState } from "react";
import type { ShopData } from "@/lib/shop-data";

// Loads the shop's public info once. It is null while loading or if the request fails, so callers must handle that.
export function useShop(): ShopData | null {
  const [shop, setShop] = useState<ShopData | null>(null);
  useEffect(() => {
    let alive = true;
    fetch("/api/shop")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (alive && data) setShop(data as ShopData);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  return shop;
}
