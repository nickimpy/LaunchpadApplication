"use client";

import { useState } from "react";
import Link from "next/link";

export type SchoolCount = {
  /** Display name ("Other" free text is grouped by what the student typed). */
  name: string;
  count: number;
  /** Where the row links: a school filter for listed schools, a search otherwise. */
  href: string | null;
  isPartner: boolean;
};

/**
 * Schools ranked by number of applicants, with a search box. The rank shown is
 * the school's place in the FULL ranking, so filtering to one school still
 * tells you where it stands.
 */
export function SchoolTable({ rows }: { rows: SchoolCount[] }) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const ranked = rows.map((row, i) => ({ ...row, rank: i + 1 }));
  const shown = q ? ranked.filter((r) => r.name.toLowerCase().includes(q)) : ranked;

  return (
    <section aria-labelledby="schools-heading" className="mb-9">
      <h2 id="schools-heading" className="mb-1 text-lg font-bold">
        Applicants by school
      </h2>
      <p className="mb-3 text-xs">
        Ranked by number of applicants. Select a school to see its applicants.
      </p>

      <label className="mb-3 block max-w-md">
        <span className="block text-xs font-bold">Search schools</span>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Type part of a school name"
          className="mt-1 w-full rounded-md border border-grey-tint1 bg-white px-3 py-3 text-base"
        />
      </label>
      <p className="sr-only" aria-live="polite">
        {q ? `${shown.length} ${shown.length === 1 ? "school" : "schools"} match` : ""}
      </p>

      <div className="overflow-x-auto rounded-lg border border-grey-tint2 bg-white shadow-sm">
        {rows.length === 0 ? (
          <p className="p-6 text-xs">No applicants yet.</p>
        ) : shown.length === 0 ? (
          <p className="p-6 text-xs">No schools match &ldquo;{query}&rdquo;.</p>
        ) : (
          <table className="w-full border-collapse text-base">
            <caption className="sr-only">
              Number of applicants per school, highest first
            </caption>
            <thead>
              <tr className="border-b border-grey-tint2 text-left">
                <th scope="col" className="w-12 px-3 py-3">#</th>
                <th scope="col" className="px-3 py-3">School</th>
                <th scope="col" className="px-3 py-3 text-right">Applicants</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((row) => (
                <tr key={row.name} className="border-b border-grey-tint3 last:border-0">
                  <td className="px-3 py-3 text-xs">{row.rank}</td>
                  <th scope="row" className="px-3 py-3 text-left font-normal">
                    {row.href ? (
                      <Link className="font-bold text-teal-dark underline" href={row.href}>
                        {row.name}
                      </Link>
                    ) : (
                      <span className="font-bold">{row.name}</span>
                    )}
                    {row.isPartner && (
                      <span className="block text-xs text-green-dark">Partner school</span>
                    )}
                  </th>
                  <td className="px-3 py-3 text-right font-bold">{row.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
