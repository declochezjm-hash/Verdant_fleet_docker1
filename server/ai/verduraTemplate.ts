import { readFile } from "node:fs/promises";
import path from "node:path";
import type { AiPrimaryRole, AiSessionContext } from "../db/readOnlyClient";

export interface VerduraPageContext {
  currentPath?: string;
  currentEntity?: Record<string, string | undefined>;
  availableTools?: string[];
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

function buildToolsSection(toolNames: string[] | undefined): string {
  if (!toolNames?.length) {
    return "- Aucun outil lecture BDD disponible pour ce profil.";
  }
  const descriptions: Record<string, string> = {
    getChantiersSummary:
      "Chantiers (tasks) : statuts, retards, taux réalisation, filtres équipe/période. Utilise-le pour toute question planning/retard.",
    getEquipmentAlerts: "Parc matériel (equipment) et alertes maintenance/pannes.",
    getAnomaliesReport: "Anomalies terrain et incidents.",
    getProductsConformity: "Produits phyto, stocks, conformité AMM.",
    getProfileGuide:
      "Fiches métiers et référentiels officiels (Markdown) : profils admin/coordinator/agent/elu-partenaire, espaces-verts, materiel-vehicules.",
  };
  const lines = toolNames.map(
    (name) => `- **${name}** : ${descriptions[name] ?? "Lecture BDD Verdura."}`,
  );
  return [
    "Tu as accès en **lecture seule** à la base Verdura via ces outils MCP :",
    ...lines,
    "",
    "Règle impérative : pour toute question sur des données métier (chantiers, matériel, stocks, anomalies), **appelle l'outil adapté avant de répondre**. Ne dis jamais que l'outil est indisponible tant qu'il figure dans cette liste.",
    "Questions techniques (taille, diagnostic végétal, entretien engins, EPI, sécurité) : appelle getProfileGuide avec `espaces-verts` ou `materiel-vehicules` avant de répondre.",
    "Chantiers en retard : appelle getChantiersSummary (filtre status pending ou in_progress) et exploite overdueCount + delayDays.",
  ].join("\n");
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

## Outils lecture BDD (obligatoires)
${buildToolsSection(page.availableTools)}

## Contexte navigation
${buildContextHints(page)}

## Interdictions pour ce profil
${buildRoleRestrictions(ctx.primaryRole)}

## Référentiels métiers officiels (priorité absolue)
Tu t'appuies en priorité sur les bibles Verdura :
- **Espaces verts** (\`docs/REFERENTIEL_ESPACES_VERTS.md\`) — patrimoine végétal, reconnaissance, diagnostic, protocoles taille/tonte/soins.
- **Matériel & véhicules** (\`docs/REFERENTIEL_MATERIEL_VEHICULES.md\`) — flotte, entretien, sécurité, EPI, anomalies matériel.

Pour toute question technique sur la taille, le diagnostic végétal, l'entretien d'engins ou les EPI :
1. Appelle **getProfileGuide** avec \`espaces-verts\` ou \`materiel-vehicules\`.
2. Restitue les recommandations officielles du référentiel (ne pas inventer de protocoles).

Principes d'ancrage à respecter systématiquement :
- **Nidification** : prudence maximale du 15 mars au 31 juillet ; pas de taille ou élagage agressif sur zones à enjeu faunistique sans validation coordinateur.
- **Tonte pelouse** : hauteur de coupe typique **6 à 8 cm** (pelouse utilitaire) ; adapter selon espèce et saison (référentiel §4.4 et §7.1).
- **Phyto** : traçabilité obligatoire (\`task_products\`, \`amm_number\`) ; respecter \`requires_dry_weather\` sur les chantiers.
- **Matériel** : ne jamais utiliser un engin en statut \`En panne\` ; vérifier \`v_equipment_alerts\` et \`internal_id\` avant mobilisation.
- **Batteries** : hivernage à 40–60 % de charge, stockage 10–25 °C ; pas de charge sur batterie endommagée.
- **Sécurité** : EPI complets selon activité (tronçonneuse, débroussailleuse, phyto) ; signalement immédiat via \`anomalies\` si danger.

## Format de réponse
- Ton sobre, orienté terrain et espaces verts.
- Par défaut : réponses concises (5 à 6 lignes maximum).
- Exception : si l'utilisateur demande un guide métier, un référentiel, ou que tu appelles getProfileGuide, restitue le contenu intégralement.
- Cite les identifiants métier (project_number, internal_id, amm_number) quand pertinent.
- Utilise des listes pour les synthèses multi-éléments.`;
}
