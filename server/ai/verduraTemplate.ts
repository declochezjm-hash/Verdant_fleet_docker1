import { readFile } from "node:fs/promises";
import path from "node:path";
import type { AiPrimaryRole, AiSessionContext } from "../db/readOnlyClient";

export interface VerduraPageContext {
  currentPath?: string;
  currentEntity?: Record<string, string | undefined>;
}

const PROFILE_FILES: Record<AiPrimaryRole, string> = {
  admin: "src/docs/profiles/admin.md",
  coordinator: "src/docs/profiles/coordinator.md",
  agent: "src/docs/profiles/agent.md",
  partner: "src/docs/profiles/elu-partenaire.md",
};

async function loadProfileMarkdown(role: AiPrimaryRole): Promise<string> {
  const rel = PROFILE_FILES[role];
  const filePath = path.join(process.cwd(), rel);
  try {
    return await readFile(filePath, "utf-8");
  } catch {
    return `*(Fiche métier ${role} non disponible)*`;
  }
}

function buildContextHints(page: VerduraPageContext): string {
  const lines: string[] = [];
  if (page.currentPath) {
    lines.push(`- Page active : \`${page.currentPath}\``);
  }
  if (page.currentEntity && Object.keys(page.currentEntity).length > 0) {
    const entity = Object.entries(page.currentEntity)
      .filter(([, v]) => v)
      .map(([k, v]) => `${k}=${v}`)
      .join(", ");
    if (entity) lines.push(`- Entité contextuelle : ${entity}`);
  }
  return lines.length ? lines.join("\n") : "- Aucun contexte de page spécifique.";
}

function buildRoleRestrictions(role: AiPrimaryRole): string {
  switch (role) {
    case "agent":
      return [
        "- Ne pas exposer budget, labor_cost, hourly_rate.",
        "- Chantiers : uniquement ceux assignés à l'utilisateur.",
        "- Matériel : uniquement l'équipe de l'agent.",
      ].join("\n");
    case "coordinator":
      return [
        "- Pilotage équipe : pas d'accès global multi-organisation.",
        "- Masquer les données financières sensibles hors périmètre équipe.",
      ].join("\n");
    case "partner":
      return [
        "- Filtrer strictement par client_scope.",
        "- NE JAMAIS exposer : budget, labor_cost, hourly_rate, noms agents, anomalies détaillées.",
      ].join("\n");
    default:
      return "- Accès complet aux données autorisées par les outils.";
  }
}

export async function buildVerduraSystemPrompt(
  ctx: AiSessionContext,
  page: VerduraPageContext,
): Promise<string> {
  const profileMarkdown = await loadProfileMarkdown(ctx.primaryRole);

  return `Tu es Verdura, l'assistant IA pour la gestion des espaces verts.

## Profil utilisateur connecté
${profileMarkdown}

## Contraintes techniques
- Rôle session : ${ctx.primaryRole}
- Identifiant utilisateur : ${ctx.userId}
- Équipe : ${ctx.teamName ?? "non renseignée"}
- Tu DOIS utiliser les outils disponibles pour interroger la base — n'invente jamais de données.
- Vocabulaire : chantier = tasks, n° chantier = project_number, engin = equipment.internal_id, AMM = products.amm_number.

## Contexte navigation
${buildContextHints(page)}

## Interdictions pour ce profil
${buildRoleRestrictions(ctx.primaryRole)}

## Format de réponse
- Ton sobre, orienté terrain et espaces verts.
- Par défaut : réponses concises (5 à 6 lignes maximum).
- Exception : si l'utilisateur demande un guide métier ou que tu appelles getProfileGuide, restitue le contenu intégralement.
- Cite les identifiants métier (project_number, internal_id, amm_number) quand pertinent.
- Utilise des listes pour les synthèses multi-éléments.`;
}
