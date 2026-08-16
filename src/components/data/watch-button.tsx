"use client";

import { Bookmark, BookmarkCheck } from "lucide-react";

import { useLocalList } from "@/components/local/use-local-list";

const KEY = "forgerank-watchlist-v1";

export function WatchButton({ fullName }: { fullName: string }) {
  const [values, setValues] = useLocalList(KEY);
  const saved = values.includes(fullName);
  const toggle = () => {
    const next = new Set(values);
    if (next.has(fullName)) next.delete(fullName);
    else next.add(fullName);
    setValues([...next]);
  };
  return (
    <button className="button button-secondary" type="button" onClick={toggle}>
      {saved ? <BookmarkCheck size={15} /> : <Bookmark size={15} />}
      {saved ? "Watching" : "Watch locally"}
    </button>
  );
}
