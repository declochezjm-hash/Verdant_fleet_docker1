import { readFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import type { AiSessionContext } from "../../db/readOnlyClient";
import { AiToolError } from "../../db/errors";
import type { ProfileRole } from "./types";

export const getProfileGuideSchema = z.object({
  role: z.enum(["admin", "coordinator", "agent", "elu-partenaire"]),
});

export type GetProfileGuideInput = z.infer<typeof getProfileGuideSchema>;

export interface GetProfileGuideOutput {
  badge: "Guide Métier";
  role: ProfileRole;
  appRole: "admin" | "coordinator" | "agent" | "partner" | null;
  filePath: string;
  contentMarkdown: string;
  loadedAt: string;
}

const PROFILE_FILES: Record<ProfileRole, string> = {
  admin: "src/docs/profiles/admin.md",
  coordinator: "src/docs/profiles/coordinator.md",
  agent: "src/docs/profiles/agent.md",
  "elu-partenaire": "src/docs/profiles/elu-partenaire.md",
};

function sessionProfileRole(ctx: AiSessionContext): ProfileRole {
  if (ctx.primaryRole === "partner") return "elu-partenaire";
  return ctx.primaryRole;
}

function assertProfileAccess(ctx: AiSessionContext, requestedRole: ProfileRole): void {
  if (ctx.primaryRole === "admin") return;
  if (sessionProfileRole(ctx) !== requestedRole) {
    throw new AiToolError(
      "INSUFFICIENT_ROLE",
      "Cette fiche métier ne correspond pas à votre profil.",
      403,
    );
  }
}

export async function getProfileGuide(
  ctx: AiSessionContext,
  rawInput: unknown,
): Promise<GetProfileGuideOutput> {
  const input = getProfileGuideSchema.parse(rawInput);
  assertProfileAccess(ctx, input.role);

  const rel = PROFILE_FILES[input.role];
  if (!rel) {
    throw new AiToolError("PROFILE_NOT_FOUND", `Profil '${input.role}' inconnu.`, 404);
  }

  const filePath = path.join(process.cwd(), rel);
  const contentMarkdown = await readFile(filePath, "utf-8");

  return {
    badge: "Guide Métier",
    role: input.role,
    appRole: input.role === "elu-partenaire" ? "partner" : input.role,
    filePath: rel,
    contentMarkdown,
    loadedAt: new Date().toISOString(),
  };
}
