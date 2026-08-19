import { z } from "zod";
import type { AiSessionContext } from "../../db/readOnlyClient";
import { createReadOnlyClient } from "../../db/readOnlyClient";
import { AiToolError } from "../../db/errors";
import { buildScopeFilters } from "../scopeGuard";
import { EQUIPMENT_STATUS_MAP } from "./mappings";
import type { ApiEquipmentStatus } from "./types";
import { assertNoDbError } from "./dbHelpers";
import { mapDbEquipmentStatus } from "./utils";

export const getEquipmentAlertsSchema = z.object({
  status: z.enum(["available", "maintenance", "broken"]).optional(),
  type: z.string().optional(),
  onlyAlerts: z.boolean().optional(),
  teamName: z.string().optional(),
});

export type GetEquipmentAlertsInput = z.infer<typeof getEquipmentAlertsSchema>;

export interface EquipmentAlertItem {
  internalId: string | null;
  name: string;
  type: string;
  status: ApiEquipmentStatus;
  hoursUsed: number;
  hoursForMaintenance: number;
  team: string | null;
  isAlert: boolean;
  recentMaintenanceCost: number | null;
}

export interface GetEquipmentAlertsOutput {
  badge: "Flotte & Matériel";
  total: number;
  immobilizedCount: number;
  alertCount: number;
  items: EquipmentAlertItem[];
}

export async function getEquipmentAlerts(
  ctx: AiSessionContext,
  rawInput: unknown,
): Promise<GetEquipmentAlertsOutput> {
  const input = getEquipmentAlertsSchema.parse(rawInput);
  const scope = buildScopeFilters(ctx);
  const client = createReadOnlyClient(ctx);

  let teamName = input.teamName ?? scope.teamName;
  if (ctx.primaryRole === "agent") {
    teamName = ctx.teamName ?? teamName;
  }

  const { data: alertRows, error: alertError } = await client
    .from("v_equipment_alerts")
    .select("id");
  assertNoDbError(alertError, "vue alertes matériel");

  const alertIds = new Set((alertRows ?? []).map((r) => r.id).filter(Boolean) as string[]);

  let query = client
    .from("equipment")
    .select(
      "id, internal_id, name, type, status, hours_used, hours_for_maintenance, team, is_archived",
    )
    .eq("is_archived", false);

  if (teamName) query = query.eq("team", teamName);
  if (input.type) query = query.ilike("type", `%${input.type}%`);
  if (input.status) {
    query = query.eq("status", EQUIPMENT_STATUS_MAP[input.status] as "OK" | "Maintenance requise" | "En panne");
  }

  const { data: equipmentRows, error: equipmentError } = await query.limit(200);
  assertNoDbError(equipmentError, "liste matériel");

  let rows = equipmentRows ?? [];
  if (input.onlyAlerts) {
    rows = rows.filter((r) => alertIds.has(r.id));
  }

  const equipmentIds = rows.map((r) => r.id);
  const maintenanceCosts = new Map<string, number>();

  if (equipmentIds.length > 0) {
    const since = new Date();
    since.setDate(since.getDate() - 90);
    const { data: logs, error: logsError } = await client
      .from("maintenance_logs")
      .select("equipment_id, cost, date")
      .in("equipment_id", equipmentIds)
      .gte("date", since.toISOString().slice(0, 10));

    assertNoDbError(logsError, "journaux maintenance");

    for (const log of logs ?? []) {
      if (!log.equipment_id) continue;
      const prev = maintenanceCosts.get(log.equipment_id) ?? 0;
      maintenanceCosts.set(log.equipment_id, prev + (log.cost ?? 0));
    }
  }

  const items: EquipmentAlertItem[] = rows.map((row) => ({
    internalId: row.internal_id,
    name: row.name,
    type: row.type,
    status: mapDbEquipmentStatus(row.status),
    hoursUsed: row.hours_used ?? 0,
    hoursForMaintenance: row.hours_for_maintenance ?? 0,
    team: row.team,
    isAlert: alertIds.has(row.id),
    recentMaintenanceCost: maintenanceCosts.get(row.id) ?? null,
  }));

  if (ctx.primaryRole === "agent" && ctx.teamName && teamName && teamName !== ctx.teamName) {
    throw new AiToolError(
      "TOOL_NOT_ALLOWED",
      "Un agent ne peut consulter que le matériel de son équipe.",
      403,
    );
  }

  return {
    badge: "Flotte & Matériel",
    total: items.length,
    immobilizedCount: items.filter((i) => i.status === "broken").length,
    alertCount: items.filter((i) => i.isAlert).length,
    items,
  };
}
