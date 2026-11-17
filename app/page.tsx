import Image from "next/image";
import Link from "next/link";
import QRCode from "qrcode";

const CHAT_URL = "https://lingua-desk-one.vercel.app/chat"; // what the QR code opens

const LANGUAGES = ["English", "Español", "हिन्दी", "தமிழ்", "العربية"];

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
    <main className="min-h-screen bg-white text-gray-900">
      <section className="mx-auto max-w-4xl px-6 py-16 text-center">
        <p className="text-sm font-semibold uppercase tracking-wide text-indigo-600">LinguaDesk</p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">
          Sell to customers in any language, while you only write English.
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-gray-600">
          Live support chat for small shops. An AI assistant answers common questions instantly, and you step in with
          translated, number-checked replies when a person is needed.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link href="/chat" className="rounded-full bg-indigo-600 px-6 py-3 font-medium text-white hover:bg-indigo-700">
            Try the customer chat
          </Link>
          <Link href="/owner" className="rounded-full border border-gray-300 px-6 py-3 font-medium text-gray-800 hover:bg-gray-50">
            Open the shop owner view
          </Link>
        </div>
        <p className="mt-6 text-sm text-gray-500">Tested in</p>
        <div className="mt-2 flex flex-wrap justify-center gap-2">
          {LANGUAGES.map((language) => (
            <span key={language} className="rounded-full bg-indigo-50 px-3 py-1 text-sm text-indigo-700">
              {language}
            </span>
          ))}
        </div>
      </section>

      <section className="bg-gray-50 px-6 py-14">
        <div className="mx-auto grid max-w-4xl gap-6 sm:grid-cols-3">
          {STEPS.map((step, i) => (
            <div key={step.title} className="rounded-lg bg-white p-5 shadow-sm">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-600 text-sm font-semibold text-white">
                {i + 1}
              </span>
              <h2 className="mt-3 font-semibold">{step.title}</h2>
              <p className="mt-1 text-sm text-gray-600">{step.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto grid max-w-4xl items-center gap-10 px-6 py-14 sm:grid-cols-2">
        <div>
          <h2 className="text-2xl font-bold">Built so the AI cannot cost you a sale</h2>
          <ul className="mt-4 space-y-3 text-gray-700">
            {SAFEGUARDS.map((item) => (
              <li key={item} className="flex gap-2">
                <span className="text-indigo-600">&#10003;</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="text-center">
          <Image src={qr} alt="QR code that opens the LinguaDesk demo chat" width={220} height={220} unoptimized className="mx-auto" />
          <p className="mt-2 text-sm text-gray-500">Scan to chat with the demo shop on your phone</p>
        </div>
      </section>

      <footer className="border-t border-gray-200 px-6 py-6 text-center text-sm text-gray-500">
        Built for the Nexconn Build Challenge 2026 with Nexconn Chat, Gemini and Next.js. The demo shop is fictional.
      </footer>
    </main>
  );
}
