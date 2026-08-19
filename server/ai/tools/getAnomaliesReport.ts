import { z } from "zod";
import type { AiSessionContext } from "../../db/readOnlyClient";
import { createReadOnlyClient } from "../../db/readOnlyClient";
import { buildScopeFilters } from "../scopeGuard";
import { SEVERITY_MAP } from "./mappings";
import type { ApiAnomalySeverity, ApiAnomalyStatus } from "./types";
import { assertNoDbError } from "./dbHelpers";
import { getPeriodBounds, mapDbSeverity } from "./utils";

export const getAnomaliesReportSchema = z.object({
  severity: z.enum(["low", "medium", "critical"]).optional(),
  status: z.enum(["open", "resolved"]).optional(),
  period: z.enum(["day", "week", "month"]).optional(),
  teamName: z.string().optional(),
});

export type GetAnomaliesReportInput = z.infer<typeof getAnomaliesReportSchema>;

export interface AnomalyReportItem {
  id: string;
  description: string | null;
  severity: ApiAnomalySeverity;
  status: ApiAnomalyStatus;
  createdAt: string;
  projectNumber: string | null;
  taskTitle: string | null;
  equipmentInternalId: string | null;
  equipmentName: string | null;
  attachedMediaUrls: string[];
}

export interface GetAnomaliesReportOutput {
  badge: "Suivi Incidents";
  totalOpen: number;
  total: number;
  items: AnomalyReportItem[];
}

type AnomalyRow = {
  id: string;
  description: string | null;
  resolved: boolean | null;
  created_at: string | null;
  reported_by: string | null;
  priority?: string | null;
  tasks: {
    project_number: string | null;
    title: string;
    team: string;
    client: string;
    photo_before_url: string | null;
    photo_after_url: string | null;
    task_assignments: { user_id: string }[] | null;
  } | null;
  equipment: { internal_id: string | null; name: string } | null;
};

function getAnomalyPriority(row: AnomalyRow): string {
  return row.priority ?? "normale";
}

function matchesAgentScope(row: AnomalyRow, userId: string): boolean {
  if (row.reported_by === userId) return true;
  const assignments = row.tasks?.task_assignments ?? [];
  return assignments.some((a) => a.user_id === userId);
}

export async function getAnomaliesReport(
  ctx: AiSessionContext,
  rawInput: unknown,
): Promise<GetAnomaliesReportOutput> {
  const input = getAnomaliesReportSchema.parse(rawInput);
  const scope = buildScopeFilters(ctx);
  const client = createReadOnlyClient(ctx);

  let query = client
    .from("anomalies")
    .select(
      `
      id, description, resolved, created_at, reported_by,
      tasks(project_number, title, team, client, photo_before_url, photo_after_url, task_assignments(user_id)),
      equipment(internal_id, name)
    `,
    )
    .order("created_at", { ascending: false })
    .limit(100);

  if (input.status === "open") query = query.eq("resolved", false);
  if (input.status === "resolved") query = query.eq("resolved", true);

  const { start, end } = getPeriodBounds(input.period);
  if (start) query = query.gte("created_at", start);
  if (end) query = query.lt("created_at", end);

  const teamName = input.teamName ?? scope.teamName;
  if (teamName) {
    query = query.eq("tasks.team", teamName);
  }

  const { data, error } = await query;
  assertNoDbError(error, "liste anomalies");

  let rows = (data ?? []) as unknown as AnomalyRow[];

  if (scope.assignedUserId) {
    rows = rows.filter((row) => matchesAgentScope(row, scope.assignedUserId!));
  }

  if (scope.clientNames?.length) {
    rows = rows.filter(
      (row) => row.tasks?.client && scope.clientNames!.includes(row.tasks.client),
    );
  }

  if (input.severity) {
    const dbSeverity = SEVERITY_MAP[input.severity];
    rows = rows.filter((row) => getAnomalyPriority(row) === dbSeverity);
  }

  const items: AnomalyReportItem[] = rows.map((row) => {
    const media = [row.tasks?.photo_before_url, row.tasks?.photo_after_url].filter(
      (url): url is string => Boolean(url),
    );

    return {
      id: row.id,
      description: row.description,
      severity: mapDbSeverity(getAnomalyPriority(row)),
      status: row.resolved ? "resolved" : "open",
      createdAt: row.created_at ?? new Date().toISOString(),
      projectNumber: row.tasks?.project_number ?? null,
      taskTitle: row.tasks?.title ?? null,
      equipmentInternalId: row.equipment?.internal_id ?? null,
      equipmentName: row.equipment?.name ?? null,
      attachedMediaUrls: media,
    };
  });

  return {
    badge: "Suivi Incidents",
    totalOpen: items.filter((i) => i.status === "open").length,
    total: items.length,
    items,
  };
}
