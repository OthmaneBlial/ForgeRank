import Link from "next/link";

import { ForgeLogo } from "@/components/brand/forge-logo";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="shell footer-grid">
        <div>
          <ForgeLogo />
          <p>Public open-source signals, explained with context.</p>
          <span className="independence-note">
            Independent from GitHub. No API tokens. No OAuth.
          </span>
        </div>
        <div className="footer-links">
          <div>
            <strong>Intelligence</strong>
            <Link href="/trending">Trending</Link>
            <Link href="/repositories">Repositories</Link>
            <Link href="/daily">Daily pulse</Link>
            <Link href="/weekly">Weekly report</Link>
          </div>
          <div>
            <strong>Method</strong>
            <Link href="/methodology">Methodology</Link>
            <Link href="/coverage">Index coverage</Link>
            <Link href="/data-policy">Data policy</Link>
          </div>
          <div>
            <strong>Explore</strong>
            <Link href="/discover">Discover</Link>
            <Link href="/languages">Languages</Link>
            <Link href="/technologies">Technologies</Link>
            <Link href="/collections">Collections</Link>
            <Link href="/index">Add repository</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
