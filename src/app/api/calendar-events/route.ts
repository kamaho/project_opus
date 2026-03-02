import { withTenant } from "@/lib/auth";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { calendarEvents, CALENDAR_EVENT_TYPES } from "@/lib/db/schema";
import { eq, and, gte, lte } from "drizzle-orm";
import { z } from "zod";
import { logAudit } from "@/lib/audit";

const createEventSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().optional(),
  type: z.enum([...CALENDAR_EVENT_TYPES]),
  startAt: z.string(),
  endAt: z.string().optional(),
  allDay: z.boolean().optional(),
  color: z.string().optional(),
  attendees: z.array(z.string()).optional(),
  reminderMinutesBefore: z.number().int().optional(),
  metadata: z.any().optional(),
});

export const GET = withTenant(async (req, { tenantId }) => {
  const url = new URL(req.url);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");

  const conditions = [eq(calendarEvents.tenantId, tenantId)];
  if (from) conditions.push(gte(calendarEvents.startAt, new Date(from)));
  if (to) conditions.push(lte(calendarEvents.startAt, new Date(to)));

  const rows = await db
    .select()
    .from(calendarEvents)
    .where(and(...conditions))
    .orderBy(calendarEvents.startAt)
    .limit(500);

  return NextResponse.json(rows);
});

export const POST = withTenant(async (req, { tenantId, userId }) => {
  const body = await req.json();
  const parsed = createEventSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const data = parsed.data;

  const [created] = await db
    .insert(calendarEvents)
    .values({
      tenantId,
      title: data.title,
      description: data.description,
      type: data.type,
      startAt: new Date(data.startAt),
      endAt: data.endAt ? new Date(data.endAt) : null,
      allDay: data.allDay ?? false,
      color: data.color,
      createdBy: userId,
      attendees: data.attendees ?? [],
      reminderMinutesBefore: data.reminderMinutesBefore,
      metadata: data.metadata ?? {},
    })
    .returning();

  await logAudit({
    tenantId,
    userId,
    action: "calendar_event.created",
    entityType: "calendar_event",
    entityId: created.id,
    metadata: { title: created.title, type: created.type },
  });

  return NextResponse.json(created, { status: 201 });
});
