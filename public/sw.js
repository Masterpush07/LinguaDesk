// LinguaDesk service worker: shows push alerts and opens the right page when one is selected.

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

function readPayload(event) {
  try {
    return event.data ? event.data.json() : {};
  } catch {
    return {};
  }
}

function samePath(a, b) {
  try {
    return new URL(a, self.location.origin).pathname === new URL(b, self.location.origin).pathname;
  } catch {
    return false;
  }
}

self.addEventListener("push", (event) => {
  const payload = readPayload(event);
  const title = typeof payload.title === "string" && payload.title ? payload.title : "LinguaDesk";
  const url = typeof payload.url === "string" && payload.url.startsWith("/") ? payload.url : "/";

  event.waitUntil(
    (async () => {
      // The open conversation already shows the message, so a second alert on top of it would only be noise.
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      if (windows.some((w) => w.visibilityState === "visible" && samePath(w.url, url))) return;
      await self.registration.showNotification(title, {
        body: typeof payload.body === "string" ? payload.body : "",
        tag: typeof payload.tag === "string" ? payload.tag : undefined,
        data: { url },
        icon: "/favicon.ico",
      });
    })(),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const raw = event.notification.data && event.notification.data.url;
  const target = new URL(typeof raw === "string" ? raw : "/", self.location.origin);
  if (target.origin !== self.location.origin) return;

  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const existing = windows.find((w) => new URL(w.url).origin === self.location.origin);
      if (existing) {
        await existing.focus();
        if ("navigate" in existing) await existing.navigate(target.href).catch(() => {});
        return;
      }
      await self.clients.openWindow(target.href);
    })(),
  );
});
