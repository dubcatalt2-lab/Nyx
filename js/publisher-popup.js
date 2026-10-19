import { publisherHostAllowed, publisherMode } from "./publisher-config.js";

const key = "n7x.publisher.home.v1";
const period = 4 * 60 * 1000;
const destination = "https://asiafilm.org/4/4e423fea224eac7374c037f143e080e3";
if (publisherHostAllowed() && navigator.locks) {
  document.addEventListener(
    "click",
    (event) => {
      if (
        !event.isTrusted ||
        event.button !== 0 ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey ||
        event.altKey
      )
        return;
      if (
        event.target.closest("a,button,input,textarea,select,[contenteditable],.n7x-home-sponsor")
      )
        return;
      const home = event.target.closest(".q4f959b063679fe3afa.n7x-minimal-home:not(.hidden)");
      if (!home || window.__nyxPublisherHome?.() !== home || publisherMode() === "off") return;
      void navigator.locks
        .request("n7x.publisher.home", { ifAvailable: true }, (lock) => {
          if (
            !lock ||
            !navigator.userActivation?.isActive ||
            window.__nyxPublisherHome?.() !== home ||
            publisherMode() === "off"
          )
            return;
          try {
            const now = Date.now(),
              saved = localStorage.getItem(key);
            const history = JSON.parse(saved || "[]");
            if (!Array.isArray(history) || history.some((t) => !Number.isFinite(t) || t < 0))
              return;
            const recent = history.filter((t) => now - t < period);
            if (recent.length >= 2 || recent.some((t) => now - t < 1000)) return;
            const open = window.__nyxNativeOpen || window.open.bind(window);
            const popup = open("about:blank", "_blank");
            if (!popup) return;
            popup.opener = null;
            const referrer = popup.document.createElement("meta");
            referrer.name = "referrer";
            referrer.content = "no-referrer";
            popup.document.head.append(referrer);
            localStorage.setItem(key, JSON.stringify([...recent, now]));
            popup.location.replace(destination);
          } catch {}
        })
        .catch(() => {});
    },
    { capture: true },
  );
}
