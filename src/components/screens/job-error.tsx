import { cx } from "@/lib/cx";
import { Button } from "@/components/ui/button";
import { ENTRY_WIDTH, LoadError } from "./field-entry";

/** A server failure on the job form: the title stays and the form area says so and offers a retry. */
export function JobError({ mode }: { mode: "new" | "edit" }) {
  return (
    <div data-screen="job-form" className={cx("flex flex-col gap-6", ENTRY_WIDTH)}>
      <div className="flex flex-col gap-1">
        <Button variant="link" href="/jobs" className="self-start">
          Back to jobs
        </Button>
        <h1 className="text-title text-ink">{mode === "new" ? "New job" : "Edit job"}</h1>
      </div>
      <LoadError />
    </div>
  );
}
