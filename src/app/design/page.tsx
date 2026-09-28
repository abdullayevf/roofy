import type { Metadata } from "next";
import { Group, Section, Swatch, ThemePair } from "./section";
import { StepperDemo, IconOnlyButtonDemo, MoneyCellIconDemo } from "./interactive-demos";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { Segmented } from "@/components/ui/segmented";
import { ChoiceChip } from "@/components/ui/choice-chip";
import { Checkbox } from "@/components/ui/checkbox";
import { DayToggle } from "@/components/ui/day-toggle";
import { StatusChip } from "@/components/ui/status-chip";
import { MoneyCell } from "@/components/ui/money-cell";
import { List } from "@/components/ui/list";
import { Skeleton } from "@/components/ui/skeleton";
import { SheetPanel } from "@/components/ui/sheet";
import { DialogPanel } from "@/components/ui/dialog";
import { ToastView } from "@/components/ui/toast";
import { TapeBar } from "@/components/tape-bar";
import { CrewChip } from "@/components/crew-chip";
import { NeedsAttentionItem } from "@/components/needs-attention-item";
import { EmptyState } from "@/components/empty-state";
import { OutboxBadge } from "@/components/outbox-badge";
import { OfflineBanner } from "@/components/offline-banner";
import { TabBar } from "@/components/nav/tab-bar";
import { Sidebar } from "@/components/nav/sidebar";

export const metadata: Metadata = {
  title: "Design system",
  description: "Every Roofy UI primitive and app component, in every state, light and dark.",
};

const TOKEN_SWATCHES = [
  { name: "galv", className: "bg-galv border border-line" },
  { name: "surface", className: "bg-surface border border-line" },
  { name: "ink", className: "bg-ink" },
  { name: "ink-2", className: "bg-ink-2" },
  { name: "line", className: "bg-line" },
  { name: "edge", className: "bg-edge" },
  { name: "chalk", className: "bg-chalk" },
  { name: "tape", className: "bg-tape" },
  { name: "over", className: "bg-over" },
  { name: "watch", className: "bg-watch" },
  { name: "good", className: "bg-good" },
] as const;

