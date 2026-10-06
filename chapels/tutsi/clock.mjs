export function startClock(clock, calendar) {
  const digits = [];
  for (let index = 0; index < 6; index++) {
    if (index === 2 || index === 4) {
      const colon = document.createElement("span");
      colon.className = "clock-colon";
      colon.textContent = ":";
      colon.setAttribute("aria-hidden", "true");
      clock.append(colon);
    }
    const card = document.createElement("span");
    card.className = "clock-digit";
    card.setAttribute("aria-hidden", "true");
    for (const name of ["top", "bottom", "flip-top", "flip-bottom"]) {
      const half = document.createElement("span");
      half.className = "digit-" + name;
      const number = document.createElement("span");
      half.append(number);
      card.append(half);
    }
    card.addEventListener("animationend", (event) => {
      if (event.animationName === "tutsi-flip-bottom") {
        card.classList.remove("flipping");
        card.querySelector(".digit-bottom span").textContent =
          card.dataset.value;
      }
    });
    digits.push(card);
    clock.append(card);
  }
  const period = document.createElement("span");
  period.className = "clock-period";
  period.setAttribute("aria-hidden", "true");
  clock.append(period);
  function update() {
    const now = new Date();
    const value =
      String(now.getHours() % 12 || 12).padStart(2, "0") +
      String(now.getMinutes()).padStart(2, "0") +
      String(now.getSeconds()).padStart(2, "0");
    const reduced =
      document.documentElement.dataset.motion === "reduce" ||
      matchMedia("(prefers-reduced-motion: reduce)").matches;
    value.split("").forEach((number, index) => {
      const card = digits[index],
        previous = card.dataset.value;
      if (reduced || document.hidden) {
        card.classList.remove("flipping");
        card.querySelector(".digit-bottom span").textContent = number;
      }
      if (previous === number) return;
      card.classList.remove("flipping");
      card.dataset.value = number;
      card.querySelector(".digit-top span").textContent = number;
      card.querySelector(".digit-bottom span").textContent = previous || number;
      card.querySelector(".digit-flip-top span").textContent =
        previous || number;
      card.querySelector(".digit-flip-bottom span").textContent = number;
      if (previous && !reduced && !document.hidden) {
        void card.offsetWidth;
        card.classList.add("flipping");
      } else card.querySelector(".digit-bottom span").textContent = number;
    });
    period.textContent = now.getHours() >= 12 ? "PM" : "AM";
    clock.dateTime = now.toISOString();
    clock.setAttribute("aria-label", now.toLocaleTimeString());
    calendar.textContent = now.toLocaleDateString([], {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  }
  update();
  const timer = setInterval(() => {
    if (!document.hidden) update();
  }, 1000);
  document.addEventListener("visibilitychange", update);
  return () => {
    clearInterval(timer);
    document.removeEventListener("visibilitychange", update);
  };
}
