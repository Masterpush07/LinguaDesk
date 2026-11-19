import { DM_Sans, JetBrains_Mono, Plus_Jakarta_Sans } from "next/font/google";
import type { CSSProperties, ReactNode } from "react";

const jakarta = Plus_Jakarta_Sans({ variable: "--font-jakarta", subsets: ["latin"] });
const dmSans = DM_Sans({ variable: "--font-dm-sans", subsets: ["latin"] });
const jetbrains = JetBrains_Mono({ variable: "--font-jetbrains", subsets: ["latin"] });

// Prototype screens (marketplace, agent desk, seller studio) share these fonts. The original /, /chat and /owner pages are untouched.
export default function PlatformLayout({ children }: { children: ReactNode }) {
  const vars = {
    "--font-geist-sans": "var(--font-dm-sans)",
    "--font-geist-mono": "var(--font-jetbrains)",
  } as CSSProperties;
  return (
    <div className={`${jakarta.variable} ${dmSans.variable} ${jetbrains.variable} font-sans`} style={vars}>
      {children}
    </div>
  );
}
