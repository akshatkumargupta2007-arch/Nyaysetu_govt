// The wire format of POST /internal/sync/batch (Bible 6.2). The citizen stack builds this; gov validates it.
import { z } from "zod";

const Names = z.record(z.string(), z.string());
const Iso = z.string().datetime({ offset: true });

export const EventSchema = z.object({
  seq: z.number().int().min(1),
  type: z.string().min(1).max(60),
  from_state: z.string().nullable().optional(),
  to_state: z.string().nullable().optional(),
  actor_type: z.string().nullable().optional(),
  payload: z.record(z.string(), z.unknown()).nullable().optional(),
  created_at: Iso,
});

export const ReporterSchema = z.object({
  report_id: z.string().uuid(),
  phone_masked: z.string().max(20).nullable(),
  phone_last4: z.string().max(4).nullable().optional(), // lets officials search by the last 4 digits
  phone_cipher: z.string().max(2000).nullable(), // null = erased (180 days after closure)
  created_at: Iso,
});

export const TicketSchema = z.object({
  ticket_id: z.string().uuid(),
  public_code: z.string().min(3).max(40),
  tenant_id: z.string().min(1).max(80),
  boundary_id: z.string().max(120).nullable().optional(),
  agency_id: z.string().max(120).nullable().optional(),
  department: Names.nullable().optional(),
  category_code: z.string().min(1).max(80),
  category_l1: z.string().min(1).max(80),
  state: z.string().min(1).max(60),
  priority_band: z.string().min(1).max(30),
  escalation_level: z.number().int().min(0).default(0),
  report_count: z.number().int().min(1).default(1),
  summary_officer_en: z.string().max(2000),
  original_text: z.string().max(5000).nullable().optional(),
  original_lang: z.string().max(10).nullable().optional(),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  h3_r9: z.string().min(1).max(30),
  phone_masked: z.string().max(20).nullable().optional(),
  phone_cipher: z.string().max(2000).nullable().optional(),
  reporters: z.array(ReporterSchema).max(500).optional(),
  sla_due_at: Iso.nullable().optional(),
  created_at: Iso,
  resolved_at: Iso.nullable().optional(),
  closed_at: Iso.nullable().optional(),
  events: z.array(EventSchema).max(2000).default([]),
  last_event_seq: z.number().int().min(0),
});

export const ReferenceSchema = z.object({
  tenants: z.array(z.object({ id: z.string(), name: Names.optional() })).optional(),
  boundaries: z
    .array(
      z.object({
        id: z.string(),
        tenant_id: z.string(),
        kind: z.string(),
        name: Names,
        approximate: z.boolean().default(false),
        geometry: z.object({ type: z.string(), coordinates: z.unknown() }),
      }),
    )
    .optional(),
  agencies: z.array(z.object({ id: z.string(), name: Names, kind: z.string().nullable().optional(), department: Names.nullable().optional() })).optional(),
  categories: z.array(z.object({ code: z.string(), l1: z.string(), names: Names, icon: z.string().nullable().optional() })).optional(),
});

export const BatchSchema = z.object({
  reference: ReferenceSchema.optional(),
  tickets: z.array(TicketSchema).max(200).default([]),
});

export type Ticket = z.infer<typeof TicketSchema>;
export type Batch = z.infer<typeof BatchSchema>;
