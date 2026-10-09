"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChoiceChip } from "@/components/ui/choice-chip";
import { withDemo } from "./field-entry";

export type CrewFilterValue = "active" | "all";

const OPTIONS: { value: CrewFilterValue; label: string }[] = [
  { value: "active", label: "Active" },
  { value: "all", label: "Active and inactive" },
];

/** Who the Crew list shows: people working now (default), or everyone including those who have left. The choice lives in the address (`?show=all`). */
export function CrewFilter({ value, demo }: { value: CrewFilterValue; demo?: string }) {
  const router = useRouter();
  const [, start] = useTransition();
  return (
    <ChoiceChip
      legend="Show crew who are"
      name="crew-filter"
      value={value}
      options={OPTIONS}
      onChange={(next) => start(() => router.replace(withDemo("/crew", { show: next === "active" ? undefined : next }, demo), { scroll: false }))}
    />
  );
}
