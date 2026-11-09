// Supabase repository PLACEHOLDERS (P1.12). Not wired up — no Supabase dependency
// is added in this phase. When the backend lands (Phase 2), implement these
// against Postgres/PostGIS + RLS and swap them in via repositories/index.ts.
import type { PartnerSubmissionRepository, PlaceRepository } from "./types";

const notImplemented = (): never => {
  throw new Error("Supabase repository not implemented yet (see docs/ROADMAP.md, Phase 2).");
};

export const supabasePlaceRepository: PlaceRepository = {
  getAll: notImplemented,
  getBySlug: notImplemented,
};

export const supabasePartnerSubmissionRepository: PartnerSubmissionRepository = {
  list: notImplemented,
  create: notImplemented,
  setStatus: notImplemented,
  approvedAsPlaces: notImplemented,
};
