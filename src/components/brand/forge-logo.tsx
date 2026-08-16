import Link from "next/link";

export function ForgeLogo({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" className="brand" aria-label="ForgeRank home">
      <svg className="brand-mark" viewBox="0 0 40 40" aria-hidden="true">
        <path d="M9 28.5 16.7 9h6.8l-3.1 8.1H31l-3.2 7.6H17.5l-1.6 3.8H9Z" />
        <path
          className="brand-spark"
          d="m28.9 7.3 1.2 3.1 3.1 1.2-3.1 1.2-1.2 3.1-1.2-3.1-3.1-1.2 3.1-1.2 1.2-3.1Z"
        />
      </svg>
      {!compact && (
        <span className="brand-word">
          Forge<span>Rank</span>
        </span>
      )}
    </Link>
  );
}
