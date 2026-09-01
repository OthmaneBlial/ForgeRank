"use client";

import {
  BarChart3,
  ChevronRight,
  Command,
  GitCompareArrows,
  Moon,
  Search,
  Sun,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { ForgeLogo } from "@/components/brand/forge-logo";

type SearchResults = {
  repositories: Array<{
    fullName: string;
    description: string | null;
    score: string | null;
    relevance?: number;
  }>;
  developers: Array<{
    username: string;
    displayName: string | null;
    score: string | null;
    relevance?: number;
  }>;
  languages: Array<{ slug: string; name: string }>;
  technologies: Array<{ slug: string; name: string; category: string; repositoryCount: number }>;
  topics: Array<{ slug: string; name: string; description: string | null }>;
  collections: Array<{ slug: string; name: string; description: string }>;
};

const navItems = [
  ["Trending", "/trending"],
  ["Repositories", "/repositories"],
  ["Developers", "/developers"],
  ["Languages", "/languages"],
  ["Collections", "/collections"],
  ["Discover", "/discover"],
  ["Insights", "/insights"],
  ["Topics", "/topics"],
] as const;

const emptyResults: SearchResults = {
  repositories: [],
  developers: [],
  languages: [],
  technologies: [],
  topics: [],
  collections: [],
};

export function SiteHeader() {
  const [paletteOpen, setPaletteOpen] = useState(false);
  const commandTriggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem("forgerank-theme");
    const nextTheme =
      saved === "light" || saved === "dark"
        ? saved
        : window.matchMedia("(prefers-color-scheme: light)").matches
          ? "light"
          : "dark";
    document.documentElement.dataset.theme = nextTheme;
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen(true);
      }
      if (event.key === "Escape") setPaletteOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    const trigger = commandTriggerRef.current;
    trigger?.setAttribute("data-interactive-ready", "true");
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      trigger?.setAttribute("data-interactive-ready", "false");
    };
  }, []);

  const toggleTheme = () => {
    const nextTheme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = nextTheme;
    localStorage.setItem("forgerank-theme", nextTheme);
  };

  return (
    <>
      <header className="site-header">
        <div className="shell header-main">
          <ForgeLogo />
          <nav className="primary-nav" aria-label="Primary navigation">
            {navItems.map(([label, href]) => (
              <Link key={href} href={href}>
                {label}
              </Link>
            ))}
          </nav>
          <div className="header-actions">
            <button
              ref={commandTriggerRef}
              className="command-trigger"
              type="button"
              data-interactive-ready="false"
              aria-label="Search the index"
              onClick={() => setPaletteOpen(true)}
            >
              <Search size={15} aria-hidden="true" />
              <span>Search the index</span>
              <kbd>⌘ K</kbd>
            </button>
            <Link href="/compare" className="icon-button" aria-label="Compare repositories">
              <GitCompareArrows size={17} />
            </Link>
            <button
              className="icon-button theme-toggle"
              type="button"
              onClick={toggleTheme}
              aria-label="Toggle color theme"
            >
              <Sun className="theme-icon-light" size={17} />
              <Moon className="theme-icon-dark" size={17} />
            </button>
          </div>
        </div>
        <nav className="mobile-nav shell" aria-label="Mobile navigation">
          {navItems.slice(0, 5).map(([label, href]) => (
            <Link key={href} href={href}>
              {label}
            </Link>
          ))}
        </nav>
      </header>
      {paletteOpen && <CommandPalette onClose={() => setPaletteOpen(false)} />}
    </>
  );
}

