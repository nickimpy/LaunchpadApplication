import { type NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { getAdminUser } from "@/utils/admin";

/**
 * Hands back a short-lived signed URL for a private file, then redirects to
 * it. The `documents` and `signatures` buckets are private, so files are never
 * addressable without an active admin session — this route is the only way in.
 *
 * Re-checks admin access itself: route handlers don't run inside layouts.
 */
export async function GET(request: NextRequest) {
  const admin = await getAdminUser();
  if (!admin) return new NextResponse("Not found", { status: 404 });

  const { searchParams } = new URL(request.url);
  const path = searchParams.get("path");
  const bucket = searchParams.get("bucket") === "signatures" ? "signatures" : "documents";
  if (!path) return new NextResponse("Not found", { status: 404 });

  const supabase = createClient(await cookies());
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, 60);
  if (error || !data) return new NextResponse("Not found", { status: 404 });

  return NextResponse.redirect(data.signedUrl);
}
