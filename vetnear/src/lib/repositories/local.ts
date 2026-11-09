"use client";
// Local (browser/localStorage) repository adapters (P1.12).
// These wrap the existing demo stores so app code can depend on the repository
// interfaces today and be re-pointed at a server backend later.
import { getPlaces, getPlaceBySlug } from "@/lib/store";
import {
  createSubmission,
  getApprovedAsPlaces,
  getModerationEvents,
  getSubmissions,
  setSubmissionStatus,
} from "@/lib/partners/store";
import { makeId, nowIso, readJSON, writeJSON } from "@/lib/storage";
import type { AuditLogEvent } from "@/lib/types";
import type {
  AuditLogRepository,
  ModerationRepository,
  PartnerSubmissionRepository,
  PlaceRepository,
} from "./types";

export const localPlaceRepository: PlaceRepository = {
  getAll: () => getPlaces(),
  getBySlug: (slug) => getPlaceBySlug(slug),
};

export const localPartnerSubmissionRepository: PartnerSubmissionRepository = {
  list: () => getSubmissions(),
  create: (input) => createSubmission(input),
  setStatus: (id, status, actorRole, reason) =>
    setSubmissionStatus(id, status, actorRole, reason),
  approvedAsPlaces: () => getApprovedAsPlaces(),
};

export const localModerationRepository: ModerationRepository = {
  events: () => getModerationEvents(),
};

const AUDIT_KEY = "vetnear:audit";
export const localAuditLogRepository: AuditLogRepository = {
  list: () => readJSON<AuditLogEvent[]>(AUDIT_KEY, []),
  record: (event) => {
    const full: AuditLogEvent = { ...event, id: makeId("audit"), createdAt: nowIso() };
    writeJSON(AUDIT_KEY, [full, ...readJSON<AuditLogEvent[]>(AUDIT_KEY, [])]);
  },
};
