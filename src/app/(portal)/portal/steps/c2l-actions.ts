"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getPortalData, setStepStatus } from "@/utils/step-engine";
import { isC2LStep, type C2LState } from "@/utils/c2l-options";

const GENERIC = "We couldn't update this step. Please try again.";
const ALREADY_VERIFIED =
  "Launchpad staff have already verified this step, so it can't be changed here. Email us if something looks wrong.";

/**
 * Records a student's self-report for Step 5 or 6. Checking the box moves the
 * step to `pending_verification` (staff confirm it against C2L's reports);
 * unchecking it walks the step back to `in_progress`.
 *
 * Bound per step: `reportC2LStep.bind(null, 5)`.
 */
export async function reportC2LStep(
  stepNumber: number,
  _prev: C2LState,
  formData: FormData,
): Promise<C2LState> {
  if (!isC2LStep(stepNumber)) return { error: GENERIC };

  const portal = await getPortalData();
  if (!portal) redirect("/login");

  const step = portal.steps.find((s) => s.number === stepNumber);
  if (!step) return { error: GENERIC };
  if (step.locked) return { error: "Complete Step 1 to unlock this step." };

  // Staff verification is final from the student's side. RLS still permits
  // this downgrade (the policy caps the status a student may set, but not the
  // status they may set it FROM), so this check is the only thing stopping a
  // student from silently undoing staff work.
  if (step.status === "complete") return { error: ALREADY_VERIFIED };

  const reported = formData.get("reported") !== null;
  const { error } = await setStepStatus(
    stepNumber,
    reported ? "pending_verification" : "in_progress",
  );
  if (error) return { error };

  revalidatePath("/portal", "layout");

  return {
    success: reported
      ? "Thanks — we've recorded that. Launchpad staff will verify it with C2LPHL."
      : "We've cleared your report for this step.",
  };
}
