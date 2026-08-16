"use client";

import { ArrowRight, Search } from "lucide-react";

export function HomeSearch() {
  const openPalette = () => {
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }));
  };

  return (
    <button className="hero-search" type="button" onClick={openPalette}>
      <Search size={19} aria-hidden="true" />
      <span>Search repositories, developers, languages…</span>
      <span className="hero-search-action">
        Explore index <ArrowRight size={16} />
      </span>
    </button>
  );
}