export default function DesignPage() {
  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-12 px-4 py-8 lg:px-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-title text-ink">Design system</h1>
        <p className="max-w-[70ch] text-body text-ink-2">
          Every component from DESIGN.md, in every state it supports, light and dark side by side. Content
          throughout is Harbour Roofing&apos;s Smith job (Ryde re-roof), sheet install at 120 m² of 400 m²,
          and the crew Sam, Tom, Jake, Dima and Lee.
        </p>
      </header>

      <Section title="Type">
        <ThemePair>
          <Swatch label="Scale, with real content">
            <div className="flex flex-col gap-3">
              <p className="text-figure-xl num text-ink">$4,775.00</p>
              <p className="text-title text-ink">Smith job — Ryde re-roof</p>
              <p className="text-heading text-ink">Sheet install</p>
              <p className="text-figure num text-ink">120 m²</p>
              <p className="text-body text-ink">Every dollar taps through to the log lines behind it.</p>
              <p className="text-body-strong text-ink">Sam</p>
              <p className="text-meta text-ink-2">Mon 28 Sep</p>
            </div>
          </Swatch>
          <Swatch label="Tokens">
            <div className="flex flex-wrap gap-3">
              {TOKEN_SWATCHES.map((t) => (
                <div key={t.name} className="flex flex-col items-center gap-1">
                  <span aria-hidden="true" className={`h-12 w-12 rounded-control ${t.className}`} />
                  <span className="text-meta text-ink-2">{t.name}</span>
                </div>
              ))}
            </div>
          </Swatch>
        </ThemePair>
      </Section>

      <Section title="Navigation">
        <ThemePair>
          <Swatch label="Phone, manager">
            <TabBar role="manager" active="home" fixed={false} />
          </Swatch>
          <Swatch label="Phone, foreman">
            <TabBar role="foreman" active="log" fixed={false} />
          </Swatch>
          <Swatch label="Phone, accountant">
            <TabBar role="accountant" active="reports" fixed={false} />
          </Swatch>
          <Swatch label="Desktop sidebar">
            <Sidebar role="manager" active="jobs" workspaceName="Harbour Roofing" />
          </Swatch>
        </ThemePair>
      </Section>

      <Section title="Button">
        <ThemePair>
          <Swatch label="Variants">
            <div className="flex flex-wrap gap-3">
              <Button variant="primary">Save day</Button>
              <Button variant="secondary">Same as yesterday</Button>
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
          <Swatch label="Disabled, with a reason">
            <Button disabled reason="Needs connection — try again once you're back online.">
              Approve pay run
            </Button>
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
          <Swatch label="Default, with a unit suffix">
            <Field label="Quantity" inputMode="decimal" defaultValue="120" suffix="m²" />
          </Swatch>
          <Swatch label="Focus">
            <Field label="Quantity" inputMode="decimal" defaultValue="120" suffix="m²" focusVisible />
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
                { value: "per_unit", label: "m²" },
              ]}
            />
          </Swatch>
          <Swatch label="Focus">
            <Select
              label="Pay basis"
              defaultValue="daily"
              focusVisible
              options={[{ value: "daily", label: "Day" }]}
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
          <Swatch label="Disabled">
            <Select
              label="Pay basis"
              defaultValue="daily"
              disabled
              options={[{ value: "daily", label: "Day" }]}
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
          <Swatch label="Focus">
            <Segmented
              legend="Log entry type"
              name="log-entry-type-focus"
              defaultValue="progress"
              focusVisible
              options={[
                { value: "crew-day", label: "Crew day" },
                { value: "progress", label: "Progress" },
              ]}
            />
          </Swatch>
          <Swatch label="Disabled">
            <Segmented
              legend="Log entry type"
              name="log-entry-type-disabled"
              defaultValue="progress"
              disabled
              options={[
                { value: "crew-day", label: "Crew day" },
                { value: "progress", label: "Progress" },
              ]}
            />
          </Swatch>
        </ThemePair>
      </Section>

      <Section title="Choice chip">
        <ThemePair>
          <Group title="Pause reason">
            <ChoiceChip
              legend="Reason"
              name="pause-reason"
              defaultValue="weather"
              options={[
                { value: "weather", label: "Weather" },
                { value: "materials", label: "Waiting on materials" },
                { value: "client", label: "Waiting on client or builder" },
                { value: "crew", label: "Crew on another job" },
                { value: "other", label: "Other" },
              ]}
            />
          </Group>
          <Group title="Expense category">
            <ChoiceChip
              legend="Category"
              name="expense-category"
              defaultValue="materials"
              options={[
                { value: "materials", label: "Materials" },
                { value: "labour", label: "Labour" },
                { value: "other", label: "Other" },
              ]}
            />
          </Group>
          <Group title="Paid by">
            <ChoiceChip
              legend="Paid by"
              name="paid-by"
              defaultValue="business"
              options={[
                { value: "business", label: "Business" },
                { value: "crew", label: "Crew member" },
              ]}
            />
          </Group>
          <Group title="Advance or payment">
            <ChoiceChip
              legend="Advance or payment"
              name="advance-or-payment"
              options={[
                { value: "advance", label: "Advance" },
                { value: "payment", label: "Payment" },
              ]}
            />
          </Group>
          <Group title="Recent stage">
            <ChoiceChip
              legend="Stage"
              name="recent-stage"
              defaultValue="smith-sheet-install"
              options={[
                { value: "smith-sheet-install", label: "Smith job — Sheet install" },
                { value: "choose-another", label: "Choose another stage" },
              ]}
            />
          </Group>
          <Swatch label="Focus and disabled">
            <div className="flex flex-wrap gap-4">
              <ChoiceChip
                legend="Category"
                name="expense-category-focus"
                defaultValue="materials"
                focusVisible
                options={[{ value: "materials", label: "Materials" }]}
              />
              <ChoiceChip
                legend="Category"
                name="expense-category-disabled"
                disabled
                options={[{ value: "materials", label: "Materials" }]}
              />
            </div>
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
          <Swatch label="Focus">
            <Checkbox label="GST registered" focusVisible />
          </Swatch>
          <Swatch label="Disabled">
            <Checkbox label="GST registered" disabled />
          </Swatch>
        </ThemePair>
      </Section>

      <Section title="Stepper">
        <ThemePair>
          <Swatch label="Steps by 0.25 h">
            <StepperDemo />
          </Swatch>
        </ThemePair>
      </Section>

      <Section title="Day toggle">
        <ThemePair>
          <Swatch label="A full day or a half day">
            <DayToggle label="Tom's day" defaultValue={100} />
          </Swatch>
        </ThemePair>
      </Section>

      <Section title="Status chip">
        <ThemePair>
          <Group title="Stage status">
            <div className="flex flex-wrap gap-2">
              <StatusChip status="not-started" />
              <StatusChip status="active" />
              <StatusChip status="paused" reason="Weather" />
              <StatusChip status="done" />
            </div>
          </Group>
          <Group title="Job status">
            <div className="flex flex-wrap gap-2">
              <StatusChip status="quoted" />
              <StatusChip status="active" />
              <StatusChip status="on-hold" />
              <StatusChip status="complete" />
              <StatusChip status="closed" />
            </div>
          </Group>
          <Group title="Outbox state">
            <div className="flex flex-wrap gap-2">
              <StatusChip status="waiting" />
              <StatusChip status="sending" />
              <StatusChip status="sent" />
              <StatusChip status="needs-attention" />
            </div>
          </Group>
        </ThemePair>
      </Section>

      <Section title="Money cell">
        <ThemePair>
          <Swatch label="Shown inside labelled rows">
            <List
              rows={[
                { key: "labour", primary: "Labour so far", figure: <MoneyCell cents={143250} /> },
                {
                  key: "forecast",
                  primary: "Forecast labour",
                  figure: <MoneyCell cents={-30000} tone="over" toneLabel="Over budget" />,
                },
                {
                  key: "on-track",
                  primary: "On track example",
                  figure: <MoneyCell cents={143250} tone="good" toneLabel="On track" />,
                },
                { key: "icon", primary: "With an icon instead of a word", figure: <MoneyCellIconDemo /> },
              ]}
            />
          </Swatch>
        </ThemePair>
      </Section>

      <Section title="List">
        <ThemePair>
          <Swatch label="Grouped rows, whole row is the tap target">
            <List
              rows={[
                { key: "sam", primary: "Sam", meta: "Day", figure: <MoneyCell cents={143250} />, href: "#" },
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
                  meta: "m²",
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
          <Swatch label="On track">
            <TapeBar label="Site setup and safety progress" percent={60} />
          </Swatch>
          <Swatch label="Trending over, manager view">
            <TapeBar
              label="Sheet install progress"
              percent={30}
              forecastPercent={119}
              forecastLabel="Forecast $4,775.00"
            />
          </Swatch>
          <Swatch label="Foreman view (no forecast, no money)">
            <TapeBar label="Sheet install progress" percent={30} />
          </Swatch>
        </ThemePair>
      </Section>

      <Section title="Crew chip">
        <ThemePair>
          <Swatch label="Full-width rows, tapped = tape fill with an ink check">
            <div className="flex w-full flex-col gap-2 rounded-group bg-surface border-group">
              <CrewChip name="Sam" basis="Day" defaultPressed />
              <CrewChip name="Tom" basis="Hourly" defaultPressed />
              <CrewChip name="Jake" basis="m²" />
              <CrewChip name="Dima" basis="m²" defaultPressed />
              <CrewChip name="Lee" basis="Day" />
            </div>
          </Swatch>
        </ThemePair>
      </Section>

      <Section title="Foreman view">
        <ThemePair>
          <Swatch label="No money anywhere on the page">
            <div className="flex flex-col gap-4">
              <List
                rows={[
                  { key: "sheet-install", primary: "Sheet install", figure: <StatusChip status="active" /> },
                  {
                    key: "ridge",
                    primary: "Ridge bedding and pointing",
                    figure: <StatusChip status="not-started" />,
                  },
                ]}
              />
              <TapeBar label="Sheet install progress" percent={30} />
              <div className="flex flex-col gap-2 rounded-group bg-surface border-group">
                <CrewChip name="Sam" basis="Day" defaultPressed />
                <CrewChip name="Tom" basis="Hourly" />
              </div>
            </div>
          </Swatch>
        </ThemePair>
      </Section>

      <Section title="Needs-attention item">
        <ThemePair>
          <Swatch label="Severity icon plus one plain sentence, tap-through">
            <div className="flex flex-col gap-1 rounded-group bg-surface border-group">
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
          <Swatch label="Only shows when something is waiting">
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
          <Swatch label="Sheet on phone, dialog on desktop">
            <SheetPanel title="Pause stage" primaryAction={<Button variant="primary">Pause stage</Button>}>
              <ChoiceChip
                legend="Reason"
                name="sheet-pause-reason"
                defaultValue="weather"
                options={[
                  { value: "weather", label: "Weather" },
                  { value: "materials", label: "Waiting on materials" },
                  { value: "client", label: "Waiting on client or builder" },
                  { value: "crew", label: "Crew on another job" },
                  { value: "other", label: "Other" },
                ]}
              />
              <div className="mt-4">
                <Field label="Note (optional)" inputMode="text" hint="e.g. Forecast clearing Thursday" />
              </div>
            </SheetPanel>
          </Swatch>
        </ThemePair>
      </Section>

      <Section title="Dialog">
        <ThemePair>
          <Swatch label="A confirmation, before something that can't be undone">
            <DialogPanel
              title="Discard this entry?"
              description="Nothing will be sent. This can't be undone."
              confirmLabel="Discard entry"
              cancelLabel="Keep it"
              tone="danger"
            />
          </Swatch>
        </ThemePair>
      </Section>

      <Section title="Toast">
        <ThemePair>
          <Swatch label="Toast confirms a save, then goes">
            <ToastView message="Day logged" />
          </Swatch>
        </ThemePair>
      </Section>

      <Section title="States">
        <ThemePair>
          <Group title="Couldn't load this">
            <div className="flex flex-col items-start gap-3 rounded-group border-group bg-surface p-4">
              <p className="text-body text-ink">Couldn&apos;t load this. Try again.</p>
              <Button variant="secondary">Try again</Button>
            </div>
          </Group>
          <Group title="Needs connection">
            <Button disabled reason="Needs connection — try again once you're back online.">
              Approve pay run
            </Button>
          </Group>
          <Group title="No permission">
            <div className="flex flex-col items-start gap-2">
              <p className="text-body text-ink">You don&apos;t have access to this. Ask your manager.</p>
              <Button variant="link" href="#">
                Back to Home
              </Button>
            </div>
          </Group>
          <Group title="Logged (after Save day)">
            <div className="flex flex-col gap-1.5">
              <p className="text-body-strong text-ink">Mon 28 Sep</p>
              <span aria-hidden="true" className="h-[1.5px] w-24 bg-chalk" />
              <p className="text-body text-ink-2">Logged</p>
            </div>
          </Group>
          <Group title="No day to copy yet">
            <Button variant="secondary" disabled>
              No day to copy yet
            </Button>
          </Group>
          <Group title="Empty">
            <EmptyState message="No jobs yet." actionLabel="Add your first job" href="#" />
          </Group>
          <Group title="Loading">
            <div className="flex flex-col gap-2">
              <Skeleton height={24} width={180} />
              <Skeleton height={64} rounded="group" />
            </div>
          </Group>
        </ThemePair>
      </Section>
    </main>
  );
}
