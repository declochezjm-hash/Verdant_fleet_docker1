import { z } from "zod";
import type { AiSessionContext } from "../../db/readOnlyClient";
import { createReadOnlyClient } from "../../db/readOnlyClient";
import { buildScopeFilters, type ScopeFilters } from "../scopeGuard";
import { PRIORITY_MAP, TASK_STATUS_MAP } from "./mappings";
import type { ApiPeriod, ApiPriority, ApiTaskStatus } from "./types";
import { assertNoDbError } from "./dbHelpers";
import {
  computeDelayDays,
  getPeriodBounds,
  mapDbPriority,
  mapDbTaskStatus,
} from "./utils";

export const getChantiersSummarySchema = z.object({
  status: z.enum(["pending", "in_progress", "completed", "cancelled"]).optional(),
  priority: z.enum(["normal", "high", "urgent"]).optional(),
  teamName: z.string().optional(),
  period: z.enum(["day", "week", "month"]).optional(),
  onlyOverdue: z
    .boolean()
    .optional()
    .describe(
      "Si true, ne retourne que les chantiers en retard (planifie/en_cours dont scheduled_at est dépassé).",
    ),
});

export type GetChantiersSummaryInput = z.infer<typeof getChantiersSummarySchema>;

export interface ChantierListItem {
  projectNumber: string | null;
  title: string;
  client: string;
  address: string;
  status: ApiTaskStatus;
  priority: ApiPriority;
  scheduledAt: string;
  delayDays: number | null;
}

export interface GetChantiersSummaryOutput {
  badge: "Analyse Chantiers";
  total: number;
  completedCount: number;
  completionRatePct: number;
  overdueCount: number;
  filters: GetChantiersSummaryInput;
  items: ChantierListItem[];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TaskQuery = any;

function applyTaskFilters(
  query: TaskQuery,
  input: GetChantiersSummaryInput,
  scope: ScopeFilters,
): TaskQuery {
  let q = query;
  const team = input.teamName ?? scope.teamName;
  if (team) q = q.eq("team", team);
  if (input.status) q = q.eq("status", TASK_STATUS_MAP[input.status]);
  if (input.priority) q = q.eq("priority", PRIORITY_MAP[input.priority]);

  const { start, end } = getPeriodBounds(input.period as ApiPeriod | undefined);
  if (start) q = q.gte("scheduled_at", start);
  if (end) q = q.lt("scheduled_at", end);
  if (input.onlyOverdue) {
    const now = new Date().toISOString();
    q = q.in("status", ["planifie", "en_cours"]).lt("scheduled_at", now);
  }
  if (scope.clientNames?.length) q = q.in("client", scope.clientNames);
  return q;
}

export async function getChantiersSummary(
  ctx: AiSessionContext,
  rawInput: unknown,
): Promise<GetChantiersSummaryOutput> {
  const input = getChantiersSummarySchema.parse(rawInput);
  const scope = buildScopeFilters(ctx);
  const client = createReadOnlyClient(ctx);
  const now = new Date().toISOString();

  const countSelect = scope.assignedUserId
    ? "id, task_assignments!inner(user_id)"
    : "id";

  let totalQuery = client.from("tasks").select(countSelect, { count: "exact", head: true });
  if (scope.assignedUserId) {
    totalQuery = totalQuery.eq("task_assignments.user_id", scope.assignedUserId);
  }
  totalQuery = applyTaskFilters(totalQuery, input, scope);
  const { count: total, error: totalError } = await totalQuery;
  assertNoDbError(totalError, "comptage chantiers");

  let completedQuery = client
    .from("tasks")
    .select(countSelect, { count: "exact", head: true })
    .eq("status", "termine");
  if (scope.assignedUserId) {
    completedQuery = completedQuery.eq("task_assignments.user_id", scope.assignedUserId);
  }
  completedQuery = applyTaskFilters(completedQuery, input, scope);
  const { count: completedCount, error: completedError } = await completedQuery;
  assertNoDbError(completedError, "comptage chantiers terminés");

  let overdueQuery = client
    .from("tasks")
    .select(countSelect, { count: "exact", head: true })
    .in("status", ["planifie", "en_cours"])
    .lt("scheduled_at", now);
  if (scope.assignedUserId) {
    overdueQuery = overdueQuery.eq("task_assignments.user_id", scope.assignedUserId);
  }
  overdueQuery = applyTaskFilters(overdueQuery, input, scope);
  const { count: overdueCount, error: overdueError } = await overdueQuery;
  assertNoDbError(overdueError, "comptage chantiers en retard");

  const listSelect = scope.assignedUserId
    ? "id, project_number, title, client, address, status, priority, scheduled_at, task_assignments!inner(user_id)"
    : "id, project_number, title, client, address, status, priority, scheduled_at";

  let listQuery = client
    .from("tasks")
    .select(listSelect)
    .order("scheduled_at", { ascending: true })
    .limit(50);

  if (scope.assignedUserId) {
    listQuery = listQuery.eq("task_assignments.user_id", scope.assignedUserId);
  }
  listQuery = applyTaskFilters(listQuery, input, scope);

  const { data, error: listError } = await listQuery;
  assertNoDbError(listError, "liste chantiers");

  const seen = new Set<string>();
  const items: ChantierListItem[] = [];

  for (const row of (data ?? []) as unknown[]) {
    const typed = row as {
      id: string;
      project_number: string | null;
      title: string;
      client: string;
      address: string;
      status: string | null;
      priority: string | null;
      scheduled_at: string;
    };
    if (seen.has(typed.id)) continue;
    seen.add(typed.id);

    items.push({
      projectNumber: typed.project_number,
      title: typed.title,
      client: typed.client,
      address: typed.address,
      status: mapDbTaskStatus(typed.status),
      priority: mapDbPriority(typed.priority),
      scheduledAt: typed.scheduled_at,
      delayDays: computeDelayDays(typed.status, typed.scheduled_at),
    });
  }

  const filteredItems = input.onlyOverdue
    ? items.filter((item) => item.delayDays !== null && item.delayDays > 0)
    : items;

  const totalNum = total ?? 0;
  const completedNum = completedCount ?? 0;

  return {
    badge: "Analyse Chantiers",
    total: totalNum,
    completedCount: completedNum,
    completionRatePct: totalNum > 0 ? Math.round((completedNum / totalNum) * 1000) / 10 : 0,
    overdueCount: overdueCount ?? 0,
    filters: input,
    items: filteredItems,
  };
}
