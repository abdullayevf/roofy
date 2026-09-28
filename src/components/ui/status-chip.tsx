import {
  CheckCircle,
  Circle,
  Clock,
  FileText,
  Lock,
  PauseCircle,
  UploadSimple,
  WarningCircle,
} from "@phosphor-icons/react/dist/ssr";
import type { Icon as PhosphorIcon } from "@phosphor-icons/react";
import { Icon } from "./icon";
import { cx } from "@/lib/cx";

export type Status =
  // Crew-day / stage status (DESIGN.md §4)
  | "active"
  | "paused"
  | "done"
  | "not-started"
  // Job status
  | "quoted"
  | "on-hold"
  | "complete"
  | "closed"
  // Outbox state
  | "waiting"
  | "sending"
  | "sent"
  | "needs-attention";

const CONFIG: Record<Status, { word: string; icon: PhosphorIcon; className: string }> = {
  active: { word: "Active", icon: Circle, className: "bg-chalk text-on-chalk" },
  paused: {
    word: "Paused",
    icon: PauseCircle,
    className: "bg-surface text-watch border-[1.5px] border-edge",
  },
  done: { word: "Done", icon: CheckCircle, className: "bg-surface text-good border-[1.5px] border-edge" },
  "not-started": {
    word: "Not started",
    icon: Circle,
    className: "bg-surface text-ink-2 border-[1.5px] border-edge",
  },

  quoted: { word: "Quoted", icon: FileText, className: "bg-surface text-ink-2 border-[1.5px] border-edge" },
  "on-hold": {
    word: "On hold",
    icon: PauseCircle,
    className: "bg-surface text-watch border-[1.5px] border-edge",
  },
  complete: {
    word: "Complete",
    icon: CheckCircle,
    className: "bg-surface text-good border-[1.5px] border-edge",
  },
  closed: { word: "Closed", icon: Lock, className: "bg-surface text-ink-2 border-[1.5px] border-edge" },

  waiting: { word: "Waiting", icon: Clock, className: "bg-surface text-ink-2 border-[1.5px] border-edge" },
  sending: {
    word: "Sending",
    icon: UploadSimple,
    className: "bg-surface text-chalk-link border-[1.5px] border-edge",
  },
  sent: { word: "Sent", icon: CheckCircle, className: "bg-surface text-good border-[1.5px] border-edge" },
  "needs-attention": {
    word: "Needs attention",
    icon: WarningCircle,
    className: "bg-surface text-over border-[1.5px] border-edge",
  },
};

export type StatusChipProps = {
  status: Status;
  /** Extra context shown after the word, e.g. a pause reason ("Weather"). */
  reason?: string;
  className?: string;
};

/** DESIGN.md §4 status chip: pill, icon + word, colour never alone. */
export function StatusChip({ status, reason, className }: StatusChipProps) {
  const { word, icon, className: toneClass } = CONFIG[status];
  return (
    <span
      className={cx("inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-meta", toneClass, className)}
    >
      <Icon icon={icon} size={16} weight={status === "active" ? "fill" : "regular"} />
      <span>{reason ? `${word}: ${reason}` : word}</span>
    </span>
  );
}
