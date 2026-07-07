"use client";
// Service/booking requests (Module 7). MVP mock — no real booking yet.
import { track } from "@/lib/analytics";
import { makeId, nowIso, readJSON, writeJSON } from "@/lib/storage";
import type { ServiceRequest } from "@/lib/types";

const KEY = "vetnear:requests";

export function getRequests(): ServiceRequest[] {
  return readJSON<ServiceRequest[]>(KEY, []);
}

export function createRequest(
  input: Omit<ServiceRequest, "id" | "status" | "createdAt" | "updatedAt">,
): ServiceRequest {
  const req: ServiceRequest = {
    ...input,
    id: makeId("req"),
    status: "new",
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  writeJSON(KEY, [req, ...getRequests()]);
  track("service_request_created", { placeId: req.placeId, serviceType: req.serviceType });
  return req;
}
