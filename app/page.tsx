import Image from "next/image";
import Link from "next/link";
import QRCode from "qrcode";
import ThemeToggle from "@/components/ThemeToggle";

const CHAT_URL = "https://lingua-desk-one.vercel.app/chat"; // what the QR code opens

// Every language here was run end to end: customer question, AI answer, English translation, owner reply.
const LANGUAGES = ["English", "Español", "Português", "Français", "Русский", "हिन्दी", "தமிழ்", "ಕನ್ನಡ", "العربية", "中文", "日本語", "한국어"];

const STEPS = [
  { title: "Customer writes in their language", text: "No signup. They open a link or scan a QR code and ask about prices, shipping or returns." },
  { title: "AI answers from your shop info", text: "It replies in the customer's language using only facts you gave it, and hands over to you when it is unsure." },
  { title: "You reply in English", text: "You read an English translation, type in English, and the customer receives their own language." },
];

const SAFEGUARDS = [
  "Prices, dates and quantities are checked in code, so a wrong number is never sent to a customer.",
  "Orders, complaints and price negotiation always go to you, not the AI.",
  "Every AI message is labelled, and the AI stops talking once you join the chat.",
];

// Cached because the URL never changes; uncached async work would block prerendering the page.
async function chatQrCode() {
  "use cache";
  return QRCode.toDataURL(CHAT_URL, { width: 220, margin: 1 });
}

// Public landing page: explains the product in a few seconds and sends visitors to the live demo.
export default async function Home() {
  const qr = await chatQrCode();

  return (
    <main className="min-h-screen bg-surface text-ink">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
        <span className="text-lg font-bold tracking-tight">LinguaDesk</span>
        <nav className="flex items-center gap-1 text-sm">
          <Link href="/owner" className="rounded-full px-3 py-1.5 font-medium text-ink-2 hover:bg-surface-3 hover:text-ink">
            Owner view
          </Link>
          <ThemeToggle />
        </nav>
      </header>

      <section className="mx-auto max-w-4xl px-6 pb-16 pt-10 text-center">
        <p className="inline-block rounded-full bg-brand-soft px-3 py-1 text-xs font-semibold text-brand-ink">
          Multilingual support chat for small shops
        </p>
        <h1 className="mt-5 text-4xl font-bold tracking-tight sm:text-5xl">
          Sell to customers in any language, while you only write English.
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-ink-2">
          An AI assistant answers common questions instantly. When a person is needed, you step in with translated,
          number-checked replies.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link href="/chat" className="rounded-full bg-brand px-6 py-3 font-medium text-white shadow-sm hover:bg-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:ring-offset-2 focus-visible:ring-offset-surface">
            Try the customer chat
          </Link>
          <Link href="/owner" className="rounded-full border border-line px-6 py-3 font-medium text-ink hover:bg-surface-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60">
            Open the shop owner view
          </Link>
        </div>
        <p className="mt-8 text-sm text-ink-2">Tested in {LANGUAGES.length} languages</p>
        <div className="mx-auto mt-3 flex max-w-2xl flex-wrap justify-center gap-2">
          {LANGUAGES.map((language) => (
            <span key={language} className="rounded-full bg-brand-soft px-3 py-1 text-sm text-brand-ink">
              {language}
            </span>
          ))}
        </div>
      </section>

      <section className="bg-surface-2 px-6 py-14">
        <div className="mx-auto grid max-w-4xl gap-6 sm:grid-cols-3">
          {STEPS.map((step, i) => (
            <div key={step.title} className="rounded-2xl bg-surface p-5 ring-1 ring-line">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand text-sm font-semibold text-white">{i + 1}</span>
              <h2 className="mt-3 font-semibold">{step.title}</h2>
              <p className="mt-1 text-sm text-ink-2">{step.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto grid max-w-4xl items-center gap-10 px-6 py-14 sm:grid-cols-2">
        <div>
          <h2 className="text-2xl font-bold">Built so the AI cannot cost you a sale</h2>
          <ul className="mt-4 space-y-3 text-ink-2">
            {SAFEGUARDS.map((item) => (
              <li key={item} className="flex gap-2">
                <span className="text-brand">&#10003;</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="text-center">
          {/* The code stays on white in dark mode, because scanners need dark-on-light contrast. */}
          <div className="mx-auto inline-block rounded-2xl bg-white p-3 ring-1 ring-line">
            <Image src={qr} alt="QR code that opens the LinguaDesk demo chat" width={200} height={200} unoptimized />
          </div>
          <p className="mt-3 text-sm text-ink-2">Scan to chat with the demo shop on your phone</p>
        </div>
      </section>

      <footer className="border-t border-line px-6 py-6 text-center text-sm text-ink-3">
        Built for the Nexconn Build Challenge 2026 with Nexconn Chat, Gemini and Next.js. The demo shop is fictional.
      </footer>
    </main>
  );
}
