const root = document.documentElement;
const themeButton = document.querySelector(".theme-toggle");
const preferredTheme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
const storedTheme = localStorage.getItem("forgerank-site-theme");

function applyTheme(theme) {
  root.dataset.theme = theme;
  themeButton?.setAttribute(
    "aria-label",
    theme === "dark" ? "Switch to light theme" : "Switch to dark theme",
  );
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", theme === "dark" ? "#10110f" : "#f2eee4");
}

applyTheme(storedTheme === "dark" || storedTheme === "light" ? storedTheme : preferredTheme);

themeButton?.addEventListener("click", () => {
  const nextTheme = root.dataset.theme === "dark" ? "light" : "dark";
  localStorage.setItem("forgerank-site-theme", nextTheme);
  applyTheme(nextTheme);
});

const menuButton = document.querySelector(".menu-toggle");
const navigation = document.querySelector(".site-nav");

menuButton?.addEventListener("click", () => {
  const expanded = menuButton.getAttribute("aria-expanded") === "true";
  menuButton.setAttribute("aria-expanded", String(!expanded));
  navigation?.classList.toggle("is-open", !expanded);
});

navigation?.querySelectorAll("a").forEach((link) => {
  link.addEventListener("click", () => {
    menuButton?.setAttribute("aria-expanded", "false");
    navigation.classList.remove("is-open");
  });
});

const showcaseImage = document.querySelector("#showcase-image");
const showcaseViews = {
  home: {
    src: "assets/home.webp",
    alt: "ForgeRank home dashboard showing repository rankings and discovery",
  },
  momentum: {
    src: "assets/momentum.webp",
    alt: "ForgeRank Momentum Matrix plotting repository popularity against momentum",
  },
  repository: {
    src: "assets/repository.webp",
    alt: "Detailed ForgeRank repository intelligence page",
  },
  developers: {
    src: "assets/developers.webp",
    alt: "ForgeRank developer leaderboard with transparent evidence categories",
  },
};

document.querySelectorAll("[data-showcase]").forEach((button) => {
  button.addEventListener("click", () => {
    const view = showcaseViews[button.dataset.showcase];
    if (!view || !showcaseImage || showcaseImage.getAttribute("src") === view.src) return;
    document.querySelectorAll("[data-showcase]").forEach((candidate) => {
      candidate.setAttribute("aria-selected", String(candidate === button));
    });
    showcaseImage.classList.add("is-switching");
    window.setTimeout(() => {
      showcaseImage.setAttribute("src", view.src);
      showcaseImage.setAttribute("alt", view.alt);
      showcaseImage.onload = () => showcaseImage.classList.remove("is-switching");
    }, 160);
  });
});

document.querySelectorAll("[data-copy-target]").forEach((button) => {
  button.addEventListener("click", async () => {
    const target = document.getElementById(button.dataset.copyTarget);
    if (!target) return;
    const originalLabel = button.textContent;
    try {
      await navigator.clipboard.writeText(target.textContent.trim());
      button.textContent = "Copied";
    } catch {
      button.textContent = "Select text";
    }
    window.setTimeout(() => {
      button.textContent = originalLabel;
    }, 1800);
  });
});

document.querySelectorAll("[data-year]").forEach((node) => {
  node.textContent = String(new Date().getFullYear());
});

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const reveals = document.querySelectorAll(".reveal");
if (reducedMotion || !("IntersectionObserver" in window)) {
  reveals.forEach((node) => node.classList.add("is-visible"));
} else {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      });
    },
    { rootMargin: "0px 0px -8%", threshold: 0.08 },
  );
  reveals.forEach((node) => observer.observe(node));
}
