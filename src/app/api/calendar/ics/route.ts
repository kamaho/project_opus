import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { calendarEvents, tasks, regulatoryDeadlines } from "@/lib/db/schema";
import { eq, and, inArray } from "drizzle-orm";

function fmtIcsDate(d: Date, allDay = false): string {
  if (allDay) {
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, "0");
    const day = String(d.getUTCDate()).padStart(2, "0");
    return `${y}${m}${day}`;
  }
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function escapeIcs(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

function resolveDeadlineDatesForYear(
  deadline: { deadlineRule: unknown; frequency: string; periodStartMonth: number | null },
  year: number,
): Date[] {
  const rule = deadline.deadlineRule as { day: number; month?: number; relative_to?: string; months_after?: number };
  const dates: Date[] = [];

  if (deadline.frequency === "yearly" && rule.month !== undefined) {
    dates.push(new Date(year, rule.month - 1, rule.day));
  } else if (deadline.frequency === "monthly") {
    for (let m = 0; m < 12; m++) {
      if (rule.relative_to === "period_end" && rule.months_after) {
        const dm = m + rule.months_after;
        if (dm < 12) dates.push(new Date(year, dm, rule.day));
      } else {
        dates.push(new Date(year, m, rule.day));
      }
    }
  } else if (deadline.frequency === "bimonthly") {
    const startMonth = (deadline.periodStartMonth ?? 1) - 1;
    for (let pStart = startMonth; pStart < 12; pStart += 2) {
      const pEnd = pStart + 1;
      let dm = pEnd;
      if (rule.relative_to === "period_end" && rule.months_after) dm = pEnd + rule.months_after;
      if (dm < 12) dates.push(new Date(year, dm, rule.day));
    }
  } else if (deadline.frequency === "quarterly") {
    for (let q = 0; q < 4; q++) {
      const qEnd = (q + 1) * 3 - 1;
      let dm = qEnd;
      if (rule.relative_to === "period_end" && rule.months_after) dm = qEnd + rule.months_after;
      if (dm < 12) dates.push(new Date(year, dm, rule.day));
    }
  }

  return dates;
}

export async function GET(req: NextRequest) {
  const { orgId, userId } = await auth();
  if (!orgId || !userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const yearStart = new Date(now.getFullYear(), 0, 1);
  const yearEnd = new Date(now.getFullYear(), 11, 31, 23, 59, 59);

  const [events, taskRows, deadlines] = await Promise.all([
    db
      .select()
      .from(calendarEvents)
      .where(eq(calendarEvents.tenantId, orgId))
      .limit(1000),
    db
      .select({
        id: tasks.id,
        title: tasks.title,
        status: tasks.status,
        priority: tasks.priority,
        dueDate: tasks.dueDate,
      })
      .from(tasks)
      .where(
        and(
          eq(tasks.tenantId, orgId),
          inArray(tasks.status, ["open", "in_progress", "waiting"]),
        )
      )
      .limit(1000),
    db.select().from(regulatoryDeadlines),
  ]);

  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Revizo//Kalender//NO",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:Revizo Kalender",
  ];

  for (const ev of events) {
    lines.push("BEGIN:VEVENT");
    lines.push(`UID:cal-${ev.id}@revizo.no`);
    lines.push(`SUMMARY:${escapeIcs(ev.title)}`);
    if (ev.description) lines.push(`DESCRIPTION:${escapeIcs(ev.description)}`);

    if (ev.allDay) {
      lines.push(`DTSTART;VALUE=DATE:${fmtIcsDate(ev.startAt, true)}`);
      if (ev.endAt) {
        lines.push(`DTEND;VALUE=DATE:${fmtIcsDate(ev.endAt, true)}`);
      }
    } else {
      lines.push(`DTSTART:${fmtIcsDate(ev.startAt)}`);
      if (ev.endAt) {
        lines.push(`DTEND:${fmtIcsDate(ev.endAt)}`);
      }
    }

    if (ev.reminderMinutesBefore) {
      lines.push("BEGIN:VALARM");
      lines.push("ACTION:DISPLAY");
      lines.push(`TRIGGER:-PT${ev.reminderMinutesBefore}M`);
      lines.push(`DESCRIPTION:${escapeIcs(ev.title)}`);
      lines.push("END:VALARM");
    }

    const cat =
      ev.type === "meeting" ? "Møte" :
      ev.type === "reminder" ? "Påminnelse" :
      "Intern frist";
    lines.push(`CATEGORIES:${cat}`);
    lines.push(`DTSTAMP:${fmtIcsDate(ev.createdAt ?? new Date())}`);
    lines.push("END:VEVENT");
  }

  for (const t of taskRows) {
    if (!t.dueDate) continue;
    const d = new Date(t.dueDate);
    lines.push("BEGIN:VEVENT");
    lines.push(`UID:task-${t.id}@revizo.no`);
    lines.push(`SUMMARY:[Oppgave] ${escapeIcs(t.title)}`);
    lines.push(`DTSTART;VALUE=DATE:${fmtIcsDate(d, true)}`);
    lines.push(`CATEGORIES:Oppgave`);
    lines.push(`DTSTAMP:${fmtIcsDate(new Date())}`);
    lines.push("END:VEVENT");
  }

  const currentYear = now.getFullYear();
  for (const dl of deadlines) {
    const dates = resolveDeadlineDatesForYear(dl, currentYear);
    for (const d of dates) {
      lines.push("BEGIN:VEVENT");
      lines.push(`UID:dl-${dl.id}-${fmtIcsDate(d, true)}@revizo.no`);
      lines.push(`SUMMARY:[Frist] ${escapeIcs(dl.title)}`);
      if (dl.description) lines.push(`DESCRIPTION:${escapeIcs(dl.description)}`);
      lines.push(`DTSTART;VALUE=DATE:${fmtIcsDate(d, true)}`);
      lines.push(`CATEGORIES:Lovpålagt frist`);
      lines.push(`DTSTAMP:${fmtIcsDate(new Date())}`);
      lines.push("END:VEVENT");
    }
  }

  lines.push("END:VCALENDAR");

  const icsContent = lines.join("\r\n");

  return new Response(icsContent, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": "attachment; filename=revizo-kalender.ics",
    },
  });
}
