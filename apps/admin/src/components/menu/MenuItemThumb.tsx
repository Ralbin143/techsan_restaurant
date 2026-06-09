"use client";

import { useState } from "react";
import { resolveMenuImageUrl } from "@/lib/menuImage";

type Props = {
  src?: string | null;
  name: string;
  /** When set, must match the API origin used for menu fetches (e.g. guest order page). */
  apiOrigin?: string;
};

export function MenuItemThumb({ src, name, apiOrigin }: Props) {
  const [broken, setBroken] = useState(false);
  const url = resolveMenuImageUrl(src, apiOrigin);
  if (!url || broken) {
    return (
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-slate-100 text-xs font-semibold text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
        {name.slice(0, 1).toUpperCase()}
      </div>
    );
  }
  return (
    <img
      src={url}
      alt=""
      className="h-10 w-10 shrink-0 rounded-md border border-slate-200 object-cover dark:border-slate-700"
      onError={() => setBroken(true)}
    />
  );
}
