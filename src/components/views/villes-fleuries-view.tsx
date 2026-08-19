import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Loader2, Plus, Flower, Calendar, MapPin, CheckCircle2, AlertTriangle, Trash2, Pencil, Info } from "lucide-react";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

type CriteriaStatus = "Inexistant" | "Initié" | "Réalisé" | "Conforté";

interface CriteriaEvaluation {
  status: CriteriaStatus;
  comment: string;
}

interface VillesFleuriesCriteria {
  jury_project: {
    composition_dossier: CriteriaEvaluation;
    binome_elu_technicien: CriteriaEvaluation;
    coherence_projet: CriteriaEvaluation;
    transversalite: CriteriaEvaluation;
    concertation: CriteriaEvaluation;
    gestion_differenciee: CriteriaEvaluation;
    presence_vegetal_annee: CriteriaEvaluation;
  };
  animation_promotion: {
    info_habitants: CriteriaEvaluation;
    pedagogie: CriteriaEvaluation;
    promotion_label: CriteriaEvaluation;
    actions_touristes: CriteriaEvaluation;
  };
  patrimoine_vegetal: {
    arbres: CriteriaEvaluation;
    arbustes_grimpantes: CriteriaEvaluation;
    pelouses_prairies: CriteriaEvaluation;
    fleurissement: CriteriaEvaluation;
  };
  gestion_environnementale: {
    connaissance_biodiversite: CriteriaEvaluation;
    protection_sols: CriteriaEvaluation;
    gestion_eau: CriteriaEvaluation;
    valorisation_dechets_verts: CriteriaEvaluation;
    methodes_alternatives: CriteriaEvaluation;
    economies_energie: CriteriaEvaluation;
    ilots_fraicheur: CriteriaEvaluation;
  };
  qualite_espace_public: {
    patrimoine_bati: CriteriaEvaluation;
    proprete: CriteriaEvaluation;
    mobilier_urbain: CriteriaEvaluation;
    accessibilite: CriteriaEvaluation;
    sante_bien_etre: CriteriaEvaluation;
  };
  analyse_par_espace: {
    entrees_centre: CriteriaEvaluation;
    cimetiere: CriteriaEvaluation;
    parcs_jardins: CriteriaEvaluation;
  };
}

interface VilleFleurieEvaluation {
  id: string;
  created_at: string;
  commune_name: string;
  visit_date: string;
  evaluated_level: string;
  jury_decision: string;
  conclusions: string;
  recommendations: string;
  evaluation_criteria: VillesFleuriesCriteria;
}

const initialCriteriaState: VillesFleuriesCriteria = {
  jury_project: {
    composition_dossier: { status: "Inexistant", comment: "" },
    binome_elu_technicien: { status: "Inexistant", comment: "" },
    coherence_projet: { status: "Inexistant", comment: "" },
    transversalite: { status: "Inexistant", comment: "" },
    concertation: { status: "Inexistant", comment: "" },
    gestion_differenciee: { status: "Inexistant", comment: "" },
    presence_vegetal_annee: { status: "Inexistant", comment: "" },
  },
  animation_promotion: {
    info_habitants: { status: "Inexistant", comment: "" },
    pedagogie: { status: "Inexistant", comment: "" },
    promotion_label: { status: "Inexistant", comment: "" },
    actions_touristes: { status: "Inexistant", comment: "" },
  },
  patrimoine_vegetal: {
    arbres: { status: "Inexistant", comment: "" },
    arbustes_grimpantes: { status: "Inexistant", comment: "" },
    pelouses_prairies: { status: "Inexistant", comment: "" },
    fleurissement: { status: "Inexistant", comment: "" },
  },
  gestion_environnementale: {
    connaissance_biodiversite: { status: "Inexistant", comment: "" },
    protection_sols: { status: "Inexistant", comment: "" },
    gestion_eau: { status: "Inexistant", comment: "" },
    valorisation_dechets_verts: { status: "Inexistant", comment: "" },
    methodes_alternatives: { status: "Inexistant", comment: "" },
    economies_energie: { status: "Inexistant", comment: "" },
    ilots_fraicheur: { status: "Inexistant", comment: "" },
  },
  qualite_espace_public: {
    patrimoine_bati: { status: "Inexistant", comment: "" },
    proprete: { status: "Inexistant", comment: "" },
    mobilier_urbain: { status: "Inexistant", comment: "" },
    accessibilite: { status: "Inexistant", comment: "" },
    sante_bien_etre: { status: "Inexistant", comment: "" },
  },
  analyse_par_espace: {
    entrees_centre: { status: "Inexistant", comment: "" },
    cimetiere: { status: "Inexistant", comment: "" },
    parcs_jardins: { status: "Inexistant", comment: "" },
  },
};

