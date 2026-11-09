import type { Coordinates } from "@/lib/types";

export type KyivAlertState = "active" | "inactive" | "unavailable";
export type KyivAlertLevel = "yellow" | "red" | "unknown";

export interface KyivAlertStatus {
  state: KyivAlertState;
  checkedAt: string;
  sourceUrl: string;
  startedAt?: string | null;
  alertType?: string | null;
  level?: KyivAlertLevel;
  message?: string;
}

export interface KyivShelter extends Coordinates {
  id: string;
  address: string;
  district?: string | null;
  shelterType?: string | null;
  buildingType?: string | null;
  accessibility?: string | null;
  workingHours?: string | null;
  declaredOpen24h: boolean;
  distanceMeters: number;
  sourceUpdatedAt?: string | null;
}

export interface KyivSheltersResponse {
  shelters: KyivShelter[];
  checkedAt: string;
  sourceUrl: string;
  warning: string;
}
