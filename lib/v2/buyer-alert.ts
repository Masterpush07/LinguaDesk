import nodemailer, { type Transporter } from "nodemailer";
import { db } from "@/lib/db";
import { isLimited, recordEvent } from "@/lib/rate-limit";
import { sendToBuyer, type PushPayload } from "@/lib/v2/push";

// Server-only. The rules for telling a buyer who has left the chat that something happened, applied in front of the browser
// popup (lib/v2/push.ts) and the email channel. The email never contains the message itself, only that something is waiting.
// A failure here is logged and swallowed, because an alert must never break the shop's own action.

export type AlertKind = "reply" | "order" | "shipped" | "delivered" | "return";

const SITE = process.env.SITE_URL ?? "https://lingua-desk-one.vercel.app";
const AWAY_MINUTES = 2; // the chat page refreshes every few seconds while open, so older than this means the buyer left
const PER_KIND_MINUTES = 10; // at most one alert per buyer, kind and conversation or order in this window

type Copy = Record<AlertKind, string> & { open: string; stop: string; confirmSubject: string; confirmLine: string };

// Fixed wording in the 10 supported languages. {shop} is replaced with the shop's name.
const COPY: Record<string, Copy> = {
  en: { reply: "{shop} replied to you", order: "{shop} sent you an order to confirm", shipped: "Your order from {shop} has shipped", delivered: "Your order from {shop} was delivered", return: "{shop} updated your return request", open: "Open LinguaDesk to read it.", stop: "Stop these emails", confirmSubject: "Confirm your email", confirmLine: "Confirm this address to get an email when a shop replies to you:" },
  es: { reply: "{shop} te ha respondido", order: "{shop} te envió un pedido para confirmar", shipped: "Tu pedido de {shop} ha sido enviado", delivered: "Tu pedido de {shop} fue entregado", return: "{shop} actualizó tu solicitud de devolución", open: "Abre LinguaDesk para leerlo.", stop: "Dejar de recibir estos correos", confirmSubject: "Confirma tu correo", confirmLine: "Confirma esta dirección para recibir un correo cuando una tienda te responda:" },
  ja: { reply: "{shop}から返信がありました", order: "{shop}から確認待ちの注文が届きました", shipped: "{shop}のご注文を発送しました", delivered: "{shop}のご注文が配達されました", return: "{shop}が返品リクエストを更新しました", open: "LinguaDeskを開いて内容を確認してください。", stop: "このメールの配信を停止", confirmSubject: "メールアドレスの確認", confirmLine: "ショップから返信があったときにメールを受け取るには、次のリンクで確認してください：" },
  hi: { reply: "{shop} ने आपको जवाब दिया", order: "{shop} ने आपको पुष्टि के लिए ऑर्डर भेजा है", shipped: "{shop} से आपका ऑर्डर भेज दिया गया है", delivered: "{shop} से आपका ऑर्डर पहुँच गया है", return: "{shop} ने आपके रिटर्न अनुरोध को अपडेट किया", open: "पढ़ने के लिए LinguaDesk खोलें।", stop: "ये ईमेल बंद करें", confirmSubject: "अपना ईमेल पुष्ट करें", confirmLine: "जब कोई दुकान जवाब दे तो ईमेल पाने के लिए इस पते की पुष्टि करें:" },
  ar: { reply: "{shop} ردّ عليك", order: "أرسل لك {shop} طلبًا للتأكيد", shipped: "تم شحن طلبك من {shop}", delivered: "تم تسليم طلبك من {shop}", return: "حدّث {shop} طلب الإرجاع الخاص بك", open: "افتح LinguaDesk للقراءة.", stop: "إيقاف هذه الرسائل", confirmSubject: "أكّد بريدك الإلكتروني", confirmLine: "أكّد هذا العنوان لتصلك رسالة عندما يردّ عليك متجر:" },
  fr: { reply: "{shop} vous a répondu", order: "{shop} vous a envoyé une commande à confirmer", shipped: "Votre commande de {shop} a été expédiée", delivered: "Votre commande de {shop} a été livrée", return: "{shop} a mis à jour votre demande de retour", open: "Ouvrez LinguaDesk pour la lire.", stop: "Ne plus recevoir ces e-mails", confirmSubject: "Confirmez votre e-mail", confirmLine: "Confirmez cette adresse pour recevoir un e-mail quand une boutique vous répond :" },
  ta: { reply: "{shop} உங்களுக்குப் பதிலளித்தது", order: "{shop} உறுதிசெய்ய ஒரு ஆர்டரை அனுப்பியுள்ளது", shipped: "{shop} இலிருந்து உங்கள் ஆர்டர் அனுப்பப்பட்டது", delivered: "{shop} இலிருந்து உங்கள் ஆர்டர் டெலிவரி செய்யப்பட்டது", return: "{shop} உங்கள் திருப்பி அனுப்பும் கோரிக்கையைப் புதுப்பித்தது", open: "படிக்க LinguaDesk ஐத் திறக்கவும்.", stop: "இந்த மின்னஞ்சல்களை நிறுத்து", confirmSubject: "உங்கள் மின்னஞ்சலை உறுதிசெய்யவும்", confirmLine: "ஒரு கடை பதிலளிக்கும்போது மின்னஞ்சல் பெற இந்த முகவரியை உறுதிசெய்யவும்:" },
  pt: { reply: "{shop} respondeu a você", order: "{shop} enviou um pedido para você confirmar", shipped: "Seu pedido de {shop} foi enviado", delivered: "Seu pedido de {shop} foi entregue", return: "{shop} atualizou seu pedido de devolução", open: "Abra o LinguaDesk para ler.", stop: "Parar de receber estes e-mails", confirmSubject: "Confirme seu e-mail", confirmLine: "Confirme este endereço para receber um e-mail quando uma loja responder:" },
  ko: { reply: "{shop}에서 답장이 왔습니다", order: "{shop}에서 확인할 주문을 보냈습니다", shipped: "{shop}의 주문이 발송되었습니다", delivered: "{shop}의 주문이 배송 완료되었습니다", return: "{shop}에서 반품 요청을 업데이트했습니다", open: "LinguaDesk를 열어 확인하세요.", stop: "이 이메일 수신 중지", confirmSubject: "이메일 확인", confirmLine: "상점이 답장하면 이메일을 받으려면 이 주소를 확인하세요:" },
  zh: { reply: "{shop} 回复了你", order: "{shop} 向你发送了待确认的订单", shipped: "你在 {shop} 的订单已发货", delivered: "你在 {shop} 的订单已送达", return: "{shop} 更新了你的退货申请", open: "打开 LinguaDesk 查看内容。", stop: "停止接收这些邮件", confirmSubject: "确认你的邮箱", confirmLine: "确认此邮箱地址，以便在商店回复你时收到邮件：" },
};