export function VillesFleuriesView() {
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingEvaluation, setEditingEvaluation] = useState<VilleFleurieEvaluation | null>(null);
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);
  const [evaluationToDelete, setEvaluationToDelete] = useState<string | null>(null);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const { data: evaluations, isLoading } = useQuery<VilleFleurieEvaluation[]>({
    queryKey: ["villes-fleuries-evaluations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("villes_fleuries_evaluations")
        .select("*")
        .order("visit_date", { ascending: false });
      if (error) throw error;
      
      // Fusion profonde pour éviter les crashs sur des critères partiels
      return (data || []).map(evalItem => ({
        ...evalItem,
        evaluation_criteria: {
          jury_project: { ...initialCriteriaState.jury_project, ...evalItem.evaluation_criteria?.jury_project },
          animation_promotion: { ...initialCriteriaState.animation_promotion, ...evalItem.evaluation_criteria?.animation_promotion },
          patrimoine_vegetal: { ...initialCriteriaState.patrimoine_vegetal, ...evalItem.evaluation_criteria?.patrimoine_vegetal },
          gestion_environnementale: { ...initialCriteriaState.gestion_environnementale, ...evalItem.evaluation_criteria?.gestion_environnementale },
          qualite_espace_public: { ...initialCriteriaState.qualite_espace_public, ...evalItem.evaluation_criteria?.qualite_espace_public },
          analyse_par_espace: { ...initialCriteriaState.analyse_par_espace, ...evalItem.evaluation_criteria?.analyse_par_espace },
        }
      }));
    },
  });

  const upsertEvaluationMutation = useMutation({
    mutationFn: async (evaluation: Partial<VilleFleurieEvaluation>) => {
      const { error } = await supabase.from("villes_fleuries_evaluations").upsert(evaluation);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["villes-fleuries-evaluations"] });
      toast.success("Évaluation enregistrée !");
      setIsDialogOpen(false);
      setEditingEvaluation(null);
    },
    onError: (error: Error) => toast.error(`Erreur : ${error.message}`),
  });

  const deleteEvaluationMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("villes_fleuries_evaluations").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["villes-fleuries-evaluations"] });
      toast.success("Évaluation supprimée !");
      setIsConfirmDeleteOpen(false);
      setEvaluationToDelete(null);
    },
    onError: (error: Error) => toast.error(`Erreur : ${error.message}`),
  });

  const handleNewEvaluation = () => {
    setEditingEvaluation({
      id: "",
      created_at: new Date().toISOString(),
      commune_name: "",
      visit_date: format(new Date(), "yyyy-MM-dd"),
      evaluated_level: "Niveau 1",
      jury_decision: "Maintien",
      conclusions: "",
      recommendations: "",
      evaluation_criteria: initialCriteriaState,
    });
    setIsDialogOpen(true);
  };

  const handleEditEvaluation = (evaluation: VilleFleurieEvaluation) => {
    setEditingEvaluation(evaluation);
    setIsDialogOpen(true);
  };

  const handleDeleteClick = (id: string) => {
    setEvaluationToDelete(id);
    setIsConfirmDeleteOpen(true);
  };

  const handleConfirmDelete = () => {
    if (evaluationToDelete) {
      deleteEvaluationMutation.mutate(evaluationToDelete);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Villes et Villages Fleuris</h1>
          <p className="text-sm text-muted-foreground">Suivi des évaluations des communes.</p>
        </div>
        <Button onClick={handleNewEvaluation}>
          <Plus className="mr-2 h-4 w-4" /> Nouvelle Évaluation
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {evaluations?.map((evaluation) => (
          <Card key={evaluation.id}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-lg font-semibold">{evaluation.commune_name}</CardTitle>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" onClick={() => handleEditEvaluation(evaluation)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => handleDeleteClick(evaluation.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p className="flex items-center gap-2">
                <Calendar className="h-4 w-4" /> Visite: {isMounted 
                  ? format(parseISO(evaluation.visit_date), "dd MMMM yyyy", { locale: fr })
                  : evaluation.visit_date}
              </p>
              <p className="flex items-center gap-2">
                <Flower className="h-4 w-4" /> Niveau: {evaluation.evaluated_level}
              </p>
              <p className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" /> Décision: {evaluation.jury_decision}
              </p>
              {evaluation.conclusions && (
                <p className="flex items-start gap-2">
                  <Info className="h-4 w-4 shrink-0" /> Conclusions: {evaluation.conclusions}
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingEvaluation?.id ? "Modifier l'évaluation" : "Nouvelle évaluation"}</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (editingEvaluation) {
                upsertEvaluationMutation.mutate(editingEvaluation);
              }
            }}
            className="space-y-6 py-4"
          >
            <section className="space-y-4">
              <h3 className="text-lg font-semibold border-b pb-2">Métadonnées de la visite</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="commune_name">Nom de la commune</Label>
                  <Input
                    id="commune_name"
                    value={editingEvaluation?.commune_name || ""}
                    onChange={(e) =>
                      setEditingEvaluation({ ...editingEvaluation!, commune_name: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="visit_date">Date de la visite</Label>
                  <Input
                    id="visit_date"
                    type="date"
                    value={editingEvaluation?.visit_date || ""}
                    onChange={(e) =>
                      setEditingEvaluation({ ...editingEvaluation!, visit_date: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="evaluated_level">Niveau évalué</Label>
                  <Select
                    value={editingEvaluation?.evaluated_level || ""}
                    onValueChange={(value) =>
                      setEditingEvaluation({ ...editingEvaluation!, evaluated_level: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner le niveau" />
                    </SelectTrigger>
                    <SelectContent>
                      {["Niveau 1", "Niveau 2", "Niveau 3", "Niveau 4"].map((level) => (
                        <SelectItem key={level} value={level}>{level}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="jury_decision">Décision du jury</Label>
                  <Select
                    value={editingEvaluation?.jury_decision || ""}
                    onValueChange={(value) =>
                      setEditingEvaluation({ ...editingEvaluation!, jury_decision: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner la décision" />
                    </SelectTrigger>
                    <SelectContent>
                      {["Maintien", "1 Fleur", "2 Fleurs", "3 Fleurs", "4 Fleurs", "Prix", "Avertissement", "Retrait"].map((decision) => (
                        <SelectItem key={decision} value={decision}>{decision}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 col-span-2">
                  <Label htmlFor="conclusions">Conclusions</Label>
                  <Textarea
                    id="conclusions"
                    value={editingEvaluation?.conclusions || ""}
                    onChange={(e) =>
                      setEditingEvaluation({ ...editingEvaluation!, conclusions: e.target.value })
                    }
                    rows={3}
                  />
                </div>
                <div className="space-y-2 col-span-2">
                  <Label htmlFor="recommendations">Recommandations</Label>
                  <Textarea
                    id="recommendations"
                    value={editingEvaluation?.recommendations || ""}
                    onChange={(e) =>
                      setEditingEvaluation({ ...editingEvaluation!, recommendations: e.target.value })
                    }
                    rows={3}
                  />
                </div>
              </div>
            </section>

            <section className="space-y-4">
              <h3 className="text-lg font-semibold border-b pb-2">Évaluation par critères</h3>
              {editingEvaluation && editingEvaluation.evaluation_criteria && (
                <CriteriaSection
                  title="1. Visite du jury & Projet municipal"
                  criteria={editingEvaluation.evaluation_criteria.jury_project}
                  onUpdate={(updated) =>
                    setEditingEvaluation({
                      ...editingEvaluation,
                      evaluation_criteria: { ...editingEvaluation.evaluation_criteria, jury_project: updated },
                    })
                  }
                  fields={{
                    composition_dossier: "Composition du dossier",
                    binome_elu_technicien: "Binôme élu/technicien",
                    coherence_projet: "Cohérence du projet",
                    transversalite: "Transversalité",
                    concertation: "Concertation",
                    gestion_differenciee: "Gestion différenciée",
                    presence_vegetal_annee: "Présence du végétal à l'année",
                  }}
                />
              )}
              {editingEvaluation && editingEvaluation.evaluation_criteria && (
                <CriteriaSection
                  title="2. Animation & Promotion"
                  criteria={editingEvaluation.evaluation_criteria.animation_promotion}
                  onUpdate={(updated) =>
                    setEditingEvaluation({
                      ...editingEvaluation,
                      evaluation_criteria: { ...editingEvaluation.evaluation_criteria, animation_promotion: updated },
                    })
                  }
                  fields={{
                    info_habitants: "Information aux habitants",
                    pedagogie: "Pédagogie",
                    promotion_label: "Promotion du label",
                    actions_touristes: "Actions vers les touristes",
                  }}
                />
              )}
              {editingEvaluation && editingEvaluation.evaluation_criteria && (
                <CriteriaSection
                  title="3. Patrimoine végétal"
                  criteria={editingEvaluation.evaluation_criteria.patrimoine_vegetal}
                  onUpdate={(updated) =>
                    setEditingEvaluation({
                      ...editingEvaluation,
                      evaluation_criteria: { ...editingEvaluation.evaluation_criteria, patrimoine_vegetal: updated },
                    })
                  }
                  fields={{
                    arbres: "Arbres",
                    arbustes_grimpantes: "Arbustes/Grimpantes",
                    pelouses_prairies: "Pelouses/Prairies",
                    fleurissement: "Fleurissement",
                  }}
                />
              )}
              {editingEvaluation && editingEvaluation.evaluation_criteria && (
                <CriteriaSection
                  title="4. Gestion environnementale"
                  criteria={editingEvaluation.evaluation_criteria.gestion_environnementale}
                  onUpdate={(updated) =>
                    setEditingEvaluation({
                      ...editingEvaluation,
                      evaluation_criteria: { ...editingEvaluation.evaluation_criteria, gestion_environnementale: updated },
                    })
                  }
                  fields={{
                    connaissance_biodiversite: "Connaissance de la biodiversité",
                    protection_sols: "Protection des sols",
                    gestion_eau: "Gestion de l'eau",
                    valorisation_dechets_verts: "Valorisation des déchets verts",
                    methodes_alternatives: "Méthodes alternatives",
                    economies_energie: "Économies d'énergie",
                    ilots_fraicheur: "Îlots de fraîcheur",
                  }}
                />
              )}
              {editingEvaluation && editingEvaluation.evaluation_criteria && (
                <CriteriaSection
                  title="5. Qualité de l'espace public"
                  criteria={editingEvaluation.evaluation_criteria.qualite_espace_public}
                  onUpdate={(updated) =>
                    setEditingEvaluation({
                      ...editingEvaluation,
                      evaluation_criteria: { ...editingEvaluation.evaluation_criteria, qualite_espace_public: updated },
                    })
                  }
                  fields={{
                    patrimoine_bati: "Patrimoine bâti",
                    proprete: "Propreté",
                    mobilier_urbain: "Mobilier urbain",
                    accessibilite: "Accessibilité",
                    sante_bien_etre: "Santé/Bien-être",
                  }}
                />
              )}
              {editingEvaluation && editingEvaluation.evaluation_criteria && (
                <CriteriaSection
                  title="6. Analyse par espace"
                  criteria={editingEvaluation.evaluation_criteria.analyse_par_espace}
                  onUpdate={(updated) =>
                    setEditingEvaluation({
                      ...editingEvaluation,
                      evaluation_criteria: { ...editingEvaluation.evaluation_criteria, analyse_par_espace: updated },
                    })
                  }
                  fields={{
                    entrees_centre: "Entrées et centre de la commune",
                    cimetiere: "Cimetières",
                    parcs_jardins: "Parcs/Jardins",
                  }}
                />
              )}
            </section>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Annuler</Button>
              <Button type="submit" disabled={upsertEvaluationMutation.isPending}>
                {upsertEvaluationMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                Enregistrer
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isConfirmDeleteOpen} onOpenChange={setIsConfirmDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer cette évaluation ? Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete} className="bg-destructive hover:bg-destructive/90">
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

interface CriteriaSectionProps<T extends Record<string, CriteriaEvaluation>> {
  title: string;
  criteria: T;
  onUpdate: (updatedCriteria: T) => void;
  fields: Record<keyof T, string>;
}

function CriteriaSection<T extends Record<string, CriteriaEvaluation>>({ title, criteria, onUpdate, fields }: CriteriaSectionProps<T>) {
  const handleCriterionChange = (key: keyof T, field: keyof CriteriaEvaluation, value: string) => {
    onUpdate({
      ...criteria,
      [key]: {
        ...criteria[key],
        [field]: value,
      },
    });
  };

  return (
    <Card className="mb-4">
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {Object.entries(fields).map(([key, label]) => (
          <div key={key} className="grid grid-cols-1 md:grid-cols-3 gap-2 items-center border-b pb-4 last:border-b-0 last:pb-0">
            <Label className="md:col-span-1 text-sm font-medium">{label}</Label>
            <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
              <Select
                value={criteria[key as keyof T]?.status || "Inexistant"}
                onValueChange={(value) => handleCriterionChange(key as keyof T, "status", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Statut" />
                </SelectTrigger>
                <SelectContent>
                  {["Inexistant", "Initié", "Réalisé", "Conforté"].map((status) => (
                    <SelectItem key={status} value={status}>{status}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Textarea
                placeholder="Commentaire"
                value={criteria[key as keyof T]?.comment || ""}
                onChange={(e) => handleCriterionChange(key as keyof T, "comment", e.target.value)}
                rows={1}
              />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}