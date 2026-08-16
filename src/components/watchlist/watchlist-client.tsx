"use client";

import { BookmarkX, GitCompareArrows } from "lucide-react";
import Link from "next/link";

import { useLocalList } from "@/components/local/use-local-list";

export function WatchlistClient() {
  const [repositories, setRepositories] = useLocalList("forgerank-watchlist-v1");
  const remove = (fullName: string) =>
    setRepositories(repositories.filter((value) => value !== fullName));
  if (repositories.length === 0)
    return (
      <div className="local-empty">
        <BookmarkX size={25} />
        <h2>Your local watchlist is empty.</h2>
        <p>
          Save repositories from any detail page. The list stays in this browser and requires no
          account.
        </p>
        <Link className="button button-primary" href="/discover">
          Discover projects
        </Link>
      </div>
    );
  return (
    <div className="watchlist">
      <div className="watchlist-actions">
        <span>{repositories.length} saved locally</span>
        {repositories.length >= 2 && (
          <Link
            className="button button-secondary"
            href={`/compare/${repositories.slice(0, 5).join(",")}`}
          >
            <GitCompareArrows size={15} /> Compare first {Math.min(5, repositories.length)}
          </Link>
        )}
      </div>
      {repositories.map((fullName, index) => (
        <div key={fullName}>
          <span>#{index + 1}</span>
          <Link href={`/r/${fullName}`}>
            <strong>{fullName}</strong>
            <small>Open current ForgeRank analytics</small>
          </Link>
          <button type="button" onClick={() => remove(fullName)}>
            Remove
          </button>
        </div>
      ))}
    </div>
  );
}