const copyFor = (language: string | null | undefined): Copy => COPY[language ?? ""] ?? COPY.en;
export const isSupportedLanguage = (language: unknown): language is string => typeof language === "string" && language in COPY;

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);

export const emailConfigured = () => Boolean(process.env.BREVO_SMTP_LOGIN && process.env.BREVO_SMTP_KEY && process.env.BREVO_SENDER);

let transport: Transporter | null = null;
function mailer() {
  transport ??= nodemailer.createTransport({
    host: "smtp-relay.brevo.com",
    port: 587,
    secure: false, // the connection is upgraded with STARTTLS
    auth: { user: process.env.BREVO_SMTP_LOGIN, pass: process.env.BREVO_SMTP_KEY },
  });
  return transport;
}

async function sendMail(to: string, subject: string, lines: string[], links: { url: string; label: string }[]) {
  const text = [...lines, ...links.map((l) => `${l.label}: ${l.url}`)].join("\n\n");
  const html = `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.5;color:#0f172a">${lines.map((l) => `<p>${escapeHtml(l)}</p>`).join("")}${links
    .map((l) => `<p><a href="${escapeHtml(l.url)}">${escapeHtml(l.label)}</a></p>`)
    .join("")}</div>`;
  await mailer().sendMail({ from: `"LinguaDesk" <${process.env.BREVO_SENDER}>`, to, subject, text, html });
}

// First step of double opt-in: nothing is sent to an address until its owner clicks this link.
export async function sendConfirmEmail(email: string, token: string, origin: string, language: string) {
  const copy = copyFor(language);
  await sendMail(email, copy.confirmSubject, [copy.confirmLine], [{ url: `${origin}/api/buyer/notify/confirm?token=${token}`, label: copy.confirmSubject }]);
}

type Alert = {
  buyerId: string;
  kind: AlertKind;
  ref: string; // the conversation or order this is about, so each one is limited separately
  shopName: string;
  path: string; // where the buyer should land, e.g. /chat/lotus-handloom
  push: PushPayload; // exactly what the browser popup should say
  language?: string | null;
};

// Called after a team reply, an order card, a shipped or delivered notice, or a return update has reached the buyer.
export async function alertBuyer(a: Alert): Promise<void> {
  try {
    const sql = db();
    const [buyer] = await sql`SELECT language, (last_seen IS NOT NULL AND last_seen > now() - make_interval(mins => ${AWAY_MINUTES})) AS present FROM buyers WHERE id = ${a.buyerId}`;
    if (!buyer || buyer.present) return;

    const key = `ping:${a.buyerId}:${a.kind}:${a.ref}`;
    if (await isLimited(key, 1, PER_KIND_MINUTES)) return;
    await recordEvent(key);

    await sendToBuyer(a.buyerId, a.push);

    if (!emailConfigured()) return;
    const [mail] = await sql`SELECT email, token FROM buyer_emails WHERE buyer_id = ${a.buyerId} AND verified_at IS NOT NULL`;
    if (!mail) return;
    const copy = copyFor(a.language ?? buyer.language);
    const title = copy[a.kind].replace("{shop}", () => a.shopName);
    await sendMail(mail.email, title, [title, copy.open], [
      { url: `${SITE}${a.path}`, label: copy.open },
      { url: `${SITE}/api/buyer/notify/unsubscribe?token=${mail.token}`, label: copy.stop },
    ]).catch((err) => console.error("alert email failed:", err instanceof Error ? err.message : err));
  } catch (err) {
    console.error("buyer alert failed:", err instanceof Error ? err.message : err);
  }
}
