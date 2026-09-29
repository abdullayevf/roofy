import { getData } from "@/data";
import { AppFrame } from "@/components/shell/app-frame";
import { navRoleFor } from "@/components/shell/access";

/**
 * TEMPORARY (Phase 2 Task 10, A/B): the real app shell inside `data-direction="challenger"`, so the challenger
 * is judged with the same navigation, not a bare page. Deleted after the verdict.
 */
export async function ChallengerFrame({ children }: { children: React.ReactNode }) {
  const { actor } = await getData();
  return (
    <div data-direction="challenger" className="min-h-dvh bg-galv text-ink">
      <AppFrame role={navRoleFor(actor.role)} workspaceName="Harbour Roofing" offline={false} waiting={0}>
        {children}
      </AppFrame>
    </div>
  );
}
