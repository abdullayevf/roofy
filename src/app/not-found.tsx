import { NotFoundState } from "@/components/page-states";

/** A URL that matches no route: outside the shell (no nav), so it always offers Home. */
export default function NotFound() {
  return (
    <main className="mx-auto max-w-xl p-4">
      <NotFoundState />
    </main>
  );
}
