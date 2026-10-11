import Link from "next/link";
import { CaretLeft } from "@phosphor-icons/react/dist/ssr";
import type { ExportListing } from "@/data/contracts";
import { KeepTogether } from "@/components/keep-together";
import { Skeleton } from "@/components/ui/skeleton";
import { cx } from "@/lib/cx";
import { ExportWorkspaceButton } from "./export-button";
import { attachmentsText, EXPORT_FILENAME, rowsText } from "./export-text";
import { LoadError } from "./field-entry";
import { COLUMN, FOCUS, GROUP } from "./home-parts";
import { TD, TH } from "./table-cells";

/** Full width from 1024 px: the file list sits in a table that uses the width (lesson 21). */
const WIDE = cx(COLUMN, "lg:max-w-none");

type Frame = { updated: string | null; demoOffline: boolean };
type Body = Pick<ExportListing, "files" | "attachments">;

function Head({ updated }: { updated: string | null }) {
  return (
    <div className="flex flex-col gap-1">
      <Link href="/more" prefetch={false} className={cx("flex min-h-12 items-center gap-1 self-start text-body-strong text-chalk-link", FOCUS)}>
        <CaretLeft size={24} aria-hidden="true" />
        Back to More
      </Link>
      <div className="flex min-h-12 items-center">
        <h1 className="text-title text-ink">Workspace export</h1>
      </div>
      {updated ? <p className="text-meta text-ink-2">{updated}</p> : null}
    </div>
  );
}

export function ExportScreen({ files, attachments, updated, demoOffline }: Body & Frame) {
  const nothingYet = files.some((f) => f.name === "projects.csv" && f.rows === 0);
  return (
    <div data-screen="export" className={WIDE}>
      <Head updated={updated} />
      <div className="flex max-w-180 flex-col gap-3">
        <p className="text-body text-ink">
          Everything in your workspace as spreadsheet files, in one zip you can keep. {EXPORT_FILENAME} holds the {files.length} files below
          {attachments.count > 0 ? " and your attachments" : ""}.
        </p>
        {nothingYet ? <p className="text-body text-ink">No jobs yet, so most of these files will only hold their column headings.</p> : null}
      </div>
      <ExportWorkspaceButton demoOffline={demoOffline} />
      <section aria-labelledby="export-files" className="flex flex-col gap-2">
        <h2 id="export-files" className="text-heading text-ink">Files</h2>
        <div className={cx(GROUP, "overflow-hidden")}>
          <ul className="divide-y divide-line lg:hidden">
            {files.map((f) => (
              <li key={f.name} data-export-file="" className="flex min-h-16 flex-col gap-0.5 px-4 py-3">
                <p className="text-body-strong text-ink [overflow-wrap:anywhere]">{f.name}</p>
                <p className="text-meta text-ink-2">{f.description}</p>
                <p className="text-meta text-ink-2">{rowsText(f.rows)}</p>
              </li>
            ))}
          </ul>
          <table className="hidden w-full table-fixed border-collapse lg:table">
            <thead>
              <tr className="border-b border-line">
                <th scope="col" className={cx(TH, "w-80")}>File</th>
                <th scope="col" className={TH}>What is in it</th>
                <th scope="col" className={cx(TH, "w-40 text-right")}>Rows</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {files.map((f) => (
                <tr key={f.name} data-export-file="">
                  <td className={cx(TD, "text-body-strong text-ink [overflow-wrap:anywhere]")}>{f.name}</td>
                  <td className={cx(TD, "text-body text-ink")}>{f.description}</td>
                  <td className={cx(TD, "text-right text-body text-ink")}>{rowsText(f.rows)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section aria-labelledby="export-attachments" className="flex flex-col gap-2">
        <h2 id="export-attachments" className="text-heading text-ink">Attachments</h2>
        <p data-export-attachments="" className="text-body text-ink">
          <KeepTogether text={attachmentsText(attachments)} />
        </p>
      </section>
    </div>
  );
}

export function ExportSkeleton({ updated }: { updated: string | null }) {
  return (
    <div data-screen="export" aria-busy="true" className={WIDE}>
      <Head updated={updated} />
      <Skeleton width={280} height={20} />
      <Skeleton width={240} height={48} />
      <div className={cx(GROUP, "overflow-hidden")}>
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="flex min-h-16 flex-col gap-1 px-4 py-3">
            <Skeleton width={180} height={20} />
            <Skeleton width={120} height={14} />
          </div>
        ))}
      </div>
    </div>
  );
}

export function ExportError({ updated }: { updated: string | null }) {
  return (
    <div data-screen="export" className={WIDE}>
      <Head updated={updated} />
      <LoadError primary />
    </div>
  );
}
