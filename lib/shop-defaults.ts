import type { ShopData } from "@/lib/shop-data";

// The demo shop everyone sees first. It is written broadly on purpose, so a stranger's first few questions
// (colours, sizes, shipping abroad, returns, gifts, custom orders, discounts) can be answered without a handoff.
export const DEFAULT_SHOP: ShopData = {
  name: "Lotus Handloom",
  tagline:
    "Hand-woven cotton sarees, scarves and home textiles, made by weaver families in Tamil Nadu, India. This is a demo shop.",
  location: "Tamil Nadu, India",
  hours: "9:00 to 18:00 India time, Monday to Saturday",
  contact:
    "This chat is our only support channel. Orders are confirmed here by a team member.",
  products: [
    {
      id: "cotton-saree",
      name: "Cotton saree",
      description:
        "Soft everyday handloom cotton saree with a woven border, 5.5 metres long, with an unstitched blouse piece.",
      price: 45,
      colors: ["indigo blue", "mustard yellow", "maroon", "forest green"],
      sizes: ["5.5 metres, one size"],
      inStock: true,
    },
    {
      id: "silk-cotton-saree",
      name: "Silk-cotton saree",
      description:
        "Silk and cotton blend with a zari border. Shinier and lighter than pure cotton, popular for festivals and weddings.",
      price: 78,
      colors: ["maroon", "royal blue", "emerald green", "peach"],
      sizes: ["5.5 metres, one size"],
      inStock: true,
    },
    {
      id: "scarf",
      name: "Scarf",
      description: "Lightweight handloom cotton scarf, 70 cm by 180 cm.",
      price: 18,
      colors: ["indigo blue", "sky blue", "red", "grey", "mustard yellow"],
      sizes: ["70 cm by 180 cm"],
      inStock: true,
    },
    {
      id: "tote-bag",
      name: "Tote bag",
      description:
        "Sturdy handloom cotton tote bag with an inner pocket and a zip.",
      price: 12,
      colors: ["natural beige", "indigo blue", "black"],
      sizes: ["38 cm wide by 40 cm tall"],
      inStock: true,
    },
    {
      id: "cushion-cover",
      name: "Cushion cover",
      description:
        "Handloom cotton cushion cover with a hidden zip, fits a standard 40 cm by 40 cm cushion. Cushion not included.",
      price: 9,
      colors: ["indigo blue", "terracotta", "natural beige"],
      sizes: ["40 cm by 40 cm"],
      inStock: true,
    },
    {
      id: "table-runner",
      name: "Table runner",
      description:
        "Handloom cotton table runner with fringed ends, 35 cm by 150 cm.",
      price: 15,
      colors: ["natural beige", "mustard yellow"],
      sizes: ["35 cm by 150 cm"],
      inStock: false,
    },
  ],
  shipping: {
    freeAbove: 60,
    fee: 6,
    worldwideDays: "5 to 7 business days",
    domesticDays: "2 to 3 business days inside India",
    notes:
      "Orders are packed within 1 to 2 business days. A tracking link is sent in this chat when the parcel ships. Import duties and taxes, if any, are paid by the buyer.",
  },
  policies: {
    returns:
      "Returns are accepted within 14 days of delivery for unused items in original condition. The buyer pays return shipping. Refunds go back to the original payment method within 7 business days of receiving the return.",
    payment:
      "Card or UPI. After you confirm an order, a team member sends a payment link in this chat. No payment is taken inside the chat itself.",
    customOrders:
      "Custom colours or sizes are possible for orders of 5 or more pieces and take about 3 weeks. A team member must confirm availability and price, so please ask in the chat.",
    discounts:
      "Prices are fixed and there is no bargaining. Orders above $60 ship free.",
    giftWrap:
      "Gift wrapping is free. Tell us in the chat and add a short message if you like.",
    care: "Hand wash in cold water with mild soap, dry in the shade and iron on medium heat. Colours may bleed slightly in the first wash.",
  },
  faqs: [
    {
      q: "Are the products really handmade?",
      a: "Yes. Every piece is hand-woven on a handloom by weaver families in Tamil Nadu.",
    },
    {
      q: "How do I place an order?",
      a: "Tell us what you would like in this chat. A team member sends an order card with the total, and you confirm it with one tap.",
    },
    {
      q: "Can I cancel an order?",
      a: "Yes, before it ships. Tell us in this chat as soon as possible.",
    },
    {
      q: "Do you ship to the US, UK and Europe?",
      a: "Yes, we ship worldwide. Delivery takes 5 to 7 business days.",
    },
    {
      q: "Which languages can I write in?",
      a: "Any language. We reply in the language you write in.",
    },
    {
      q: "How do I track my parcel?",
      a: "A tracking link is sent in this chat when your parcel ships.",
    },
  ],
};
