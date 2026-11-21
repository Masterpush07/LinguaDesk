import type { Metadata } from "next";
import Link from "next/link";
import PrivacyControls from "@/components/platform/privacy/PrivacyControls";
import SiteFooter from "@/components/platform/SiteFooter";
import { PageHeading } from "@/components/platform/ui";

export const metadata: Metadata = { title: "Privacy | LinguaDesk" };

const H2 = "font-heading text-xl font-semibold tracking-tight text-slate-900";

// Plain language on purpose. It describes what this prototype really does; it is not legal advice.
export default function PrivacyPage() {
  return (
    <main>
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
        <PageHeading title="Your privacy" subtitle="What LinguaDesk keeps about you, who can see it, and how to take it back. No account is needed to shop, and none is created." />

        <div className="space-y-8 text-sm leading-relaxed text-slate-700">
          <section aria-labelledby="p-what" data-testid="privacy-what">
            <h2 id="p-what" className={H2}>What is kept</h2>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>Your messages with a shop and its AI assistant, with the translation of each one.</li>
              <li>When you place an order: the items, the total and the delivery address and phone number you typed.</li>
              <li>Photos you add to a message or a return request, and the text of reviews and returns.</li>
              <li>If you ask for them: an email address for reply alerts, and a push-alert subscription for this browser.</li>
              <li>A random guest id in a cookie, so your conversations are there when you come back. It is not your name and it is not shared with advertisers. There is no tracking or advertising.</li>
            </ul>
          </section>

          <section aria-labelledby="p-who">
            <h2 id="p-who" className={H2}>Who can see it</h2>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>The shop you talk to sees your conversation, your orders and your delivery address. Other shops see none of it.</li>
              <li>LinguaDesk never handles your money. You pay the shop directly through the payment link it gives you.</li>
              <li>Photos are private. Only you and the shop you sent them to can open them.</li>
            </ul>
          </section>

          <section aria-labelledby="p-services">
            <h2 id="p-services" className={H2}>Services that process your messages</h2>
            <p className="mt-2">LinguaDesk is built on free services, and your message text passes through them to work:</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>
                <strong>Nexconn</strong> delivers chat messages. It keeps its own copy under its own retention rules.
              </li>
              <li>
                <strong>Google Gemini and Groq</strong> translate messages and write the assistant&apos;s answers. On free plans these providers may keep or use text under their own terms, so please do not share card numbers, passwords or other sensitive details in a chat.
              </li>
              <li>
                <strong>Neon</strong> stores the data, <strong>Vercel</strong> runs the site and <strong>Brevo</strong> sends alert emails if you asked for them.
              </li>
            </ul>
          </section>

          <section aria-labelledby="p-controls" data-testid="privacy-controls-section">
            <h2 id="p-controls" className={H2}>Your choices</h2>
            <p className="mt-2 mb-4">These act on the guest identity of the browser you are using. If you used a one-time link to open your chats on another device, that device shares the same identity.</p>
            <PrivacyControls />
          </section>

          <section aria-labelledby="p-delete">
            <h2 id="p-delete" className={H2}>What deleting does and does not do</h2>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>
                <strong>Deleted:</strong> your conversations and messages, uploaded photos, delivery addresses, review and return text, alert email and push alerts.
              </li>
              <li>
                <strong>Kept by the shop:</strong> a record of each order (items, total, status, courier) and the star rating of a review, with no name, address or message attached. Shops need these for their own accounts.
              </li>
              <li>
                <strong>Not in our reach:</strong> copies held by Nexconn and the AI providers follow their own retention rules. Messages already sent to them cannot be recalled by LinguaDesk.
              </li>
            </ul>
          </section>

          <p className="rounded-xl bg-slate-50 p-4 text-xs text-slate-500">
            LinguaDesk is a prototype built for the Nexconn Build Challenge 2026. This page describes how it behaves and is not legal advice. Questions about an order go to the shop in your conversation; <Link href="/chats" className="text-indigo-700 underline underline-offset-2">open your conversations</Link>.
          </p>
        </div>
      </div>
      <SiteFooter />
    </main>
  );
}
