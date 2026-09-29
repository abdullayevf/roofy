import type { Metadata } from "next";
import { Check } from "@phosphor-icons/react/dist/ssr";
import { Group, Section, Swatch } from "./section";
import { ThemePair } from "./theme-pair";
import { IconOnlyButtonDemo, PauseStageSheetDemo } from "./interactive-demos";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { MoneyField } from "@/components/ui/money-field";
import { Select } from "@/components/ui/select";
import { Segmented } from "@/components/ui/segmented";
import { ChoiceChip } from "@/components/ui/choice-chip";
import { Checkbox } from "@/components/ui/checkbox";
import { Stepper } from "@/components/ui/stepper";
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

// Product spec §5.7 expense categories — no others.
const EXPENSE_CATEGORIES = [
  { value: "materials", label: "Materials" },
  { value: "equipment-hire", label: "Equipment hire" },
  { value: "scaffolding", label: "Scaffolding" },
  { value: "skip-tip", label: "Skip/tip fees" },
  { value: "fuel-travel", label: "Fuel & travel" },
  { value: "parking-tolls", label: "Parking & tolls" },
  { value: "subcontractor", label: "Subcontractor (non-crew)" },
  { value: "permits", label: "Permits" },
  { value: "other", label: "Other" },
];

const PAUSE_REASONS = [
  { value: "weather", label: "Weather" },
  { value: "materials", label: "Waiting on materials" },
  { value: "client", label: "Waiting on client or builder" },
  { value: "crew", label: "Crew on another job" },
  { value: "other", label: "Other" },
];

/** A grouped `surface` block (radius 12, `line` dividers) for rows that aren't a List. */
const GROUP = "divide-y divide-line rounded-group bg-surface border-group";

