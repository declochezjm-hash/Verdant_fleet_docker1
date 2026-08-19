import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildScopeFilters } from "../scopeGuard";
import { isToolAllowed, TOOL_NAMES } from "../toolPermissions";
import { getToolsForRole } from "../tools/index";
import { sanitizeToolResultForRole } from "../tools/sanitize";
import { createReadOnlyClient, type AiSessionContext } from "../../db/readOnlyClient";
import { AiToolError } from "../../db/errors";

const mockCtx: AiSessionContext = {
  userId: "user-test-001",
  accessToken: "token-test",
  primaryRole: "agent",
  teamName: "Équipe Nord",
  clientScope: null,
  organizationId: null,
};

describe("Sprint 4 — RBAC outils (R1–R10)", () => {
  it("R-admin : le rôle admin accède aux 5 outils", () => {
    const tools = getToolsForRole("admin");
    assert.equal(tools.length, 5);
    for (const name of TOOL_NAMES) {
      assert.equal(isToolAllowed(name, "admin"), true);
    }
  });

  it("R-agent : pas d'accès matériel pour le rôle partner", () => {
    assert.equal(isToolAllowed("getEquipmentAlerts", "partner"), false);
    assert.equal(isToolAllowed("getProductsConformity", "partner"), false);
  });

  it("R-agent : agent limité aux outils terrain autorisés", () => {
    assert.equal(isToolAllowed("getChantiersSummary", "agent"), true);
    assert.equal(isToolAllowed("getEquipmentAlerts", "agent"), true);
    assert.equal(isToolAllowed("getProfileGuide", "agent"), true);
  });

  it("R1 : scope agent restreint aux chantiers assignés", () => {
    const scope = buildScopeFilters(mockCtx);
    assert.equal(scope.assignedUserId, mockCtx.userId);
    assert.equal(scope.teamName, mockCtx.teamName);
  });

  it("R-partner : scope client requis", () => {
    assert.throws(
      () =>
        buildScopeFilters({
          ...mockCtx,
          primaryRole: "partner",
          clientScope: null,
        }),
      (err: unknown) => err instanceof AiToolError && err.code === "SCOPE_MISSING",
    );
  });
});

describe("Sprint 4 — Sécurité (S1–S5)", () => {
  it("S1/S3 : readOnlyClient bloque INSERT/UPDATE/DELETE", () => {
    process.env.SUPABASE_URL = process.env.SUPABASE_URL || "https://example.supabase.co";
    process.env.SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || "test-anon-key-012345678901234567890";

    const client = createReadOnlyClient(mockCtx);
    const builder = client.from("tasks");

    for (const method of ["insert", "update", "upsert", "delete"] as const) {
      assert.throws(
        () => {
          const fn = (builder as unknown as Record<string, (...args: unknown[]) => void>)[method];
          fn({});
        },
        (err: unknown) => err instanceof AiToolError && err.code === "WRITE_FORBIDDEN",
      );
    }
  });

  it("S4/R9 : masquage colonnes sensibles pour agent", () => {
    const raw = {
      items: [{ title: "Chantier A", budget: 12000, labor_cost: 4000, hourly_rate: 35 }],
    };
    const sanitized = sanitizeToolResultForRole("agent", raw) as typeof raw;
    assert.equal(sanitized.items[0].budget, undefined);
    assert.equal(sanitized.items[0].labor_cost, undefined);
    assert.equal(sanitized.items[0].hourly_rate, undefined);
    assert.equal(sanitized.items[0].title, "Chantier A");
  });

  it("S4 : admin conserve les champs financiers", () => {
    const raw = { budget: 5000, labor_cost: 1000 };
    const sanitized = sanitizeToolResultForRole("admin", raw) as typeof raw;
    assert.equal(sanitized.budget, 5000);
    assert.equal(sanitized.labor_cost, 1000);
  });
});

describe("Sprint 4 — Export markdown (R10 / U)", () => {
  it("U-export : fichier structuré et daté", async () => {
    const { buildConversationMarkdown } = await import("../../../src/lib/verdura-chat-export");
    const exportedAt = new Date("2026-08-20T10:00:00.000Z");
    const md = buildConversationMarkdown(
      [
        {
          id: "1",
          role: "user",
          content: "Bonjour",
          createdAt: exportedAt.toISOString(),
        },
        {
          id: "2",
          role: "assistant",
          content: "Réponse test",
          createdAt: exportedAt.toISOString(),
          metadata: { toolBadge: "Analyse Chantiers" },
        },
      ],
      "Chantier C2024-01",
      "coordinator",
      exportedAt,
    );

    assert.match(md, /^# Conversation Verdura — 2026-08-20/);
    assert.match(md, /> Contexte : Chantier C2024-01/);
    assert.match(md, /## Utilisateur/);
    assert.match(md, /## Verdura \[Analyse Chantiers\]/);
    assert.match(md, /> Exporté le :/);
  });
});
