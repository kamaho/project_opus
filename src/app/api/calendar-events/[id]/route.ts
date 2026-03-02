import { withTenant } from "@/lib/auth";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { calendarEvents, CALENDAR_EVENT_TYPES } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { logAudit } from "@/lib/audit";

const updateEventSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().nullable().optional(),
  type: z.enum([...CALENDAR_EVENT_TYPES]).optional(),
  startAt: z.string().optional(),
  endAt: z.string().nullable().optional(),
  allDay: z.boolean().optional(),
  color: z.string().nullable().optional(),
  attendees: z.array(z.string()).optional(),
  reminderMinutesBefore: z.number().int().nullable().optional(),
  metadata: z.any().optional(),
});

export const GET = withTenant(async (_req, { tenantId }, params) => {
  const eventId = params!.id;

  const [event] = await db
    .select()
    .from(calendarEvents)
    .where(and(eq(calendarEvents.id, eventId), eq(calendarEvents.tenantId, tenantId)));

  if (!event) return NextResponse.json({ error: "Hendelse ikke funnet" }, { status: 404 });

  return NextResponse.json(event);
});

export const PATCH = withTenant(async (req, { tenantId, userId }, params) => {
  const eventId = params!.id;
  const body = await req.json();
  const parsed = updateEventSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const data = parsed.data;
  const updates: Record<string, unknown> = { updatedAt: new Date() };

  if (data.title !== undefined) updates.title = data.title;
  if (data.description !== undefined) updates.description = data.description;
  if (data.type !== undefined) updates.type = data.type;
  if (data.startAt !== undefined) updates.startAt = new Date(data.startAt);
  if (data.endAt !== undefined) updates.endAt = data.endAt ? new Date(data.endAt) : null;
  if (data.allDay !== undefined) updates.allDay = data.allDay;
  if (data.color !== undefined) updates.color = data.color;
  if (data.attendees !== undefined) updates.attendees = data.attendees;
  if (data.reminderMinutesBefore !== undefined) updates.reminderMinutesBefore = data.reminderMinutesBefore;
  if (data.metadata !== undefined) updates.metadata = data.metadata;

  const [updated] = await db
    .update(calendarEvents)
    .set(updates)
    .where(and(eq(calendarEvents.id, eventId), eq(calendarEvents.tenantId, tenantId)))
    .returning();

  if (!updated) return NextResponse.json({ error: "Hendelse ikke funnet" }, { status: 404 });

  await logAudit({
    tenantId,
    userId,
    action: "calendar_event.updated",
    entityType: "calendar_event",
    entityId: eventId,
  });

  return NextResponse.json(updated);
});

export const DELETE = withTenant(async (_req, { tenantId, userId }, params) => {
  const eventId = params!.id;

  const [deleted] = await db
    .delete(calendarEvents)
    .where(and(eq(calendarEvents.id, eventId), eq(calendarEvents.tenantId, tenantId)))
    .returning({ id: calendarEvents.id });

  if (!deleted) return NextResponse.json({ error: "Hendelse ikke funnet" }, { status: 404 });

  await logAudit({
    tenantId,
    userId,
    action: "calendar_event.deleted",
    entityType: "calendar_event",
    entityId: eventId,
  });

  return NextResponse.json({ success: true });
});
