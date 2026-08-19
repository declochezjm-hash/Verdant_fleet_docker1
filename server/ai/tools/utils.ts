import type { ApiAnomalySeverity, ApiEquipmentStatus, ApiPeriod, ApiPriority, ApiTaskStatus } from "./types";
import {
  EQUIPMENT_STATUS_MAP,
  PRIORITY_MAP,
  TASK_STATUS_MAP,
} from "./mappings";

export function getPeriodBounds(period?: ApiPeriod): { start?: string; end?: string } {
  if (!period) return {};

  const now = new Date();
  const start = new Date(now);

  if (period === "day") {
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    return { start: start.toISOString(), end: end.toISOString() };
  }

  if (period === "week") {
    const day = start.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    start.setDate(start.getDate() + diff);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    return { start: start.toISOString(), end: end.toISOString() };
  }

  start.setDate(1);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setMonth(end.getMonth() + 1);
  return { start: start.toISOString(), end: end.toISOString() };
}

export function mapDbTaskStatus(status: string | null): ApiTaskStatus {
  const entry = Object.entries(TASK_STATUS_MAP).find(([, db]) => db === status);
  return (entry?.[0] as ApiTaskStatus) ?? "pending";
}

export function mapDbPriority(priority: string | null): ApiPriority {
  const entry = Object.entries(PRIORITY_MAP).find(([, db]) => db === priority);
  return (entry?.[0] as ApiPriority) ?? "normal";
}

export function mapDbEquipmentStatus(status: string | null): ApiEquipmentStatus {
  const entry = Object.entries(EQUIPMENT_STATUS_MAP).find(([, db]) => db === status);
  return (entry?.[0] as ApiEquipmentStatus) ?? "available";
}

export function mapDbSeverity(priority: string | null | undefined): ApiAnomalySeverity {
  const value = priority ?? "normale";
  if (value === "urgente") return "critical";
  if (value === "haute") return "medium";
  return "low";
}

export function computeDelayDays(
  status: string | null,
  scheduledAt: string | null,
): number | null {
  if (!scheduledAt || !status || !["planifie", "en_cours"].includes(status)) {
    return null;
  }
  const scheduled = new Date(scheduledAt);
  if (scheduled >= new Date()) return null;
  const diffMs = Date.now() - scheduled.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}
