"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChoiceChip } from "@/components/ui/choice-chip";
import { withDemo } from "./field-entry";
import { STATUS_FILTERS, type JobFilter } from "./job-input";

/** The status filter on the Jobs list: one chip each, Active first. The choice lives in the address (`?status=`). */
export function JobsFilter({ value, demo }: { value: JobFilter; demo?: string }) {
  const router = useRouter();
  const [, start] = useTransition();
  return (
    <ChoiceChip
      legend="Show jobs that are"
      name="job-status"
      value={value}
      options={STATUS_FILTERS}
      onChange={(next) =>
        start(() => router.replace(withDemo("/jobs", { status: next === "active" ? undefined : next }, demo), { scroll: false }))
      }
    />
  );
}
