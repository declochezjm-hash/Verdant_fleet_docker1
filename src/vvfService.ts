import { supabase } from "@/integrations/supabase/client";
import { VVFEvaluation, VVFEvaluationSchema } from "@/types/vvf";
import { toast } from "sonner";

export const vvfService = {
  /**
   * Créer une nouvelle évaluation
   */
  async create(data: VVFEvaluation) {
    const validatedData = VVFEvaluationSchema.parse(data);
    const { data: profile } = await supabase.auth.getUser();

    const { error } = await supabase
      .from("vvf_evaluations")
      .insert([{ ...validatedData, created_by: profile.user?.id }]);

    if (error) {
      toast.error("Erreur lors de la création de l'évaluation VVF");
      throw error;
    }
    toast.success("Évaluation VVF enregistrée avec succès");
  },

  /**
   * Récupérer l'historique d'une commune
   */
  async getByCommune(communeName: string) {
    const { data, error } = await supabase
      .from("vvf_evaluations")
      .select("*")
      .eq("commune_name", communeName)
      .order("visit_date", { ascending: false });

    if (error) throw error;
    return data as VVFEvaluation[];
  },

  /**
   * Mettre à jour une évaluation existante
   */
  async update(id: string, data: Partial<VVFEvaluation>) {
    const { error } = await supabase
      .from("vvf_evaluations")
      .update(data)
      .eq("id", id);

    if (error) {
      toast.error("Échec de la mise à jour");
      throw error;
    }
    toast.success("Évaluation mise à jour");
  },

  /**
   * Supprimer une évaluation
   */
  async delete(id: string) {
    const { error } = await supabase.from("vvf_evaluations").delete().eq("id", id);
    if (error) throw error;
    toast.success("Évaluation supprimée");
  }
};
