// Public tracking pages of well known couriers. Any other courier falls back to 17TRACK, which looks up most carriers.

const TEMPLATES: { match: RegExp; url: (n: string) => string }[] = [
  { match: /\bdhl\b/, url: (n) => `https://www.dhl.com/global-en/home/tracking/tracking-express.html?submit=1&tracking-id=${n}` },
  { match: /\bfed\s?ex\b/, url: (n) => `https://www.fedex.com/fedextrack/?trknbr=${n}` },
  { match: /\bups\b|united parcel/, url: (n) => `https://www.ups.com/track?tracknum=${n}` },
  { match: /\busps\b|united states postal/, url: (n) => `https://tools.usps.com/go/TrackConfirmAction?tLabels=${n}` },
  { match: /india\s?post|speed\s?post/, url: (n) => `https://www.indiapost.gov.in/_layouts/15/dop.portal.tracking/trackconsignment.aspx?consignmentnumber=${n}` },
  { match: /blue\s?dart/, url: (n) => `https://www.bluedart.com/tracking?trackFor=0&trackingNo=${n}` },
  { match: /\bdtdc\b/, url: (n) => `https://www.dtdc.in/tracking.asp?strCnno=${n}` },
  { match: /delhivery/, url: (n) => `https://www.delhivery.com/track-v2/package/${n}` },
  { match: /japan\s?post/, url: (n) => `https://trackings.post.japanpost.jp/services/srv/search/?requestNo1=${n}&search.x=1&search.y=1&locale=en` },
  { match: /royal\s?mail/, url: (n) => `https://www.royalmail.com/track-your-item#/tracking-results/${n}` },
  { match: /aramex/, url: (n) => `https://www.aramex.com/track/results?mode=0&ShipmentNumber=${n}` },
  { match: /\bems\b|express\s?mail/, url: (n) => `https://www.ems.post/en/global-network/tracking?mailNumber=${n}` },
  { match: /canada\s?post/, url: (n) => `https://www.canadapost-postescanada.ca/track-reperage/en#/search?searchFor=${n}` },
];

export function trackingUrl(courier: string | null, number: string | null): string | null {
  const n = number?.trim();
  if (!n) return null;
  const encoded = encodeURIComponent(n);
  const name = (courier ?? "").toLowerCase();
  const known = TEMPLATES.find((t) => t.match.test(name));
  return known ? known.url(encoded) : `https://t.17track.net/en#nums=${encoded}`;
}
