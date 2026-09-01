"use client";

import { useState, useTransition } from "react";
import { changeMeetingStatusAction } from "@/server/meeting-actions";
import {
  MEETING_STATUSES,
  MEETING_STATUS_LABELS,
} from "@/lib/services/meetings";

export function MeetingStatusChanger({
  meetingId,
  current,
}: {
  meetingId: string;
  current: string;
}) {
  const [value, setValue] = useState(current);
  const [pending, startTransition] = useTransition();

  function onChange(next: string) {
    const prev = value;
    setValue(next);
    startTransition(async () => {
      const res = await changeMeetingStatusAction(meetingId, next);
      if (res?.error) setValue(prev);
    });
  }

  return (
    <select
      value={value}
      disabled={pending}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-md border border-border bg-surface-2 px-2 py-1 text-xs text-foreground focus:border-accent focus:outline-none disabled:opacity-50"
    >
      {MEETING_STATUSES.map((s) => (
        <option key={s} value={s}>
          {MEETING_STATUS_LABELS[s]}
        </option>
      ))}
    </select>
  );
}
