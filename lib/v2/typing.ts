// Typing status between a buyer and a shop. Each side tells the other at most every few seconds, and a status fades if it is not refreshed.
export const TYPING_SEND_MS = 3000;
export const TYPING_SHOWN_MS = 6000;

export function typingThrottle(send: () => void, every = TYPING_SEND_MS, now: () => number = Date.now): () => void {
  let last = -Infinity;
  return () => {
    const t = now();
    if (t - last >= every) {
      last = t;
      send();
    }
  };
}