export default function DesignPage() {
  return (
    <main
      className="mx-auto flex max-w-6xl flex-col gap-12 px-4 pb-8 lg:px-8"
      // Clears the status bar / notch in an installed app (real inset, or simulated in captures) plus the normal padding.
      style={{ paddingTop: "calc(max(var(--sat-sim, 0px), env(safe-area-inset-top)) + 2rem)" }}
    >
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
              <p className="text-figure-xl num text-ink [overflow-wrap:anywhere]">$4,775.00</p>
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
            <div className="pt-8">
              <TabBar role="manager" active="home" fixed={false} />
            </div>
          </Swatch>
          <Swatch label="Phone, manager, focus">
            <div className="pt-8">
              <TabBar role="manager" active="home" fixed={false} focusKey="jobs" />
            </div>
          </Swatch>
          <Swatch label="Phone, foreman">
            <div className="pt-8">
              <TabBar role="foreman" active="log" fixed={false} />
            </div>
          </Swatch>
          <Swatch label="Phone, accountant">
            <div className="pt-8">
              <TabBar role="accountant" active="reports" fixed={false} />
            </div>
          </Swatch>
          <Swatch label="Desktop sidebar">
            <Sidebar role="manager" active="jobs" workspaceName="Harbour Roofing" />
          </Swatch>
          <Swatch label="Desktop sidebar, focus">
            <Sidebar role="manager" active="jobs" workspaceName="Harbour Roofing" focusKey="crew" />
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
            <div>
              <Button focusVisible>Save day</Button>
            </div>
          </Swatch>
          <Swatch label="Disabled, with a reason">
            <Button disabled reason="Needs connection — try again once you're back online.">
              Approve pay run
            </Button>
          </Swatch>
          <Swatch label="Loading (keeps its width and its verb)">
            <Button loading loadingLabel="Saving day">
              Save day
            </Button>
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
                { value: "no-work", label: "No work" },
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
                { value: "no-work", label: "No work" },
              ]}
            />
          </Swatch>
        </ThemePair>
      </Section>

      <Section title="Choice chip">
        <ThemePair>
          <Group title="Pause reason (nothing chosen yet)">
            <ChoiceChip legend="Reason" name="pause-reason" options={PAUSE_REASONS} />
          </Group>
          <Group title="Expense category">
            <ChoiceChip
              legend="Category"
              name="expense-category"
              defaultValue="materials"
              options={EXPENSE_CATEGORIES}
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
          <Swatch label="Focus">
            <ChoiceChip
              legend="Category"
              name="expense-category-focus"
              defaultValue="materials"
              focusVisible
              options={[
                { value: "materials", label: "Materials" },
                { value: "scaffolding", label: "Scaffolding" },
              ]}
            />
          </Swatch>
          <Swatch label="Disabled">
            <ChoiceChip
              legend="Category"
              name="expense-category-disabled"
              disabled
              options={[
                { value: "materials", label: "Materials" },
                { value: "scaffolding", label: "Scaffolding" },
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
            <Stepper label="Sam's hours" defaultValue={700} />
          </Swatch>
          <Swatch label="Disabled">
            <Stepper label="Lee's hours" defaultValue={800} disabled />
          </Swatch>
        </ThemePair>
      </Section>

      <Section title="Day toggle">
        <ThemePair>
          <Swatch label="A full day or a half day">
            <DayToggle label="Tom's day" defaultValue={100} />
          </Swatch>
          <Swatch label="Focus">
            <DayToggle label="Dima's day" defaultValue={50} focusVisible />
          </Swatch>
          <Swatch label="Disabled">
            <DayToggle label="Lee's day" defaultValue={100} disabled />
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
          <Swatch label="Inside labelled rows; a tone is always an icon plus words">
            <List
              rows={[
                { key: "labour", primary: "Labour so far", figure: <MoneyCell cents={143250} />, href: "#" },
                {
                  key: "forecast",
                  primary: "Forecast labour",
                  figure: <MoneyCell cents={477500} tone="watch" status="Trending $775.00 over budget" />,
                  figureAlign: "top",
                  href: "#",
                },
                {
                  key: "ridge",
                  primary: "Ridge bedding & pointing",
                  figure: <MoneyCell cents={230000} tone="over" status="$300.00 over budget" />,
                  figureAlign: "top",
                  href: "#",
                },
                { key: "advance", primary: "Advance", figure: <MoneyCell cents={-30000} />, href: "#" },
              ]}
            />
          </Swatch>
          <Swatch label="Focus (inset ring on a tappable row)">
            <List
              rows={[
                {
                  key: "labour-focus",
                  primary: "Labour so far",
                  figure: <MoneyCell cents={143250} />,
                  href: "#",
                  focusVisible: true,
                },
              ]}
            />
          </Swatch>
        </ThemePair>
      </Section>

      <Section title="List">
        <ThemePair>
          <Swatch label="Crew rows show what each person has earned">
            <List
              rows={[
                { key: "sam", primary: "Sam", meta: "Day", figure: <MoneyCell cents={64000} />, href: "#" },
                {
                  key: "tom",
                  primary: "Tom",
                  meta: "Hourly",
                  figure: <MoneyCell cents={96000} />,
                  href: "#",
                },
                { key: "dima", primary: "Dima", meta: "m²", figure: <MoneyCell cents={72000} />, href: "#" },
              ]}
            />
          </Swatch>
          <Swatch label="Stage rows">
            <List
              rows={[
                {
                  key: "sheet-install",
                  primary: "Sheet install",
                  meta: "120 m² of 400 m²",
                  figure: <StatusChip status="active" />,
                  href: "#",
                },
                {
                  key: "ridge",
                  primary: "Ridge bedding & pointing",
                  figure: <StatusChip status="done" />,
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
          <Swatch label="Trending over (manager view)">
            <TapeBar
              label="Sheet install progress"
              percent={30}
              forecastPercent={119}
              forecastLabel="Forecast"
              tone="watch"
              note="$775.00 over — forecast $4,775.00 of $4,000.00"
            />
          </Swatch>
          <Swatch label="Over budget (manager view)">
            <TapeBar
              label="Ridge bedding and pointing progress"
              percent={100}
              forecastPercent={115}
              forecastLabel="Cost so far"
              tone="over"
              note="$300.00 over — cost $2,300.00 of $2,000.00"
            />
          </Swatch>
          <Swatch label="Paused">
            <div className="flex flex-col gap-2">
              <TapeBar label="Sheet install progress" percent={30} />
              <div>
                <StatusChip status="paused" reason="Weather" />
              </div>
            </div>
          </Swatch>
          <Swatch label="Done">
            <div className="flex flex-col gap-2">
              <TapeBar label="Site setup and safety progress" percent={100} />
              <div>
                <StatusChip status="done" />
              </div>
            </div>
          </Swatch>
          <Swatch label="Foreman view (no forecast, no money)">
            <TapeBar label="Sheet install progress" percent={30} />
          </Swatch>
        </ThemePair>
      </Section>

      <Section title="Crew chip">
        <ThemePair>
          <Swatch label="Ticked rows carry their own exception control">
            <div className={GROUP}>
              <CrewChip name="Sam" basis="Day" exception="half-day" defaultPressed />
              <CrewChip name="Tom" basis="Hourly" exception="hours" defaultPressed />
              <CrewChip
                name="Jake"
                basis="m²"
                note={{ text: "Paid from progress, not this grid", tone: "info" }}
                defaultPressed
              />
              <CrewChip name="Dima" basis="m²" />
              <CrewChip name="Lee" basis="Day" note={{ text: "No rate for this basis", tone: "watch" }} />
            </div>
          </Swatch>
          <Swatch label="Focus">
            <div className={GROUP}>
              <CrewChip name="Lee" basis="Day" focusVisible />
            </div>
          </Swatch>
          <Swatch label="Disabled">
            <div className={GROUP}>
              <CrewChip name="Lee" basis="Day" disabled />
            </div>
          </Swatch>
          <Swatch label="After Save day, ticked rows fold into one line">
            <div className="flex flex-col gap-1.5 rounded-group border-group bg-surface p-4">
              <p className="text-body-strong text-ink">Mon 28 Sep</p>
              <span aria-hidden="true" className="h-[3px] w-24 bg-chalk" />
              <p className="flex items-center gap-2 text-body-strong text-ink">
                <Check size={24} aria-hidden="true" />
                Logged: Sam, Tom, Jake
              </p>
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
                  {
                    key: "sheet-install",
                    primary: "Sheet install",
                    meta: "120 m² of 400 m²",
                    figure: <StatusChip status="active" />,
                    href: "#",
                  },
                  {
                    key: "ridge",
                    primary: "Ridge bedding & pointing",
                    figure: <StatusChip status="done" />,
                    href: "#",
                  },
                ]}
              />
              <TapeBar label="Sheet install progress" percent={30} />
              <div className={GROUP}>
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
            <div className={GROUP}>
              <NeedsAttentionItem
                severity="watch"
                sentence="Smith job is trending $775 over on sheet install."
                href="#"
              />
              <NeedsAttentionItem
                severity="over"
                sentence="Ridge bedding & pointing is $300 over budget."
                href="#"
              />
              <NeedsAttentionItem severity="watch" sentence="No log for Jake in 3 working days." href="#" />
            </div>
          </Swatch>
          <Swatch label="Focus (inset ring)">
            <div className={GROUP}>
              <NeedsAttentionItem
                severity="watch"
                sentence="No log for Jake in 3 working days."
                href="#"
                focusVisible
              />
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
          <Swatch label="Pause stage: tap a reason and it pauses, no confirm button">
            <PauseStageSheetDemo />
          </Swatch>
          <Swatch label="Record payout: a form, so it keeps a pinned Save">
            <SheetPanel title="Record payout" primaryAction={<Button variant="primary">Save payout</Button>}>
              <div className="flex flex-col gap-4">
                <Field label="Date" inputMode="text" defaultValue="Mon 28 Sep" />
                <MoneyField label="Amount" defaultCents={148200} />
                <Group title="Advance or payment">
                  <ChoiceChip
                    legend="Advance or payment"
                    name="payout-kind"
                    options={[
                      { value: "advance", label: "Advance" },
                      { value: "payment", label: "Payment" },
                    ]}
                  />
                </Group>
                <Group title="Method">
                  <ChoiceChip
                    legend="Method"
                    name="payout-method"
                    defaultValue="bank"
                    options={[
                      { value: "bank", label: "Bank transfer" },
                      { value: "cash", label: "Cash" },
                      { value: "other", label: "Other" },
                    ]}
                  />
                </Group>
                <Field label="Note (optional)" inputMode="text" />
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
            <div className="flex flex-col items-start gap-3">
              <p className="text-body text-ink">You don&apos;t have access to this. Ask your manager.</p>
              <Button variant="secondary" href="#">
                Back to Home
              </Button>
            </div>
          </Group>
          <Group title="Logged (after Save day)">
            <div className="flex flex-col gap-1.5">
              <p className="text-body-strong text-ink">Mon 28 Sep</p>
              <span aria-hidden="true" className="h-[3px] w-24 bg-chalk" />
              <p className="flex items-center gap-2 text-body-strong text-ink">
                <Check size={24} aria-hidden="true" />
                Logged
              </p>
            </div>
          </Group>
          <Group title="No day to copy yet">
            <Button variant="secondary" disabled>
              No day to copy yet
            </Button>
          </Group>
          <Group title="Stale data">
            <p className="text-meta text-ink-2">Lists updated 12 minutes ago.</p>
          </Group>
          <Group title="Outbox item that needs attention">
            <div className="flex flex-col gap-3 rounded-group border-group bg-surface p-4">
              <div>
                <StatusChip status="needs-attention" />
              </div>
              <p className="text-body-strong text-ink">Sheet install, 120 m², Mon 28 Sep</p>
              <p className="text-body text-ink-2">This stage was marked Done. Pick a different stage.</p>
              <div className="flex flex-col gap-3">
                <Button variant="primary">Edit &amp; resend</Button>
                <Button variant="secondary" tone="danger">
                  Discard
                </Button>
              </div>
            </div>
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
