"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { getPortalData } from "@/utils/step-engine";
import { getOrigin } from "@/utils/origin";
import { getClientIp } from "@/utils/request-ip";
import {
  field,
  choiceError,
  parentRequiredError,
  parentEmailError,
  parentPhoneError,
  availabilityConcernsError,
  isPlausiblePng,
  type FieldErrors,
} from "@/utils/validation";
import {
  AVAILABILITY_VALUES,
  IEP_VALUES,
  type ParentFormState,
  type ParentFormValues,
} from "@/utils/parent-options";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const GENERIC_FAILURE =
  "Something went wrong saving your form. Please try again, or email us if it keeps happening.";
const LINK_INVALID =
  "This form link is no longer valid. Ask your student to send you their current link.";

/** Decodes a `data:image/png;base64,...` payload; null if it isn't one. */
function decodeSignature(dataUrl: string): Buffer | null {
  const match = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!match) return null;
  try {
    return Buffer.from(match[1], "base64");
  } catch {
    return null;
  }
}

/**
 * Stores a signed parent form. Runs with NO user session — the token is the
 * only credential, so everything is re-resolved server-side through the
 * service-role client and nothing from the client is trusted except the
 * answers themselves.
 */
export async function submitParentForm(
  token: string,
  _prev: ParentFormState,
  formData: FormData,
): Promise<ParentFormState> {
  if (!UUID_RE.test(token.trim())) return { errors: { form: LINK_INVALID } };

  const supabase = createAdminClient();

  // Re-resolve the application from the token; never trust an id from the form.
  const { data: application, error: lookupError } = await supabase
    .from("applications")
    .select("id, cycle_id")
    .eq("parent_link_token", token.trim())
    .maybeSingle();
  if (lookupError || !application) return { errors: { form: LINK_INVALID } };

  const applicationId = application.id as string;

  // Cheap pre-check so a revisit doesn't waste a storage upload. The real
  // race guard is the unique constraint, handled at the insert below.
  const { data: existing } = await supabase
    .from("parent_form_submissions")
    .select("id")
    .eq("application_id", applicationId)
    .maybeSingle();
  if (existing) return { submitted: true };

  // --- read fields ---------------------------------------------------------
  const v: ParentFormValues = {
    wants_program_info: field(formData, "wants_program_info"),
    availability: field(formData, "availability"),
    availability_concerns: field(formData, "availability_concerns"),
    iep: field(formData, "iep"),
    comments: field(formData, "comments"),
    parent_first_name: field(formData, "parent_first_name"),
    parent_last_name: field(formData, "parent_last_name"),
    parent_relationship: field(formData, "parent_relationship"),
    parent_email: field(formData, "parent_email"),
    parent_phone: field(formData, "parent_phone"),
    signature_typed_name: field(formData, "signature_typed_name"),
  };
  const signatureDataUrl = field(formData, "signature_data_url");

  // --- validate ------------------------------------------------------------
  const errors: FieldErrors = {};
  const set = (key: string, msg: string | null) => {
    if (msg) errors[key] = msg;
  };

  set(
    "availability",
    choiceError(v.availability, AVAILABILITY_VALUES, "an availability answer"),
  );
  set(
    "availability_concerns",
    availabilityConcernsError(v.availability, v.availability_concerns),
  );
  if (v.iep) set("iep", choiceError(v.iep, IEP_VALUES, "an IEP answer"));
  set("parent_first_name", parentRequiredError(v.parent_first_name, "your first name"));
  set("parent_last_name", parentRequiredError(v.parent_last_name, "your last name"));
  set(
    "parent_relationship",
    parentRequiredError(v.parent_relationship, "your relationship to the student"),
  );
  set("parent_email", parentEmailError(v.parent_email));
  set("parent_phone", parentPhoneError(v.parent_phone));
  set(
    "signature_typed_name",
    parentRequiredError(v.signature_typed_name, "your full legal name"),
  );

  const signature = signatureDataUrl ? decodeSignature(signatureDataUrl) : null;
  if (!signature || !isPlausiblePng(signature)) {
    errors.signature_data_url =
      "Draw your signature above, or type your full legal name below.";
  }

  // Always hand the answers back — React 19 clears uncontrolled fields once
  // the action returns, so without this a single bad field empties the form.
  if (Object.keys(errors).length > 0) return { errors, values: v };

  // --- consent snapshot ----------------------------------------------------
  // Re-read the live copy rather than trusting anything echoed back by the
  // client, so the stored snapshot is provably what we published.
  const { data: consentRow } = await supabase
    .from("cycle_settings")
    .select("value")
    .eq("cycle_id", application.cycle_id)
    .eq("key", "parent_form_consent_text")
    .maybeSingle();
  const consentText =
    typeof consentRow?.value === "string" ? consentRow.value : "";
  if (!consentText) return { errors: { form: GENERIC_FAILURE }, values: v };

  // --- signature image -----------------------------------------------------
  // One submission per application (unique FK), so a stable path is safe and
  // upsert lets a retry after a partial failure heal itself.
  const signaturePath = `${applicationId}/signature.png`;
  const { error: uploadError } = await supabase.storage
    .from("signatures")
    .upload(signaturePath, signature!, {
      contentType: "image/png",
      upsert: true,
    });
  if (uploadError) return { errors: { form: GENERIC_FAILURE }, values: v };

  // --- store the submission ------------------------------------------------
  const { error: insertError } = await supabase
    .from("parent_form_submissions")
    .insert({
      application_id: applicationId,
      wants_program_info: v.wants_program_info
        ? v.wants_program_info === "yes"
        : null,
      availability: v.availability,
      availability_concerns: v.availability_concerns || null,
      iep: v.iep || null,
      comments: v.comments || null,
      parent_first_name: v.parent_first_name,
      parent_last_name: v.parent_last_name,
      parent_relationship: v.parent_relationship,
      parent_email: v.parent_email.toLowerCase(),
      parent_phone: v.parent_phone,
      consent_text_snapshot: consentText,
      signature_image_path: signaturePath,
      signature_typed_name: v.signature_typed_name,
      signer_ip: await getClientIp(),
    });

  if (insertError) {
    // 23505 = unique violation: a concurrent submit (second tab) already won.
    // That's a success from this parent's point of view, not an error.
    if (insertError.code !== "23505") return { errors: { form: GENERIC_FAILURE }, values: v };
  }

  // --- flip Step 2 to complete --------------------------------------------
  // setStepStatus() can't be used here: it requires a logged-in session and
  // rejects Step 2 (not student-actionable). Same write shape, service role,
  // updated_by null because no auth uid exists in this flow.
  const now = new Date().toISOString();
  const { error: stepError } = await supabase
    .from("step_progress")
    .update({
      status: "complete",
      submitted_at: now,
      completed_at: now,
      updated_by: null,
    })
    .eq("application_id", applicationId)
    .eq("step_number", 2);
  if (stepError) return { errors: { form: GENERIC_FAILURE }, values: v };

  return { submitted: true };
}

/**
 * Rotates a student's parent link (their own action, so ordinary RLS applies).
 * Note this does NOT clear an existing submission — the caller hides the
 * control once Step 2 is complete.
 */
export async function regenerateParentLink(): Promise<{
  error?: string;
  url?: string;
}> {
  const portal = await getPortalData();
  if (!portal) redirect("/login");

  const supabase = createClient(await cookies());
  // The column's gen_random_uuid() default only fires on INSERT, so the new
  // token has to be generated here and written explicitly.
  const { data, error } = await supabase
    .from("applications")
    .update({
      parent_link_token: crypto.randomUUID(),
      parent_link_generated_at: new Date().toISOString(),
    })
    .eq("id", portal.applicationId)
    .select("parent_link_token")
    .maybeSingle();

  if (error || !data) {
    return { error: "Couldn't create a new link. Please try again." };
  }

  revalidatePath("/portal", "layout");
  return { url: `${await getOrigin()}/parent/${data.parent_link_token}` };
}
