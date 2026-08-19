import type {
  ApiAnomalySeverity,
  ApiEquipmentStatus,
  ApiPriority,
  ApiTaskStatus,
} from "./types";

export const TASK_STATUS_MAP: Record<ApiTaskStatus, string> = {
  pending: "planifie",
  in_progress: "en_cours",
  completed: "termine",
  cancelled: "annule",
};

export const PRIORITY_MAP: Record<ApiPriority, string> = {
  normal: "normale",
  high: "haute",
  urgent: "urgente",
};

export const EQUIPMENT_STATUS_MAP: Record<ApiEquipmentStatus, string> = {
  available: "OK",
  maintenance: "Maintenance requise",
  broken: "En panne",
};

export const SEVERITY_MAP: Record<ApiAnomalySeverity, string> = {
  low: "normale",
  medium: "haute",
  critical: "urgente",
};

/** Inverse mapping — utile pour les tests unitaires Sprint 1. */
export function mapTaskStatusToApi(dbStatus: string): ApiTaskStatus | null {
  const entry = Object.entries(TASK_STATUS_MAP).find(([, v]) => v === dbStatus);
  return entry ? (entry[0] as ApiTaskStatus) : null;
}
