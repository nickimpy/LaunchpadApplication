import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { loadParentForm } from "@/utils/parent-form";
import {
  ParentForm,
  ParentFormComplete,
} from "@/components/parent/parent-form";

type Params = Promise<{ token: string }>;

// Token-scoped and personal: never prerender, never cache, never index.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Parent / Guardian Form — Launchpad",
  robots: { index: false, follow: false },
};

export default async function ParentFormPage({ params }: { params: Params }) {
  const { token } = await params;
  const result = await loadParentForm(token);

  if (result.kind === "not_found") notFound();

  // Already signed: show the receipt, never the form again.
  if (result.kind === "already_submitted") {
    return (
      <ParentFormComplete
        studentFirstName={result.studentFirstName}
        contactEmail={result.contactEmail}
      />
    );
  }

  return <ParentForm token={token} data={result.data} />;
}
