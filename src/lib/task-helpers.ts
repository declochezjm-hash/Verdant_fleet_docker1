export const TASK_STATUS_LABELS: Record<string, string> = {
  planifie: "Planifié",
  en_cours: "En cours",
  termine: "Terminé",
  annule: "Annulé",
};

export type TaskStatus = keyof typeof TASK_STATUS_LABELS;

export const getStatusVariant = (status: string): "default" | "secondary" | "outline" | "destructive" => {
  switch (status) {
    case "termine":
      return "secondary";
    case "en_cours":
      return "default";
    case "annule":
      return "destructive";
    default:
      return "outline";
  }
};