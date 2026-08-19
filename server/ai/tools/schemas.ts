import type { ChatCompletionTool } from "openai/resources/chat/completions";

export const VERDURA_AI_TOOL_DEFINITIONS: ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "getChantiersSummary",
      description:
        "Synthèse des chantiers (tasks) par statut, priorité, période ou équipe. Calcule le taux de réalisation et liste les chantiers en retard.",
      parameters: {
        type: "object",
        properties: {
          status: {
            type: "string",
            enum: ["pending", "in_progress", "completed", "cancelled"],
            description:
              "Statut du chantier. pending=planifie, in_progress=en_cours, completed=termine, cancelled=annule.",
          },
          priority: {
            type: "string",
            enum: ["normal", "high", "urgent"],
            description: "Priorité métier (normale, haute, urgente).",
          },
          teamName: {
            type: "string",
            description:
              "Nom de l'équipe Verdura (ex. 'Équipe Nord'). Correspond à tasks.team et teams.name.",
          },
          period: {
            type: "string",
            enum: ["day", "week", "month"],
            description: "Fenêtre temporelle basée sur tasks.scheduled_at.",
          },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "getEquipmentAlerts",
      description:
        "Consultation de l'état du parc (equipment) et de la vue d'alerte (v_equipment_alerts). Inclut coûts de maintenance récents.",
      parameters: {
        type: "object",
        properties: {
          status: {
            type: "string",
            enum: ["available", "maintenance", "broken"],
            description: "available=OK, maintenance=Maintenance requise, broken=En panne.",
          },
          type: {
            type: "string",
            description: "Type d'engin (equipment.type), ex. tondeuse, taille-haie.",
          },
          onlyAlerts: {
            type: "boolean",
            description:
              "Si true, restreint à v_equipment_alerts (pannes + seuil maintenance).",
          },
          teamName: {
            type: "string",
            description: "Filtre equipment.team (texte).",
          },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "getAnomaliesReport",
      description:
        "Extraction des anomalies terrain avec chantiers impactés et médias liés via photo_before_url / photo_after_url du chantier.",
      parameters: {
        type: "object",
        properties: {
          severity: {
            type: "string",
            enum: ["low", "medium", "critical"],
            description:
              "low=normale, medium=haute, critical=urgente. Colonne anomalies.priority (si absente, défaut normale).",
          },
          status: {
            type: "string",
            enum: ["open", "resolved"],
            description: "open=resolved false, resolved=resolved true.",
          },
          period: {
            type: "string",
            enum: ["day", "week", "month"],
            description: "Filtre sur anomalies.created_at.",
          },
          teamName: {
            type: "string",
            description: "Filtre via tasks.team joint.",
          },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "getProductsConformity",
      description:
        "Vérification des produits : validité AMM, stock, seuils d'alerte. EPI requis dérivés pour les produits Phyto.",
      parameters: {
        type: "object",
        properties: {
          ammNumber: {
            type: "string",
            description: "Numéro AMM exact (products.amm_number).",
          },
          searchQuery: {
            type: "string",
            description: "Recherche partielle sur products.name ou amm_number.",
          },
          onlyControlled: {
            type: "boolean",
            description: "Si true, filtre category = 'Phyto' (produits réglementés).",
          },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "getProfileGuide",
      description:
        "Charge la fiche métier Verdura (Markdown) correspondant au rôle demandé. Restitution intégrale pour les guides.",
      parameters: {
        type: "object",
        required: ["role"],
        properties: {
          role: {
            type: "string",
            enum: ["admin", "coordinator", "agent", "elu-partenaire"],
            description: "Profil métier Verdura. elu-partenaire = rôle partner virtuel.",
          },
        },
        additionalProperties: false,
      },
    },
  },
];

export const TOOL_BADGES: Record<string, string> = {
  getChantiersSummary: "Analyse Chantiers",
  getEquipmentAlerts: "Flotte & Matériel",
  getAnomaliesReport: "Suivi Incidents",
  getProductsConformity: "Conformité Phyto",
  getProfileGuide: "Guide Métier",
};
