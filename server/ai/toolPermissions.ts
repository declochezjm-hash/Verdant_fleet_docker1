import type { AiPrimaryRole } from "../db/readOnlyClient";

export const TOOL_NAMES = [
  "getChantiersSummary",
  "getEquipmentAlerts",
  "getAnomaliesReport",
  "getProductsConformity",
  "getProfileGuide",
] as const;

export type VerduraToolName = (typeof TOOL_NAMES)[number];

const TOOL_ROLE_MATRIX: Record<VerduraToolName, AiPrimaryRole[]> = {
  getChantiersSummary: ["admin", "coordinator", "agent", "partner"],
  getEquipmentAlerts: ["admin", "coordinator", "agent"],
  getAnomaliesReport: ["admin", "coordinator", "agent"],
  getProductsConformity: ["admin", "coordinator", "agent"],
  getProfileGuide: ["admin", "coordinator", "agent", "partner"],
};

export function isToolAllowed(toolName: string, role: AiPrimaryRole): toolName is VerduraToolName {
  if (!TOOL_NAMES.includes(toolName as VerduraToolName)) return false;
  return TOOL_ROLE_MATRIX[toolName as VerduraToolName].includes(role);
}
