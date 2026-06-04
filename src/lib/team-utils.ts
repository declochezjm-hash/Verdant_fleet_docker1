/**
 * Retourne la couleur associée à une équipe.
 * Priorité : 
 * 1. Couleur définie en base de données (teamsData)
 * 2. Couleurs par défaut (Nord = Vert, Sud = Bleu)
 * 3. Couleur de repli (fallback) ou gris ardoise
 */
export const getTeamColor = (
  teamName: string | null | undefined, 
  teamsData: { name: string, color: string }[] = [], 
  fallback?: string
): string => {
  if (!teamName) return fallback || "#94a3b8";
  const found = teamsData.find(t => t.name === teamName);
  if (found?.color) return found.color;
  if (teamName === "Équipe Nord") return "#22c55e"; // Vert
  if (teamName === "Équipe Sud") return "#3b82f6";  // Bleu
  return fallback || "#94a3b8";
};