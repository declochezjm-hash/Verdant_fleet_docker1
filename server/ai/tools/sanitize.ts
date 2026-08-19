import type { AiPrimaryRole } from "../../db/readOnlyClient";

const SENSITIVE_KEYS = new Set([
  "budget",
  "labor_cost",
  "hourly_rate",
  "hourly_cost",
  "price_per_unit",
]);

const RESTRICTED_ROLES: AiPrimaryRole[] = ["agent", "partner"];

export function sanitizeToolResultForRole(role: AiPrimaryRole, result: unknown): unknown {
  if (!RESTRICTED_ROLES.includes(role)) return result;
  return stripSensitiveFields(result);
}

function stripSensitiveFields(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(stripSensitiveFields);
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value)) {
      if (SENSITIVE_KEYS.has(key)) continue;
      out[key] = stripSensitiveFields(nested);
    }
    return out;
  }
  return value;
}