function CommandPalette({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults>(emptyResults);
  const [suggestions, setSuggestions] = useState<SearchResults>(emptyResults);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const activeIndexRef = useRef(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const paletteRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previouslyFocused =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    inputRef.current?.focus();
    const controller = new AbortController();
    void fetch("/api/search", { signal: controller.signal })
      .then((response) =>
        response.ok ? (response.json() as Promise<SearchResults>) : emptyResults,
      )
      .then(setSuggestions)
      .catch(() => undefined);
    return () => {
      controller.abort();
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus();
    };
  }, []);
  useEffect(() => {
    if (query.trim().length < 2) {
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`, {
          signal: controller.signal,
        });
        if (response.ok) setResults((await response.json()) as SearchResults);
      } finally {
        setLoading(false);
      }
    }, 150);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  useEffect(() => {
    const options = [
      ...(paletteRef.current?.querySelectorAll<HTMLAnchorElement>("a[data-search-option]") ?? []),
    ];
    options.forEach((option, index) => {
      option.id = `search-option-${index}`;
      option.classList.toggle("is-keyboard-active", index === activeIndex);
      option.setAttribute("aria-selected", String(index === activeIndex));
    });
    if (activeIndex >= 0) options[activeIndex]?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, results, suggestions, query]);

  const visibleResults = query.trim().length < 2 ? suggestions : results;
  const hasResults = Object.values(visibleResults).some((group) => group.length > 0);
  const selectIndex = (index: number) => {
    activeIndexRef.current = index;
    setActiveIndex(index);
  };
  const onPaletteKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Tab") {
      const focusable = [
        ...(paletteRef.current?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ) ?? []),
      ];
      const first = focusable[0];
      const last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
      return;
    }
    const options = [
      ...(paletteRef.current?.querySelectorAll<HTMLAnchorElement>("a[data-search-option]") ?? []),
    ];
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (options.length === 0) return;
      selectIndex(
        event.key === "ArrowDown"
          ? (activeIndexRef.current + 1) % options.length
          : activeIndexRef.current <= 0
            ? options.length - 1
            : activeIndexRef.current - 1,
      );
    } else if (event.key === "Home" && options.length > 0) {
      event.preventDefault();
      selectIndex(0);
    } else if (event.key === "End" && options.length > 0) {
      event.preventDefault();
      selectIndex(options.length - 1);
    } else if (event.key === "Enter" && activeIndexRef.current >= 0) {
      event.preventDefault();
      const destination = options[activeIndexRef.current]?.href;
      if (destination) {
        const url = new URL(destination);
        router.push(`${url.pathname}${url.search}${url.hash}`);
        onClose();
      }
    }
  };

  return (
    <div className="palette-backdrop" role="presentation" onMouseDown={onClose}>
      <div
        ref={paletteRef}
        className="command-palette"
        role="dialog"
        aria-modal="true"
        aria-label="Search ForgeRank"
        onKeyDown={onPaletteKeyDown}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="palette-input-row">
          <Search size={18} aria-hidden="true" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              selectIndex(-1);
            }}
            placeholder="Search repositories, developers, technologies…"
            aria-label="Search query"
            role="combobox"
            aria-expanded="true"
            aria-controls="command-search-results"
            aria-activedescendant={activeIndex >= 0 ? `search-option-${activeIndex}` : undefined}
          />
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close search">
            <X size={17} />
          </button>
        </div>
        <div
          id="command-search-results"
          className="palette-results"
          role="listbox"
          aria-label="Search results"
          aria-live="polite"
        >
          {query.length < 2 && (
            <div className="palette-shortcuts">
              <p className="eyebrow">Quick paths</p>
              <Link
                data-search-option
                role="option"
                aria-selected="false"
                href="/trending"
                onClick={onClose}
              >
                <BarChart3 size={16} /> Trending now <ChevronRight size={15} />
              </Link>
              <Link
                data-search-option
                role="option"
                aria-selected="false"
                href="/compare"
                onClick={onClose}
              >
                <GitCompareArrows size={16} /> Compare repositories <ChevronRight size={15} />
              </Link>
              <Link
                data-search-option
                role="option"
                aria-selected="false"
                href="/language/rust"
                onClick={onClose}
              >
                <Command size={16} /> Explore Rust <ChevronRight size={15} />
              </Link>
            </div>
          )}
          {query.length >= 2 && !loading && !hasResults && (
            <div className="palette-empty">
              No indexed results for “{query}”. You can add a public repository from the indexing
              page.
            </div>
          )}
          {loading && <div className="palette-empty">Searching the indexed universe…</div>}
          {visibleResults.repositories.length > 0 && (
            <SearchGroup label="Repositories">
              {visibleResults.repositories.map((repository) => (
                <Link
                  data-search-option
                  role="option"
                  aria-selected="false"
                  key={repository.fullName}
                  href={`/r/${repository.fullName}`}
                  onClick={onClose}
                >
                  <span>
                    <strong>{repository.fullName}</strong>
                    <small>{repository.description ?? "Metadata pending"}</small>
                  </span>
                  <span className="score-mini">{repository.score ?? "—"}</span>
                </Link>
              ))}
            </SearchGroup>
          )}
          {visibleResults.developers.length > 0 && (
            <SearchGroup label="Developers">
              {visibleResults.developers.map((developer) => (
                <Link
                  data-search-option
                  role="option"
                  aria-selected="false"
                  key={developer.username}
                  href={`/d/${developer.username}`}
                  onClick={onClose}
                >
                  <span>
                    <strong>{developer.displayName ?? developer.username}</strong>
                    <small>@{developer.username}</small>
                  </span>
                  <span className="score-mini">{developer.score ?? "—"}</span>
                </Link>
              ))}
            </SearchGroup>
          )}
          {visibleResults.languages.length > 0 && (
            <SearchGroup label="Languages">
              {visibleResults.languages.map((language) => (
                <Link
                  data-search-option
                  role="option"
                  aria-selected="false"
                  key={language.slug}
                  href={`/language/${language.slug}`}
                  onClick={onClose}
                >
                  <strong>{language.name}</strong>
                  <ChevronRight size={15} />
                </Link>
              ))}
            </SearchGroup>
          )}
          {visibleResults.technologies.length > 0 && (
            <SearchGroup label="Technologies">
              {visibleResults.technologies.map((technology) => (
                <Link
                  data-search-option
                  role="option"
                  aria-selected="false"
                  key={technology.slug}
                  href={`/technology/${technology.slug}`}
                  onClick={onClose}
                >
                  <span>
                    <strong>{technology.name}</strong>
                    <small>
                      {technology.category} · {technology.repositoryCount} indexed
                    </small>
                  </span>
                  <ChevronRight size={15} />
                </Link>
              ))}
            </SearchGroup>
          )}
          {visibleResults.topics.length > 0 && (
            <SearchGroup label="Topics">
              {visibleResults.topics.map((topic) => (
                <Link
                  data-search-option
                  role="option"
                  aria-selected="false"
                  key={topic.slug}
                  href={`/topic/${topic.slug}`}
                  onClick={onClose}
                >
                  <span>
                    <strong>{topic.name}</strong>
                    <small>{topic.description ?? "Deterministic repository topic"}</small>
                  </span>
                  <ChevronRight size={15} />
                </Link>
              ))}
            </SearchGroup>
          )}
          {visibleResults.collections.length > 0 && (
            <SearchGroup label="Collections">
              {visibleResults.collections.map((collection) => (
                <Link
                  data-search-option
                  role="option"
                  aria-selected="false"
                  key={collection.slug}
                  href={`/collection/${collection.slug}`}
                  onClick={onClose}
                >
                  <span>
                    <strong>{collection.name}</strong>
                    <small>{collection.description}</small>
                  </span>
                  <ChevronRight size={15} />
                </Link>
              ))}
            </SearchGroup>
          )}
        </div>
        <div className="palette-footer">
          <span>
            <kbd>↑</kbd>
            <kbd>↓</kbd> Navigate
          </span>
          <span>
            <kbd>↵</kbd> Open
          </span>
          <span>
            <kbd>esc</kbd> Close
          </span>
        </div>
      </div>
    </div>
  );
}

function SearchGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section className="search-group">
      <p className="eyebrow">{label}</p>
      {children}
    </section>
  );
}
