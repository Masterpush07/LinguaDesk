import { Tag } from "lucide-react";
import type { BuyerSelection } from "@/lib/v2/buyer-types";

// What the buyer picked on the product page, shown next to the product so both sides see the same details.
export default function SelectionChip({ selection }: { selection: BuyerSelection }) {
  const parts = [selection.colour, selection.qty ? `quantity ${selection.qty}` : null].filter(Boolean);
  if (parts.length === 0) return null;
  return (
    <p
      data-testid="chat-selection-chip"
      className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-800 ring-1 ring-indigo-100"
    >
      <Tag className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span className="truncate">Your selection: {parts.join(", ")}</span>
    </p>
  );
}
