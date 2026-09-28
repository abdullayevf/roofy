import type { Metadata } from "next";
import { Section, Swatch, ThemePair } from "./section";
import {
  StepperDemo,
  SheetDemo,
  DialogDemo,
  ToastDemo,
  IconOnlyButtonDemo,
  MoneyCellIconDemo,
} from "./interactive-demos";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { Segmented } from "@/components/ui/segmented";
import { Checkbox } from "@/components/ui/checkbox";
import { StatusChip, type Status } from "@/components/ui/status-chip";
import { MoneyCell } from "@/components/ui/money-cell";
import { List } from "@/components/ui/list";
import { Skeleton } from "@/components/ui/skeleton";
import { TapeBar } from "@/components/tape-bar";
import { CrewChip } from "@/components/crew-chip";
import { NeedsAttentionItem } from "@/components/needs-attention-item";
import { EmptyState } from "@/components/empty-state";
import { OutboxBadge } from "@/components/outbox-badge";
import { OfflineBanner } from "@/components/offline-banner";

export const metadata: Metadata = {
  title: "Design system",
  description: "Every Roofy UI primitive and app component, in every state, light and dark.",
};

const STATUSES: Status[] = [
  "active",
  "paused",
  "done",
  "not-started",
  "quoted",
  "on-hold",
  "complete",
  "closed",
  "waiting",
  "sending",
  "sent",
  "needs-attention",
];

