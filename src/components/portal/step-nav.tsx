"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  STATUS_LABELS,
  TOTAL_STEPS,
  formatDeadline,
  type StepView,
} from "@/utils/steps";

// Status indicator styles. Never color alone: every state also has a text
// label (visible in the sidebar, screen-reader text on the mobile strip).
const CIRCLE_STYLES: Record<string, string> = {
  not_started: "border border-grey-tint1 bg-white text-grey",
  in_progress: "border-2 border-teal-dark bg-white text-teal-dark",
  submitted: "bg-teal-dark text-white",
  pending_verification: "bg-orange-dark text-white",
  complete: "bg-green-dark text-white",
  locked: "border border-grey-tint2 bg-grey-tint3 text-grey",
};

const STATUS_TEXT_STYLES: Record<string, string> = {
  not_started: "text-grey",
  in_progress: "text-teal-dark",
  submitted: "text-teal-dark",
  pending_verification: "text-orange-dark",
  complete: "text-green-dark",
};

function stepLabel(step: StepView): string {
  const parts = [`Step ${step.number}: ${step.name}`];
  if (step.locked) parts.push("locked until Step 1 is complete");
  else parts.push(STATUS_LABELS[step.status]);
  if (step.owner === "staff") parts.push("completed by Launchpad staff");
  return parts.join(" — ");
}

function Circle({ step, large }: { step: StepView; large?: boolean }) {
  const style = step.locked ? CIRCLE_STYLES.locked : CIRCLE_STYLES[step.status];
  return (
    <span
      aria-hidden="true"
      className={`flex shrink-0 items-center justify-center rounded-full font-bold
        ${large ? "h-12 w-12 text-lg" : "h-9 w-9 text-base"} ${style}`}
    >
      {step.status === "complete" ? "✓" : step.number}
    </span>
  );
}

function LockIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      className="h-3 w-3 shrink-0 fill-current"
    >
      <path d="M8 1a3.5 3.5 0 0 0-3.5 3.5V6H4a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V7a1 1 0 0 0-1-1h-.5V4.5A3.5 3.5 0 0 0 8 1Zm2 5H6V4.5a2 2 0 1 1 4 0V6Z" />
    </svg>
  );
}

function Progress({ completedCount }: { completedCount: number }) {
  return (
    <div>
      <p className="mb-3 text-xs font-bold uppercase tracking-wide text-grey">
        {completedCount} of {TOTAL_STEPS} steps complete
      </p>
      <div
        role="progressbar"
        aria-label="Application progress"
        aria-valuemin={0}
        aria-valuemax={TOTAL_STEPS}
        aria-valuenow={completedCount}
        className="h-3 w-full overflow-hidden rounded-full bg-grey-tint3"
      >
        <div
          className="h-full rounded-full bg-green transition-[width]"
          style={{ width: `${(completedCount / TOTAL_STEPS) * 100}%` }}
        />
      </div>
    </div>
  );
}

export function StepNav({
  steps,
  completedCount,
}: {
  steps: StepView[];
  completedCount: number;
}) {
  const pathname = usePathname();
  const isActive = (step: StepView) => pathname === `/portal/steps/${step.number}`;

  return (
    <>
      {/* Mobile: thumb-friendly horizontal strip of numbered steps */}
      <nav
        aria-label="Application steps"
        className="border-b border-grey-tint2 bg-white px-3 py-3 md:hidden"
      >
        <ol className="flex items-start gap-3 overflow-x-auto pb-1">
          {steps.map((step) => (
            <li key={step.number} className="shrink-0">
              <Link
                href={`/portal/steps/${step.number}`}
                aria-label={stepLabel(step)}
                aria-current={isActive(step) ? "step" : undefined}
                className={`flex min-h-12 min-w-12 flex-col items-center gap-1 rounded-lg p-1
                  focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-dark
                  ${isActive(step) ? "bg-teal-tint3" : ""}`}
              >
                <Circle step={step} large />
                <span
                  aria-hidden="true"
                  className={`flex items-center gap-1 text-xs ${step.locked ? "text-grey" : (STATUS_TEXT_STYLES[step.status] ?? "text-grey")}`}
                >
                  {step.locked ? (
                    <LockIcon />
                  ) : step.owner === "staff" && step.status === "not_started" ? (
                    "Staff"
                  ) : (
                    STATUS_LABELS[step.status].split(" ")[0]
                  )}
                </span>
              </Link>
            </li>
          ))}
        </ol>
      </nav>

      {/* Desktop: full left sidebar */}
      <nav
        aria-label="Application steps"
        className="hidden w-72 shrink-0 border-r border-grey-tint2 bg-white p-6 md:block"
      >
        <Progress completedCount={completedCount} />
        <ol className="mt-6 flex flex-col gap-1">
          {steps.map((step) => (
            <li key={step.number}>
              <Link
                href={`/portal/steps/${step.number}`}
                aria-label={stepLabel(step)}
                aria-current={isActive(step) ? "step" : undefined}
                className={`flex items-start gap-3 rounded-lg p-3 focus:outline-none
                  focus-visible:ring-2 focus-visible:ring-teal-dark
                  ${isActive(step) ? "bg-teal-tint3" : "hover:bg-grey-tint4"}`}
              >
                <Circle step={step} />
                <span className="flex min-w-0 flex-col">
                  <span
                    className={`text-base font-bold ${step.locked ? "text-grey-tint1" : "text-grey"}`}
                  >
                    {step.name}
                  </span>
                  <span
                    className={`flex items-center gap-1 text-xs ${step.locked ? "text-grey" : (STATUS_TEXT_STYLES[step.status] ?? "text-grey")}`}
                  >
                    {step.locked && <LockIcon />}
                    {step.locked
                      ? "Locked until Step 1 is complete"
                      : STATUS_LABELS[step.status]}
                    {!step.locked && step.owner === "staff" && " · Staff only"}
                  </span>
                  {step.deadline && (
                    <span className="text-xs text-grey">
                      Due {formatDeadline(step.deadline)}
                    </span>
                  )}
                </span>
              </Link>
            </li>
          ))}
        </ol>
      </nav>
    </>
  );
}
