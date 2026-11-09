// Backend-ready repository interfaces (P1.12). Swapping the implementation
// (local localStorage -> Supabase/Postgres) becomes a one-file change, not a
// rewrite. No Supabase dependency is required by these interfaces.
import type {
  AuditLogEvent,
  ModerationEvent,
  PartnerSubmission,
  Place,
  SubmissionStatus,
  UserRole,
} from "@/lib/types";

export interface PlaceRepository {
  getAll(): Place[] | Promise<Place[]>;
  getBySlug(slug: string): (Place | null) | Promise<Place | null>;
}

export interface PartnerSubmissionRepository {
  list(): PartnerSubmission[] | Promise<PartnerSubmission[]>;
  create(
    input: Omit<PartnerSubmission, "id" | "status" | "createdAt" | "updatedAt">,
  ): PartnerSubmission | Promise<PartnerSubmission>;
  setStatus(
    id: string,
    status: SubmissionStatus,
    actorRole?: UserRole,
    reason?: string,
  ): void | Promise<void>;
  approvedAsPlaces(): Place[] | Promise<Place[]>;
}

export interface ModerationRepository {
  events(): ModerationEvent[] | Promise<ModerationEvent[]>;
}

export interface AuditLogRepository {
  list(): AuditLogEvent[] | Promise<AuditLogEvent[]>;
  record(event: Omit<AuditLogEvent, "id" | "createdAt">): void | Promise<void>;
}