export default function DesignPage() {
  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-12 px-4 py-8 lg:px-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-title text-ink">Design system</h1>
        <p className="text-body text-ink-2">
          Every component from DESIGN.md, in every state it supports, light and dark side by side. Content
          throughout is the Smith job (Ryde re-roof), sheet install at 120 m of 400 m, and the crew Sam, Tom,
          Jake, Dima and Lee.
        </p>
      </header>

      <Section title="Button">
        <ThemePair>
          <Swatch label="Variants">
            <div className="flex flex-wrap gap-3">
              <Button variant="primary">Save day</Button>
              <Button variant="secondary">Same as yesterday</Button>
              <Button variant="ghost">Cancel</Button>
              <Button variant="link">View source lines</Button>
              <Button tone="danger">Discard entry</Button>
              <Button tone="danger" filled>
                Discard entry
              </Button>
            </div>
          </Swatch>
          <Swatch label="Focus">
            <Button focusVisible>Save day</Button>
          </Swatch>
          <Swatch label="Disabled">
            <Button disabled>Save day</Button>
          </Swatch>
          <Swatch label="Loading (keeps its width)">
            <Button loading>Save day</Button>
          </Swatch>
          <Swatch label="Icon only (requires a label)">
            <IconOnlyButtonDemo />
          </Swatch>
        </ThemePair>
      </Section>

      <Section title="Input and field">
        <ThemePair>
          <Swatch label="Default">
            <Field label="Quantity" inputMode="decimal" defaultValue="120" hint="m2" />
          </Swatch>
          <Swatch label="Focus">
            <Field label="Quantity" inputMode="decimal" defaultValue="120" focusVisible />
          </Swatch>
          <Swatch label="Error">
            <Field label="Total" inputMode="decimal" error="Add a total before saving." />
          </Swatch>
          <Swatch label="Disabled">
            <Field label="ABN" inputMode="numeric" defaultValue="51 824 753 556" disabled />
          </Swatch>
        </ThemePair>
      </Section>

      <Section title="Select">
        <ThemePair>
          <Swatch label="Default">
            <Select
              label="Pay basis"
              defaultValue="daily"
              options={[
                { value: "daily", label: "Day" },
                { value: "hourly", label: "Hourly" },
                { value: "per_unit", label: "m2" },
              ]}
            />
          </Swatch>
          <Swatch label="Error">
            <Select
              label="Reason"
              error="Choose a reason before saving."
              options={[
                { value: "", label: "Choose a reason" },
                { value: "weather", label: "Weather" },
              ]}
            />
          </Swatch>
        </ThemePair>
      </Section>

      <Section title="Segmented control">
        <ThemePair>
          <Swatch label="Default">
            <Segmented
              legend="Log entry type"
              name="log-entry-type"
              defaultValue="progress"
              options={[
                { value: "crew-day", label: "Crew day" },
                { value: "progress", label: "Progress" },
                { value: "no-work", label: "No work" },
              ]}
            />
          </Swatch>
        </ThemePair>
      </Section>

      <Section title="Checkbox">
        <ThemePair>
          <Swatch label="Unchecked and checked">
            <div className="flex flex-col gap-2">
              <Checkbox label="GST registered" />
              <Checkbox label="GST registered" defaultChecked />
            </div>
          </Swatch>
          <Swatch label="Disabled">
            <Checkbox label="GST registered" disabled />
          </Swatch>
        </ThemePair>
      </Section>

      <Section title="Stepper">
        <ThemePair>
          <Swatch label="Hours (steps by 0.25 h) and days (toggles a full or half day)">
            <StepperDemo />
          </Swatch>
        </ThemePair>
      </Section>

      <Section title="Status chip">
        <ThemePair>
          <Swatch label="Every status">
            <div className="flex flex-wrap gap-2">
              {STATUSES.map((status) => (
                <StatusChip
                  key={status}
                  status={status}
                  reason={status === "paused" ? "Weather" : undefined}
                />
              ))}
            </div>
          </Swatch>
        </ThemePair>
      </Section>

      <Section title="Money cell">
        <ThemePair>
          <Swatch label="Amount, and a tone paired with a word or an icon">
            <div className="flex flex-col items-end gap-2">
              <MoneyCell cents={143250} />
              <MoneyCell cents={-30000} tone="over" toneLabel="Over budget" />
              <MoneyCell cents={143250} tone="good" toneLabel="On track" />
              <MoneyCellIconDemo />
            </div>
          </Swatch>
        </ThemePair>
      </Section>

      <Section title="List">
        <ThemePair>
          <Swatch label="Grouped rows, whole row is the tap target">
            <List
              rows={[
                {
                  key: "sam",
                  primary: "Sam",
                  meta: "Day",
                  figure: <MoneyCell cents={143250} />,
                  href: "#",
                },
                {
                  key: "tom",
                  primary: "Tom",
                  meta: "Hourly",
                  figure: <StatusChip status="active" />,
                  href: "#",
                },
                {
                  key: "dima",
                  primary: "Dima",
                  meta: "m2",
                  figure: <MoneyCell cents={-30000} tone="over" toneLabel="Over budget" />,
                  href: "#",
                },
              ]}
            />
          </Swatch>
        </ThemePair>
      </Section>

      <Section title="Skeleton">
        <ThemePair>
          <Swatch label="Sized exactly like the content it stands in for, no animation">
            <div className="flex flex-col gap-2">
              <Skeleton height={24} width={180} />
              <Skeleton height={64} rounded="group" />
            </div>
          </Swatch>
        </ThemePair>
      </Section>

      <Section title="Tape bar">
        <ThemePair>
          <Swatch label="On track, and trending over with a forecast marker">
            <div className="flex flex-col gap-4">
              <TapeBar label="Site setup and safety progress" percent={60} />
              <TapeBar label="Sheet install progress" percent={30} forecastPercent={119} />
            </div>
          </Swatch>
        </ThemePair>
      </Section>

      <Section title="Crew chip">
        <ThemePair>
          <Swatch label="Full-width rows, tapped = tape fill with an ink check">
            <div className="flex flex-col gap-2 rounded-group bg-surface">
              <CrewChip name="Sam" basis="Day" defaultPressed />
              <CrewChip name="Tom" basis="Hourly" defaultPressed />
              <CrewChip name="Jake" basis="m²" />
              <CrewChip name="Dima" basis="m²" defaultPressed />
              <CrewChip name="Lee" basis="Day" />
            </div>
          </Swatch>
        </ThemePair>
      </Section>

      <Section title="Needs-attention item">
        <ThemePair>
          <Swatch label="Severity icon plus one plain sentence">
            <div className="flex flex-col gap-1 rounded-group bg-surface">
              <NeedsAttentionItem
                severity="over"
                sentence="Smith job is $775 over on sheet install."
                href="#"
              />
              <NeedsAttentionItem severity="watch" sentence="Jake hasn't logged a day in 3 days." href="#" />
            </div>
          </Swatch>
        </ThemePair>
      </Section>

      <Section title="Empty state">
        <ThemePair>
          <Swatch label="One sentence, one action, nothing else centred">
            <EmptyState message="No jobs yet." actionLabel="Add your first job" href="#" />
          </Swatch>
        </ThemePair>
      </Section>

      <Section title="Outbox badge">
        <ThemePair>
          <Swatch label="Hidden at 0, a tape pill otherwise">
            <OutboxBadge count={3} />
          </Swatch>
        </ThemePair>
      </Section>

      <Section title="Offline banner">
        <ThemePair>
          <Swatch label="Default">
            <OfflineBanner />
          </Swatch>
        </ThemePair>
      </Section>

      <Section title="Sheet">
        <ThemePair>
          <Swatch label="vaul Drawer on phone, Radix Dialog from 1024 px">
            <SheetDemo />
          </Swatch>
        </ThemePair>
      </Section>

      <Section title="Dialog">
        <ThemePair>
          <Swatch label="Confirmation, filled destructive action">
            <DialogDemo />
          </Swatch>
        </ThemePair>
      </Section>

      <Section title="Toast">
        <ThemePair>
          <Swatch label="Level 3, polite live region">
            <ToastDemo />
          </Swatch>
        </ThemePair>
      </Section>
    </main>
  );
}
