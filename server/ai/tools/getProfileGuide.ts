import { readFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import type { AiSessionContext } from "../../db/readOnlyClient";
import { AiToolError } from "../../db/errors";
import type { GuideKey, ProfileRole, ReferentialGuide } from "./types";

export const getProfileGuideSchema = z.object({
  role: z.enum([
    "admin",
    "coordinator",
    "agent",
    "elu-partenaire",
    "espaces-verts",
    "materiel-vehicules",
  ]),
});

export type GetProfileGuideInput = z.infer<typeof getProfileGuideSchema>;

export interface GetProfileGuideOutput {
  badge: string;
  role: GuideKey;
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

const REFERENTIAL_FILES: Record<ReferentialGuide, string> = {
  "espaces-verts": "docs/REFERENTIEL_ESPACES_VERTS.md",
  "materiel-vehicules": "docs/REFERENTIEL_MATERIEL_VEHICULES.md",
};

const GUIDE_BADGES: Record<GuideKey, string> = {
  admin: "Guide Métier",
  coordinator: "Guide Métier",
  agent: "Guide Métier",
  "elu-partenaire": "Guide Métier",
  "espaces-verts": "Référentiel Espaces Verts",
  "materiel-vehicules": "Référentiel Matériel",
};

function isReferentialGuide(role: GuideKey): role is ReferentialGuide {
  return role === "espaces-verts" || role === "materiel-vehicules";
}

function sessionProfileRole(ctx: AiSessionContext): ProfileRole {
  if (ctx.primaryRole === "partner") return "elu-partenaire";
  return ctx.primaryRole;
}

function assertProfileAccess(ctx: AiSessionContext, requestedRole: GuideKey): void {
  if (isReferentialGuide(requestedRole)) return;
  if (ctx.primaryRole === "admin") return;
  if (sessionProfileRole(ctx) !== requestedRole) {
    throw new AiToolError(
      "INSUFFICIENT_ROLE",
      "Cette fiche métier ne correspond pas à votre profil.",
      403,
    );
  }
}

function resolveGuideFile(role: GuideKey): string {
  if (isReferentialGuide(role)) return REFERENTIAL_FILES[role];
  return PROFILE_FILES[role];
}

export async function getProfileGuide(
  ctx: AiSessionContext,
  rawInput: unknown,
): Promise<GetProfileGuideOutput> {
  const input = getProfileGuideSchema.parse(rawInput);
  assertProfileAccess(ctx, input.role);

  const rel = resolveGuideFile(input.role);
  if (!rel) {
    throw new AiToolError("PROFILE_NOT_FOUND", `Guide '${input.role}' inconnu.`, 404);
  }

  const filePath = path.join(process.cwd(), rel);
  let contentMarkdown: string;
  try {
    contentMarkdown = await readFile(filePath, "utf-8");
  } catch {
    throw new AiToolError(
      "PROFILE_NOT_FOUND",
      `Fichier guide introuvable : ${rel}`,
      404,
    );
  }

  return {
    badge: GUIDE_BADGES[input.role],
    role: input.role,
    appRole: input.role === "elu-partenaire" ? "partner" : isReferentialGuide(input.role) ? null : input.role,
    filePath: rel,
    contentMarkdown,
    loadedAt: new Date().toISOString(),
  };
}
