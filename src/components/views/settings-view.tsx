import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase, isConfigured } from "@/integrations/supabase/client";
import { createClient } from "@supabase/supabase-js";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Save, UserCog, Euro, Loader2, Database, Rocket, Users, Plus, Trash2, Palette, Building2, User, Package, Pencil, Search, Settings as SettingsIcon, Filter, Wrench, Archive, Key, Copy, RefreshCw, ShieldAlert, ShieldCheck, History } from "lucide-react";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { Switch } from "@/components/ui/switch";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
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
import { Badge } from "@/components/ui/badge";
import { getTeamColor } from "@/lib/team-utils";

interface Product {
  id: string;
  name: string;
  amm_number: string | null;
  category: "Engrais" | "Phyto" | "Semences";
  unit: "L" | "Kg" | "Sac";
  stock: number;
  threshold: number;
  price_per_unit: number;
}

export function SettingsView() {
  const { primaryRole, loading: authLoading } = useAuth();
  const queryClient = useQueryClient();

  const { data: profiles = [], isLoading: loadingProfiles } = useQuery({
    queryKey: ["profiles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id, name, team, hourly_rate, email, is_blocked, last_login_at").order("name");
      if (error) throw error;
      return data;
    }
  });

  const { data: suppliers = [], isLoading: loadingSuppliers } = useQuery({
    queryKey: ["suppliers"],
    queryFn: async () => {
      const { data, error } = await supabase.from("suppliers").select("*").order("name");
      if (error) throw error;
      return data;
    }
  });

  const { data: clients = [], isLoading: loadingClients } = useQuery({
    queryKey: ["clients"],
    queryFn: async () => {
      const { data, error } = await supabase.from("clients").select("*").order("name");
      if (error) throw error;
      return data;
    }
  });

  const { data: products = [], isLoading: loadingProducts } = useQuery({
    queryKey: ["products-catalog"],
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("id, name, amm_number, category, unit, stock, threshold, price_per_unit").order("name");
      if (error) throw error;
      return data as Product[];
    }
  });

  // Récupération de la liste des équipes
  const { data: teams = [], isLoading: loadingTeams } = useQuery({
    queryKey: ["settings-teams"],
    queryFn: async () => {
      const { data, error } = await supabase.from("teams").select("id, name, color, is_archived, overhead_labor_pct, overhead_equip_pct, overhead_mat_pct, margin_pct, tax_pct").eq("is_archived", false).order("name");
      if (error) throw error;
      return data;
    }
  });

  // Récupération du parc matériel pour l'affectation aux équipes
  const { data: allEquipment = [], isLoading: loadingEquipment } = useQuery({
    queryKey: ["settings-equipment"], // Clé unifiée pour tout le projet
    queryFn: async () => {
      const { data, error, count } = await supabase
        .from("equipment")
        .select("*")
        .order("name");
      if (error) throw error;
      return data || [];
    },
    staleTime: 0,
    refetchOnMount: "always",
  });

  // Récupération des chantiers futurs pour validation avant archivage
  const { data: futureTasks = [] } = useQuery({
    queryKey: ["future-tasks-check"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("id, team, scheduled_at, status, priority")
        .gt("scheduled_at", new Date().toISOString())
        .neq("status", "termine")
        .neq("status", "annule");
      if (error) throw error;
      return data;
    }
  });

  const createTeamMutation = useMutation({
    mutationFn: async ({ name, color }: { name: string, color: string }) => {
      const { error } = await supabase.from("teams").insert([{ name, color }]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings-teams"] });
      toast.success("Équipe créée !");
      setNewTeamName("");
    },
    onError: (err: Error) => toast.error(err.message)
  });

  const archiveTeamMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("teams").update({ is_archived: true }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings-teams"] });
      toast.success("Équipe archivée.");
    },
    onError: (err: Error) => toast.error("Erreur : " + err.message)
  });

  const upsertTeamMutation = useMutation({
    mutationFn: async (data: any) => {
      const { id, name, color, memberIds, equipmentIds, originalName, overhead_labor_pct, overhead_equip_pct, overhead_mat_pct, margin_pct, tax_pct } = data;
      
      // 1. Upsert de l'équipe incluant les paramètres financiers
      const { error: teamError } = await supabase.from("teams").upsert({ 
        id, name, color, is_archived: false,
        overhead_labor_pct, overhead_equip_pct, overhead_mat_pct, margin_pct, tax_pct
      });
      if (teamError) throw teamError;

      // On nettoie les anciennes attributions (en utilisant l'ancien nom si changement) pour éviter les orphelins
      const nameToClear = originalName || name;

      // 2. Mise à jour des membres
      await supabase.from("profiles").update({ team: null }).eq("team", nameToClear);
      if (memberIds.length > 0) {
        await supabase.from("profiles").update({ team: name }).in("id", memberIds);
      }

      // 3. Mise à jour du matériel
      await supabase.from("equipment").update({ team: null }).eq("team", nameToClear);
      if (equipmentIds.length > 0) {
        await supabase.from("equipment").update({ team: name }).in("id", equipmentIds);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings-teams"] });
      queryClient.invalidateQueries({ queryKey: ["profiles"] });
      queryClient.invalidateQueries({ queryKey: ["settings-equipment"] });
      toast.success("Équipe et attributions enregistrées !");
      setIsTeamDialogOpen(false);
    },
    onError: (err: Error) => toast.error(err.message)
  });

  const upsertEquipmentMutation = useMutation({
    mutationFn: async (data: any) => {
      const { error } = await supabase.from("equipment").upsert(data);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings-equipment"] });
      toast.success("Équipement enregistré");
      setIsEquipmentDialogOpen(false);
    },
    onError: (err: Error) => toast.error(err.message)
  });

  const deleteEquipmentMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("equipment").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings-equipment"] });
      toast.success("Équipement supprimé");
    },
    onError: (err: Error) => toast.error(err.message)
  });

  const reassignEquipmentMutation = useMutation({
    mutationFn: async ({ equipmentId, agentId }: { equipmentId: string, agentId: string | null }) => {
      const { error } = await supabase
        .from("equipment")
        .update({ assigned_to: agentId })
        .eq("id", equipmentId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings-equipment"] });
      toast.success("Matériel réassigné");
    },
    onError: (err: Error) => toast.error(err.message)
  });

  const deleteProductMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("products").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products-catalog"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success("Produit supprimé");
    },
    onError: (err: Error) => toast.error(err.message)
  });

  const deleteSupplierMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("suppliers").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      toast.success("Fournisseur supprimé");
    },
    onError: (err: Error) => toast.error(err.message)
  });

  const deleteClientMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("clients").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      toast.success("Client supprimé");
    },
    onError: (err: Error) => toast.error(err.message)
  });

  const deleteProfileMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("profiles").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profiles"] });
      toast.success("Collaborateur supprimé");
    },
    onError: (err: Error) => {
      if (err.message.includes("violates foreign key constraint")) {
        toast.error("Impossible : cet agent est lié à des interventions passées.");
      } else toast.error(err.message);
    }
  });

  const updateRateMutation = useMutation({
    mutationFn: async ({ userId, rate }: { userId: string, rate: number }) => {
      const { error } = await supabase
        .from("profiles")
        .update({ hourly_rate: rate })
        .eq("id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profiles"] });
      toast.success("Taux horaire mis à jour avec succès.");
    }
  });

  const [dirtyRates, setDirtyRates] = useState<Record<string, number>>({});
  const [newTeamName, setNewTeamName] = useState("");
  const [newTeamColor, setNewTeamColor] = useState("#6366f1");
  const [isSeeding, setIsSeeding] = useState(false);
  const [agentTeamFilter, setAgentTeamFilter] = useState("all");

  // États CRUD
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [editingSupplier, setEditingSupplier] = useState<any>(null);
  const [editingClient, setEditingClient] = useState<any>(null);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [editingTeam, setEditingTeam] = useState<any>(null);
  const [editingEquipment, setEditingEquipment] = useState<any>(null);
  const [memberSearch, setMemberSearch] = useState("");
  const [equipSearch, setEquipmentSearch] = useState("");
  const [hideAssignedMembers, setHideAssignedMembers] = useState(false);
  const [hideAssigned, setHideAssigned] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<{ id: string, type: 'product' | 'supplier' | 'client' | 'profile' | 'team' | 'equipment', name: string } | null>(null);

  const [isProductDialogOpen, setIsProductDialogOpen] = useState(false);
  const [isSupplierDialogOpen, setIsSupplierDialogOpen] = useState(false);
  const [isClientDialogOpen, setIsClientDialogOpen] = useState(false);
  const [isUserDialogOpen, setIsUserDialogOpen] = useState(false);
  const [isTeamDialogOpen, setIsTeamDialogOpen] = useState(false);
  const [isEquipmentDialogOpen, setIsEquipmentDialogOpen] = useState(false);
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);

  const upsertProductMutation = useMutation({
    mutationFn: async (data: any) => {
      const { error } = await supabase.from("products").upsert(data);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products-catalog"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success("Produit enregistré");
      setIsProductDialogOpen(false);
    },
    onError: (err: Error) => toast.error(err.message)
  });

  const upsertSupplierMutation = useMutation({
    mutationFn: async (data: any) => {
      const { error } = await supabase.from("suppliers").upsert(data);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      toast.success("Fournisseur enregistré");
      setIsSupplierDialogOpen(false);
    },
    onError: (err: Error) => toast.error(err.message)
  });

  const upsertClientMutation = useMutation({
    mutationFn: async (data: any) => {
      const { error } = await supabase.from("clients").upsert(data);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      toast.success("Client enregistré");
      setIsClientDialogOpen(false);
    },
    onError: (err: Error) => toast.error(err.message)
  });

  /**
   * Génère un code de connexion aléatoire
   */
  const generateRandomCode = () => {
    const code = "VF-" + Math.random().toString(36).substring(2, 8).toUpperCase();
    setEditingUser((prev: any) => ({ ...prev, tempPassword: code }));
    toast.info("Nouveau code de connexion généré");
  };

  const upsertProfileMutation = useMutation({
    mutationFn: async (data: any) => {
      if (!data.name?.trim()) throw new Error("Le nom est obligatoire");
      if (data.sendInvite && !data.email) throw new Error("Email requis pour envoyer une invitation");

      const payload: any = {
        name: data.name.trim(),
        team: data.team === "none" || !data.team ? null : data.team,
        hourly_rate: parseFloat(data.hourly_rate) || 0,
        email: data.email?.trim() || null,
        is_blocked: data.is_blocked || false
      };

      // On n'inclut l'id que s'il existe déjà (cas d'une modification)
      // Cela permet à Supabase de générer un UUID automatiquement lors d'une création
      if (data.id && data.id !== "") {
        payload.id = data.id;
      }

      // 1. Sauvegarde du profil dans la base de données
      const { error: profileErr } = await supabase.from("profiles").upsert(payload);
      if (profileErr) throw profileErr;

      // 2. Si c'est un nouveau collaborateur et qu'on a demandé l'invitation
      if (data.sendInvite && data.email && data.tempPassword && !data.id) {
        const url = (import.meta as any).env.VITE_SUPABASE_URL;
        const anonKey = (import.meta as any).env.VITE_SUPABASE_ANON_KEY;
        
        if (!url || !anonKey) throw new Error("Configuration Supabase manquante pour l'invitation.");

        // Création d'un client éphémère pour l'inscription sans déconnecter l'admin
        const tempClient = createClient(url, anonKey, { auth: { persistSession: false } });
        
        const { error: authErr } = await tempClient.auth.signUp({
          email: data.email,
          password: data.tempPassword,
          options: { 
            data: { 
              name: data.name, 
              role: 'agent',
              temp_password: data.tempPassword // Permet l'affichage dans le template email
            },
            emailRedirectTo: window.location.origin 
          }
        });

        if (authErr) {
          if (authErr.message.includes("already registered")) {
            toast.info("L'utilisateur possède déjà un compte d'accès.");
          } else throw authErr;
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profiles"] });
      toast.success("Collaborateur enregistré");
      setIsUserDialogOpen(false);
      setEditingUser(null);
    },
    onError: (err: Error) => toast.error(err.message)
  });

  const resetPasswordMutation = useMutation({
    mutationFn: async ({ email, name }: { email: string, name: string }) => {
      if (!email) throw new Error("L'email est requis pour la réinitialisation");
      
      // Envoi d'un email de récupération via Supabase
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + '/reset-password',
      });
      if (error) throw error;
    },
    onSuccess: () => toast.success("Email de réinitialisation envoyé au collaborateur"),
    onError: (err: Error) => toast.error("Erreur : " + err.message)
  });

  const toggleBlockMutation = useMutation({
    mutationFn: async ({ id, block }: { id: string, block: boolean }) => {
      const { error } = await supabase.from("profiles").update({ is_blocked: block }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profiles"] });
      toast.success("Statut du collaborateur mis à jour");
    },
    onError: (err: Error) => toast.error(err.message)
  });

  const handleDeleteClick = (id: string, type: any, name: string) => {
    setItemToDelete({ id, type, name });
    setIsConfirmDeleteOpen(true);
  };

  const hasFutureTasks = itemToDelete?.type === 'team' && 
    futureTasks.some(t => t.team === itemToDelete.name);

  const hasUrgentFutureTasks = itemToDelete?.type === 'team' && 
    futureTasks.some(t => t.team === itemToDelete.name && t.priority === 'urgente');

  const handleConfirmDelete = () => {
    if (!itemToDelete) return;
    if (itemToDelete.type === 'product') deleteProductMutation.mutate(itemToDelete.id);
    if (itemToDelete.type === 'supplier') deleteSupplierMutation.mutate(itemToDelete.id);
    if (itemToDelete.type === 'client') deleteClientMutation.mutate(itemToDelete.id);
    if (itemToDelete.type === 'profile') deleteProfileMutation.mutate(itemToDelete.id);
    if (itemToDelete.type === 'team') archiveTeamMutation.mutate(itemToDelete.id);
    if (itemToDelete.type === 'equipment') deleteEquipmentMutation.mutate(itemToDelete.id);
    setIsConfirmDeleteOpen(false);
  };

  const handleSeedData = async () => {
    setIsSeeding(true);
    try {
      // On utilise rpc pour appeler une fonction SQL de peuplement
      const { error } = await supabase.rpc('seed_demo_data');
      if (error) throw error;
      
      toast.success("Données de démonstration générées !");
      queryClient.invalidateQueries(); // Rafraîchir toutes les données
    } catch (err: any) {
      toast.error("Erreur lors de la génération : " + err.message);
    } finally {
      setIsSeeding(false);
    }
  };

  const isLoading = authLoading || loadingProfiles || loadingTeams || loadingEquipment;

  if (isLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (primaryRole !== "coordinator" && primaryRole !== "admin") {
    return (
      <div className="flex h-[60vh] items-center justify-center p-8 text-center">
        <div className="space-y-2">
          <h1 className="text-xl font-bold text-destructive">Accès restreint</h1>
          <p className="text-muted-foreground">Seuls les coordinateurs peuvent modifier les paramètres financiers.</p>
        </div>
      </div>
    );
  }

  const handleRateChange = (agentId: string, value: string) => {
    const val = parseFloat(value);
    setDirtyRates((prev) => ({ ...prev, [agentId]: isNaN(val) ? 0 : val }));
  };

  const handleSave = async (agentId: string) => {
    const rate = dirtyRates[agentId];
    if (rate === undefined) return;

    updateRateMutation.mutate(
      { userId: agentId, rate },
      {
        onSuccess: () => {
          setDirtyRates((prev) => {
            const next = { ...prev };
            delete next[agentId];
            return next;
          });
        },
      }
    );
  };

  // On affiche les agents filtrés par équipe
  const agents = profiles.filter(p => 
    agentTeamFilter === "all" || 
    (agentTeamFilter === "none" ? !p.team : p.team === agentTeamFilter)
  );

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Paramètres</h1>
        <p className="text-sm text-muted-foreground">
          Gérez les paramètres globaux et les taux de facturation interne.
        </p>
      </div>

      <Tabs defaultValue="general" className="space-y-6">
        <TabsList>
          <TabsTrigger value="general">Général & Équipes</TabsTrigger>
          <TabsTrigger value="equipment">Parc Matériel</TabsTrigger>
          <TabsTrigger value="tiers">Tiers (Fournisseurs & Clients)</TabsTrigger>
          <TabsTrigger value="catalog">Catalogue Produits</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="grid gap-6 items-start">
          <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-2 shadow-sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                <CardTitle>Gestion des Équipes</CardTitle>
              </div>
              <Button size="sm" className="gap-2" onClick={() => {
                setEditingTeam({ name: '', color: '#6366f1', memberIds: [], equipmentIds: [] });
                setIsTeamDialogOpen(true);
              }}>
                <Plus className="h-4 w-4" /> Nouvelle Équipe
              </Button>
            </div>
            <CardDescription>Configurez les équipes types et leurs couleurs.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              {teams.map(t => {
                const members = profiles.filter(p => p.team === t.name);
                // Le matériel est maintenant lié soit via l'agent, soit via le champ team de l'équipement
                const teamEquipment = allEquipment.filter(e => e.team === t.name || members.some(m => m.id === e.assigned_to));

                // Calcul du Déboursé Sec Horaire
                const hourlyLabor = members.reduce((sum, m) => sum + (Number(m.hourly_rate) || 0), 0);
                const hourlyEquip = teamEquipment.reduce((sum, e) => sum + (Number(e.hourly_cost) || 0), 0);
                
                const laborCharged = hourlyLabor * (1 + (t.overhead_labor_pct || 0) / 100);
                const equipCharged = hourlyEquip * (1 + (t.overhead_equip_pct || 0) / 100);
                const subTotal = laborCharged + equipCharged;
                const withMargin = subTotal * (1 + (t.margin_pct || 0) / 100);
                const finalTotal = withMargin * (1 + (t.tax_pct || 0) / 100);

                return (
                  <div key={t.id} className="flex flex-col p-3 border rounded-md hover:bg-muted/10 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="h-4 w-4 rounded-full shadow-sm" style={{ backgroundColor: getTeamColor(t.name, teams) }} />
                        <span className="font-bold">{t.name}</span>
                        <Badge variant="secondary" className="text-[10px]">{members.length} membres</Badge>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { 
                          setEditingTeam({
                            ...t,
                            originalName: t.name,
                            memberIds: members.map(m => m.id),
                            equipmentIds: teamEquipment.map(e => e.id)
                          }); 
                          setIsTeamDialogOpen(true); 
                        }}>
                          <Pencil className="h-4 w-4 text-muted-foreground" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-amber-600" title="Archiver" onClick={() => handleDeleteClick(t.id, 'team', t.name)}>
                          <Archive className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    {/* Résumé Financier Détaillé */}
                    <div className="mt-2 mb-3 grid grid-cols-4 gap-2 rounded-lg bg-muted/40 p-2.5 border border-dashed border-muted-foreground/20">
                      <div className="flex flex-col">
                        <span className="text-[7px] uppercase font-bold text-muted-foreground">MO (+{t.overhead_labor_pct}%)</span>
                        <span className="text-[10px] font-mono font-bold">{laborCharged.toFixed(2)}€/h</span>
                      </div>
                      <div className="flex flex-col border-x px-1 border-muted-foreground/10 text-center">
                        <span className="text-[7px] uppercase font-bold text-muted-foreground">MAT (+{t.overhead_equip_pct}%)</span>
                        <span className="text-[10px] font-mono font-bold">{equipCharged.toFixed(2)}€/h</span>
                      </div>
                      <div className="flex flex-col border-r px-1 border-muted-foreground/10 text-center">
                        <span className="text-[7px] uppercase font-bold text-muted-foreground">Marge ({t.margin_pct}%)</span>
                        <span className="text-[10px] font-mono font-bold">+{ (withMargin - subTotal).toFixed(0) }€/h</span>
                      </div>
                      <div className="flex flex-col items-end">
                        <span className="text-[7px] uppercase font-bold text-success">PV FINAL (TTC)</span>
                        <span className="text-[11px] font-black text-success">{finalTotal.toFixed(2)}€/h</span>
                      </div>
                    </div>

                        <div className="flex flex-wrap gap-1">
                          <span className="text-[9px] uppercase font-bold text-muted-foreground w-full mb-0.5">Membres :</span>
                          {members.map(m => (
                            <span key={m.id} className="text-[10px] bg-background border px-1.5 py-0.5 rounded text-muted-foreground flex items-center gap-1">
                              <User className="h-2.5 w-2.5" />
                              {m.name}
                            </span>
                          ))}
                        </div>
                        
                        {teamEquipment.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            <span className="text-[9px] uppercase font-bold text-muted-foreground w-full mb-0.5">Matériel associé :</span>
                            {teamEquipment.map(e => (
                              <span key={e.id} className="text-[10px] bg-primary/5 text-primary border border-primary/20 px-1.5 py-0.5 rounded flex items-center gap-1">
                                <Wrench className="h-2.5 w-2.5" />
                                {e.name}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

      <Card className="border-2 shadow-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <UserCog className="h-5 w-5 text-primary" />
              <CardTitle>Gestion des Collaborateurs</CardTitle>
            </div>
            <div className="flex items-center gap-2">
              <Select value={agentTeamFilter} onValueChange={setAgentTeamFilter}>
                <SelectTrigger className="h-8 w-[140px] text-xs">
                  <Filter className="mr-2 h-3 w-3" />
                  <SelectValue placeholder="Filtrer par équipe" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les agents</SelectItem>
                  <SelectItem value="none">Sans équipe</SelectItem>
                  {teams.map(t => (
                    <SelectItem key={t.id} value={t.name}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button size="sm" className="gap-2" onClick={() => { setEditingUser({ name: '', team: '', role: 'agent', hourly_rate: 35 }); setIsUserDialogOpen(true); }}>
                <Plus className="h-4 w-4" /> Nouveau
              </Button>
            </div>
          </div>
          <CardDescription>Gérez les accès, les équipes et les coûts de main-d'œuvre.</CardDescription>
        </CardHeader>
        <CardContent>
          {/* Section de déploiement de démo */}
          <div className="mb-8 rounded-lg border-2 border-dashed p-4 bg-muted/20">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2 font-bold">
                  <Database className="h-4 w-4 text-primary" />
                  Environnement de Test
                </div>
                <p className="text-xs text-muted-foreground">
                  Générez instantanément des produits, du matériel et des chantiers fictifs pour tester les graphiques.
                </p>
              </div>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button 
                    variant="outline" 
                    disabled={isSeeding}
                    className="bg-background hover:bg-primary hover:text-primary-foreground transition-all"
                  >
                    {isSeeding ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Rocket className="mr-2 h-4 w-4" />}
                    Générer les données démo
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Générer des données de démonstration ?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Cette action va injecter des chantiers, des produits et du matériel fictifs dans votre base de données. 
                      Bien que cela n'écrase pas vos données existantes, cela peut encombrer vos listes et vos statistiques analytiques.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Annuler</AlertDialogCancel>
                    <AlertDialogAction onClick={handleSeedData}>Confirmer la génération</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>

          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50 text-left text-xs uppercase text-muted-foreground font-semibold">
                  <th className="px-4 py-3">Agent</th>
                  <th className="px-4 py-3">Équipe</th>
                  <th className="px-4 py-3">Dernière Connexion</th>
                  <th className="px-4 py-3">Statut</th>
                  <th className="px-4 py-3">Matériel</th>
                  <th className="px-4 py-3 w-[150px]">Taux (€/h)</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {agents.map((agent) => {
                  const currentRate = dirtyRates[agent.id] ?? Number(agent.hourly_rate);
                  const isDirty = dirtyRates[agent.id] !== undefined && dirtyRates[agent.id] !== Number(agent.hourly_rate);
                  const agentEquipment = allEquipment.filter(e => e.assigned_to === agent.id);

                  return (
                    <tr key={agent.id} className="transition-colors hover:bg-muted/30">
                      <td className="px-4 py-3 font-medium text-slate-900">{agent.name}</td>
                      <td className="px-4 py-3">
                        <Select 
                          value={agent.team || "none"} 
                          onValueChange={(val) => upsertProfileMutation.mutate({ ...agent, team: val === "none" ? null : val })}
                        >
                          <SelectTrigger className="h-8 text-xs w-[140px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Sans équipe</SelectItem>
                            {teams.map(t => (
                              <SelectItem key={t.id} value={t.name}>{t.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {agent.last_login_at ? (
                          <div className="flex items-center gap-1">
                            <History className="h-3 w-3" />
                            {format(parseISO(agent.last_login_at), "dd/MM/yy HH:mm")}
                          </div>
                        ) : "Jamais"}
                      </td>
                      <td className="px-4 py-3">
                        {agent.is_blocked ? (
                          <Badge variant="destructive" className="text-[9px] gap-1"><ShieldAlert className="h-2 w-2" /> BLOQUÉ</Badge>
                        ) : (
                          <Badge variant="outline" className="text-[9px] gap-1 text-success border-success/30"><ShieldCheck className="h-2 w-2" /> ACTIF</Badge>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap items-center gap-1">
                          {agentEquipment.map(e => (
                            <DropdownMenu key={e.id}>
                              <DropdownMenuTrigger asChild>
                                <Badge 
                                  variant="secondary" 
                                  className="text-[9px] px-1 h-4 gap-0.5 font-normal cursor-pointer hover:bg-secondary/80 transition-colors"
                                >
                                  <Wrench className="h-2 w-2" />
                                  {e.name}
                                </Badge>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="start" className="w-56 overflow-hidden">
                                <DropdownMenuLabel className="text-[10px] uppercase text-muted-foreground">Réassigner "{e.name}"</DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                <div className="max-h-[200px] overflow-y-auto">
                                  <DropdownMenuItem onClick={() => reassignEquipmentMutation.mutate({ equipmentId: e.id, agentId: null })}>
                                    <span className="text-xs italic text-muted-foreground">Libérer (Désaffecter)</span>
                                  </DropdownMenuItem>
                                  {profiles.map(p => (
                                    <DropdownMenuItem 
                                      key={p.id} 
                                      disabled={p.id === agent.id}
                                      onClick={() => reassignEquipmentMutation.mutate({ equipmentId: e.id, agentId: p.id })}
                                    >
                                      <span className="text-xs">{p.name}</span>
                                    </DropdownMenuItem>
                                  ))}
                                </div>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          ))}

                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-5 w-5 rounded-full border border-dashed hover:bg-primary/5 hover:text-primary transition-colors">
                                <Plus className="h-3 w-3" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start" className="w-56">
                              <DropdownMenuLabel className="text-[10px] uppercase text-muted-foreground">Affecter du matériel libre</DropdownMenuLabel>
                              <DropdownMenuSeparator />
                              <div className="max-h-[200px] overflow-y-auto">
                                {allEquipment.filter(eq => !eq.assigned_to).length === 0 ? (
                                  <div className="p-4 text-center text-xs text-muted-foreground italic">
                                    Aucun matériel libre disponible
                                  </div>
                                ) : (
                                  allEquipment.filter(eq => !eq.assigned_to).map(eq => (
                                    <DropdownMenuItem 
                                      key={eq.id} 
                                      onClick={() => reassignEquipmentMutation.mutate({ equipmentId: eq.id, agentId: agent.id })}
                                    >
                                      <span className="text-xs">{eq.name}</span>
                                    </DropdownMenuItem>
                                  ))
                                )}
                              </div>
                            </DropdownMenuContent>
                          </DropdownMenu>

                          {agentEquipment.length === 0 && (
                            <span className="text-[10px] text-muted-foreground italic">Aucun</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="relative">
                          <Euro className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                          <Input
                            type="number"
                            value={currentRate}
                            onChange={(e) => handleRateChange(agent.id, e.target.value)}
                            className="h-9 pl-8 font-bold border-2 focus-visible:ring-primary"
                            step="0.5"
                          />
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8"><SettingsIcon className="h-4 w-4" /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => { setEditingUser(agent); setIsUserDialogOpen(true); }}>
                                <Pencil className="mr-2 h-4 w-4" /> Modifier
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => resetPasswordMutation.mutate({ email: agent.email, name: agent.name })}>
                                <RefreshCw className="mr-2 h-4 w-4" /> Réinitialiser Pass
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                className={agent.is_blocked ? "text-success" : "text-destructive"}
                                onClick={() => toggleBlockMutation.mutate({ id: agent.id, block: !agent.is_blocked })}
                              >
                                {agent.is_blocked ? <ShieldCheck className="mr-2 h-4 w-4" /> : <ShieldAlert className="mr-2 h-4 w-4" />}
                                {agent.is_blocked ? "Débloquer l'accès" : "Bloquer l'accès"}
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem className="text-destructive" onClick={() => handleDeleteClick(agent.id, 'profile', agent.name)}>
                                <Trash2 className="mr-2 h-4 w-4" /> Supprimer
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                          {isDirty && (
                            <Button 
                              size="icon" 
                              className="h-8 w-8"
                              onClick={() => handleSave(agent.id)}
                              disabled={updateRateMutation.isPending}
                            >
                              {updateRateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  </TabsContent>

        <TabsContent value="equipment">
          <Card className="border-2 shadow-sm">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Wrench className="h-5 w-5 text-primary" />
                  <CardTitle>Gestion du Parc Matériel</CardTitle>
                </div>
                <Button size="sm" className="gap-2" onClick={() => { 
                  setEditingEquipment({ name: '', type: 'Engin', status: 'OK', hourly_cost: 0, hours_for_maintenance: 100 }); 
                  setIsEquipmentDialogOpen(true); 
                }}>
                  <Plus className="h-4 w-4" /> Nouveau Matériel
                </Button>
              </div>
              <CardDescription>Ajoutez et modifiez vos machines et outils pour le suivi analytique.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto rounded-md border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50 text-left text-xs uppercase text-muted-foreground font-semibold">
                      <th className="px-4 py-3">N°</th>
                      <th className="px-4 py-3">Matériel</th>
                      <th className="px-4 py-3">Type</th>
                      <th className="px-4 py-3">Statut</th>
                      <th className="px-4 py-3">Coût/h</th>
                      <th className="px-4 py-3">Seuil Entretien</th>
                      <th className="px-4 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {allEquipment.length === 0 ? (
                      <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground italic">Aucun matériel enregistré. Cliquez sur Nouveau pour commencer.</td></tr>
                    ) : (
                      allEquipment.map((eq) => (
                        <tr key={eq.id} className="transition-colors hover:bg-muted/30">
                          <td className="px-4 py-3 font-mono text-xs text-primary font-bold">{eq.internal_id || "-"}</td>
                          <td className="px-4 py-3 font-medium">{eq.name}</td>
                          <td className="px-4 py-3 text-xs">{eq.type}</td>
                          <td className="px-4 py-3">
                            <Badge variant={eq.status === 'OK' ? 'secondary' : 'destructive'} className="text-[10px]">
                              {eq.status}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 font-mono">{Number(eq.hourly_cost).toFixed(2)} €</td>
                          <td className="px-4 py-3 text-xs">{eq.hours_for_maintenance}h</td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditingEquipment(eq); setIsEquipmentDialogOpen(true); }}>
                                <Pencil className="h-4 w-4 text-muted-foreground" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDeleteClick(eq.id, 'equipment', eq.name)}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tiers" className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between py-3">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Building2 className="h-4 w-4" /> Fournisseurs
              </CardTitle>
              <Button size="sm" variant="outline" className="h-7 px-2 gap-1 text-[10px] uppercase font-bold" onClick={() => { setEditingSupplier({ name: '', email: '', phone: '' }); setIsSupplierDialogOpen(true); }}>
                <Plus className="h-3.5 w-3.5" /> Ajouter
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <div className="max-h-[400px] overflow-y-auto">
                {suppliers.length === 0 ? (
                  <p className="p-6 text-center text-xs text-muted-foreground italic">Aucun fournisseur enregistré</p>
                ) : (
                  suppliers.map((s: any) => (
                    <div key={s.id} className="flex items-center justify-between p-3 border-b last:border-0 hover:bg-muted/30 transition-colors">
                      <div className="flex flex-col">
                        <span className="text-sm font-medium">{s.name}</span>
                        {(s.email || s.phone) && (
                          <div className="flex gap-2 text-[10px] text-muted-foreground">
                            {s.email && <span>{s.email}</span>}
                            {s.phone && <span>{s.phone}</span>}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditingSupplier(s); setIsSupplierDialogOpen(true); }}>
                          <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDeleteClick(s.id, 'supplier', s.name)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between py-3">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <User className="h-4 w-4" /> Clients
              </CardTitle>
              <Button size="sm" variant="outline" className="h-7 px-2 gap-1 text-[10px] uppercase font-bold" onClick={() => { setEditingClient({ name: '', email: '', phone: '' }); setIsClientDialogOpen(true); }}>
                <Plus className="h-3.5 w-3.5" /> Ajouter
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <div className="max-h-[400px] overflow-y-auto">
                {clients.length === 0 ? (
                  <p className="p-6 text-center text-xs text-muted-foreground italic">Aucun client enregistré</p>
                ) : (
                  clients.map((c: any) => (
                    <div key={c.id} className="flex items-center justify-between p-3 border-b last:border-0 hover:bg-muted/30 transition-colors">
                      <div className="flex flex-col">
                        <span className="text-sm font-medium">{c.name}</span>
                        {(c.email || c.phone) && (
                          <div className="flex gap-2 text-[10px] text-muted-foreground">
                            {c.email && <span>{c.email}</span>}
                            {c.phone && <span>{c.phone}</span>}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditingClient(c); setIsClientDialogOpen(true); }}>
                          <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDeleteClick(c.id, 'client', c.name)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="catalog">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between py-3">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Package className="h-4 w-4" /> Catalogue des Produits
              </CardTitle>
              <Button size="sm" variant="outline" className="h-7 px-2 gap-1 text-[10px] uppercase font-bold" onClick={() => { 
                setEditingProduct({ name: '', category: 'Engrais', unit: 'L', stock: 0, threshold: 0, price_per_unit: 0 }); 
                setIsProductDialogOpen(true); 
              }}>
                <Plus className="h-3.5 w-3.5" /> Créer une fiche produit
              </Button>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto rounded-md border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50 text-left text-[10px] uppercase text-muted-foreground font-bold">
                      <th className="px-4 py-3">Nom du produit</th>
                      <th className="px-4 py-3">Catégorie</th>
                      <th className="px-4 py-3">Unité</th>
                      <th className="px-4 py-3">Prix Unitaire</th>
                      <th className="px-4 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {products.map((p) => (
                      <tr key={p.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3 font-medium">
                          {p.name}
                          {p.amm_number && <div className="text-[10px] text-muted-foreground">AMM: {p.amm_number}</div>}
                        </td>
                        <td className="px-4 py-3"><Badge variant="outline">{p.category}</Badge></td>
                        <td className="px-4 py-3">{p.unit}</td>
                        <td className="px-4 py-3 font-semibold">{Number(p.price_per_unit).toFixed(2)} €</td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditingProduct(p); setIsProductDialogOpen(true); }}>
                              <Pencil className="h-4 w-4 text-muted-foreground" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDeleteClick(p.id, 'product', p.name)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialogs pour le CRUD */}
      <Dialog open={isProductDialogOpen} onOpenChange={setIsProductDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editingProduct?.id ? 'Modifier' : 'Nouveau'} Produit</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid gap-2"><Label>Nom</Label><Input value={editingProduct?.name || ''} onChange={e => setEditingProduct({...editingProduct, name: e.target.value})} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2"><Label>Catégorie</Label>
                <Select value={editingProduct?.category} onValueChange={v => setEditingProduct({...editingProduct, category: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Engrais">Engrais</SelectItem>
                    <SelectItem value="Phyto">Phytosanitaires</SelectItem>
                    <SelectItem value="Semences">Semences</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2"><Label>Unité</Label>
                <Select value={editingProduct?.unit} onValueChange={v => setEditingProduct({...editingProduct, unit: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="L">Litre (L)</SelectItem>
                    <SelectItem value="Kg">Kilogramme (Kg)</SelectItem>
                    <SelectItem value="Sac">Sac</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2"><Label>Seuil d'alerte</Label><Input type="number" value={editingProduct?.threshold || 0} onChange={e => setEditingProduct({...editingProduct, threshold: parseFloat(e.target.value) || 0})} /></div>
              <div className="grid gap-2"><Label>Prix (€/{editingProduct?.unit})</Label><Input type="number" step="0.01" value={editingProduct?.price_per_unit || 0} onChange={e => setEditingProduct({...editingProduct, price_per_unit: parseFloat(e.target.value) || 0})} /></div>
            </div>
            <div className="grid gap-2"><Label>N° AMM</Label><Input value={editingProduct?.amm_number || ''} onChange={e => setEditingProduct({...editingProduct, amm_number: e.target.value})} /></div>
          </div>
          <DialogFooter>
            <Button className="w-full" onClick={() => upsertProductMutation.mutate(editingProduct)} disabled={upsertProductMutation.isPending}>
              {upsertProductMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enregistrer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isUserDialogOpen} onOpenChange={setIsUserDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{editingUser?.id ? 'Modifier' : 'Nouveau'} Collaborateur</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid gap-2">
              <Label>Nom Complet</Label>
              <Input value={editingUser?.name || ''} onChange={e => setEditingUser({...editingUser, name: e.target.value})} />
            </div>
            <div className="grid gap-2">
              <Label>Email (Optionnel - pour future connexion)</Label>
              <Input type="email" placeholder="collaborateur@exemple.com" value={editingUser?.email || ''} onChange={e => setEditingUser({...editingUser, email: e.target.value})} />
            </div>

            {!editingUser?.id && (
              <div className="rounded-lg border bg-primary/5 p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase text-primary">
                    <Key className="h-4 w-4" /> Code de connexion
                  </div>
                  <Button type="button" variant="ghost" size="sm" className="h-7 text-[10px] gap-1" onClick={generateRandomCode}>
                    <RefreshCw className="h-3 w-3" /> Générer
                  </Button>
                </div>
                
                {editingUser?.tempPassword ? (
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-background border-2 border-dashed border-primary/30 rounded px-3 py-2 text-center font-mono font-bold tracking-widest text-lg">
                      {editingUser.tempPassword}
                    </div>
                    <Button 
                      type="button" 
                      variant="outline" 
                      size="icon" 
                      onClick={() => {
                        navigator.clipboard.writeText(`Identifiant : ${editingUser.email}\nCode : ${editingUser.tempPassword}`);
                        toast.success("Copié !");
                      }}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <p className="text-[10px] text-muted-foreground italic text-center">Cliquez sur générer pour créer un accès.</p>
                )}

                <div className="flex items-center justify-between pt-2 border-t border-primary/10">
                  <div className="space-y-0.5">
                    <Label className="text-xs">Envoyer l'invitation</Label>
                    <p className="text-[9px] text-muted-foreground">Un email de confirmation sera envoyé par Supabase.</p>
                  </div>
                  <Switch 
                    checked={editingUser?.sendInvite} 
                    onCheckedChange={checked => setEditingUser({...editingUser, sendInvite: checked})} 
                  />
                </div>
              </div>
            )}

            <div className="grid gap-2">
              <Label>Équipe</Label>
              <Select value={editingUser?.team || "none"} onValueChange={v => setEditingUser({...editingUser, team: v === "none" ? null : v})}>
                <SelectTrigger><SelectValue placeholder="Choisir une équipe..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sans équipe</SelectItem>
                  {teams.map(t => <SelectItem key={t.id} value={t.name}>{t.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Taux Horaire (€/h)</Label>
              <div className="relative">
                <Euro className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input type="number" className="pl-8" value={editingUser?.hourly_rate || 0} onChange={e => setEditingUser({...editingUser, hourly_rate: parseFloat(e.target.value)})} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button className="w-full" onClick={() => upsertProfileMutation.mutate(editingUser)} disabled={upsertProfileMutation.isPending}>
              {upsertProfileMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : editingUser?.id ? "Enregistrer les modifications" : "Créer le collaborateur"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isSupplierDialogOpen} onOpenChange={setIsSupplierDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{editingSupplier?.id ? 'Modifier' : 'Nouveau'} Fournisseur</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid gap-2">
              <Label>Nom / Raison Sociale</Label>
              <Input value={editingSupplier?.name || ''} onChange={e => setEditingSupplier({...editingSupplier, name: e.target.value})} />
            </div>
            <div className="grid gap-2">
              <Label>Email de contact</Label>
              <Input type="email" value={editingSupplier?.email || ''} onChange={e => setEditingSupplier({...editingSupplier, email: e.target.value})} placeholder="email@exemple.com" />
            </div>
            <div className="grid gap-2">
              <Label>Téléphone</Label>
              <Input type="tel" value={editingSupplier?.phone || ''} onChange={e => setEditingSupplier({...editingSupplier, phone: e.target.value})} placeholder="06 .. .. .. .." />
            </div>
          </div>
          <DialogFooter>
            <Button className="w-full" onClick={() => upsertSupplierMutation.mutate(editingSupplier)} disabled={upsertSupplierMutation.isPending}>
              {upsertSupplierMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enregistrer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isClientDialogOpen} onOpenChange={setIsClientDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{editingClient?.id ? 'Modifier' : 'Nouveau'} Client</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid gap-2">
              <Label>Nom / Entreprise</Label>
              <Input value={editingClient?.name || ''} onChange={e => setEditingClient({...editingClient, name: e.target.value})} />
            </div>
            <div className="grid gap-2">
              <Label>Email de contact</Label>
              <Input type="email" value={editingClient?.email || ''} onChange={e => setEditingClient({...editingClient, email: e.target.value})} placeholder="client@exemple.com" />
            </div>
            <div className="grid gap-2">
              <Label>Téléphone</Label>
              <Input type="tel" value={editingClient?.phone || ''} onChange={e => setEditingClient({...editingClient, phone: e.target.value})} placeholder="06 .. .. .. .." />
            </div>
          </div>
          <DialogFooter>
            <Button className="w-full" onClick={() => upsertClientMutation.mutate(editingClient)} disabled={upsertClientMutation.isPending}>
              {upsertClientMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enregistrer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isTeamDialogOpen} onOpenChange={(o) => { setIsTeamDialogOpen(o); if(!o) { setMemberSearch(""); setEquipmentSearch(""); setHideAssigned(false); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
          <DialogHeader className="p-6 pb-2">
            <DialogTitle className="text-xl">{editingTeam?.id ? "Configuration de l'équipe" : "Nouvelle Équipe"}</DialogTitle>
            <DialogDescription>Définissez l'identité, les membres et le matériel rattaché.</DialogDescription>
          </DialogHeader>
          
          <div className="flex-1 overflow-y-auto p-6 space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="md:col-span-2 space-y-2">
                <Label className="text-xs font-bold uppercase text-muted-foreground">Nom de l'équipe</Label>
                <Input placeholder="Ex: Équipe Nord / Équipe Création..." value={editingTeam?.name || ''} onChange={e => setEditingTeam({...editingTeam, name: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase text-muted-foreground">Couleur Planning</Label>
                <div className="flex gap-2">
                  <Input type="color" className="h-10 w-12 p-1" value={editingTeam?.color || '#6366f1'} onChange={e => setEditingTeam({...editingTeam, color: e.target.value})} />
                  <Input value={editingTeam?.color || '#6366f1'} readOnly className="font-mono text-xs bg-muted/30" />
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <Label className="text-xs font-bold uppercase text-primary">Coefficients & Taxes (%)</Label>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3 bg-primary/5 p-3 rounded-md border border-primary/10">
                <div className="space-y-1">
                  <Label className="text-[9px] uppercase font-bold">Frais MO</Label>
                  <Input type="number" className="h-8 text-xs" value={editingTeam?.overhead_labor_pct || 0} onChange={e => setEditingTeam({...editingTeam, overhead_labor_pct: parseFloat(e.target.value) || 0})} />
                </div>
                <div className="space-y-1">
                  <Label className="text-[9px] uppercase font-bold">Frais Matériel</Label>
                  <Input type="number" className="h-8 text-xs" value={editingTeam?.overhead_equip_pct || 0} onChange={e => setEditingTeam({...editingTeam, overhead_equip_pct: parseFloat(e.target.value) || 0})} />
                </div>
                <div className="space-y-1">
                  <Label className="text-[9px] uppercase font-bold">Frais Fournit.</Label>
                  <Input type="number" className="h-8 text-xs" value={editingTeam?.overhead_mat_pct || 0} onChange={e => setEditingTeam({...editingTeam, overhead_mat_pct: parseFloat(e.target.value) || 0})} />
                </div>
                <div className="space-y-1">
                  <Label className="text-[9px] uppercase font-bold text-success">Marge</Label>
                  <Input type="number" className="h-8 text-xs border-success/30" value={editingTeam?.margin_pct || 0} onChange={e => setEditingTeam({...editingTeam, margin_pct: parseFloat(e.target.value) || 0})} />
                </div>
                <div className="space-y-1">
                  <Label className="text-[9px] uppercase font-bold text-destructive">Taxe/TVA</Label>
                  <Input type="number" className="h-8 text-xs border-destructive/30" value={editingTeam?.tax_pct || 0} onChange={e => setEditingTeam({...editingTeam, tax_pct: parseFloat(e.target.value) || 0})} />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Colonne Membres */}
              <div className="space-y-3 flex flex-col h-full">
                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-2 font-bold">
                    <Users className="h-4 w-4 text-primary" /> Collaborateurs
                  </Label>
                  <Badge variant="secondary" className="text-[10px]">{editingTeam?.memberIds?.length || 0} sélectionnés</Badge>
                </div>
                
                <div className="space-y-2">
                  <div className="relative">
                    <Search className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
                    <Input placeholder="Filtrer les agents..." className="h-8 pl-8 text-xs" value={memberSearch} onChange={e => setMemberSearch(e.target.value)} />
                  </div>
                  <div className="flex items-center gap-2 px-1">
                    <Switch 
                      id="hide-assigned-members" 
                      checked={hideAssignedMembers} 
                      onCheckedChange={setHideAssignedMembers}
                      className="scale-75 origin-left"
                    />
                    <Label htmlFor="hide-assigned-members" className="text-[10px] cursor-pointer text-muted-foreground uppercase font-bold">
                      Masquer agents déjà en équipe
                    </Label>
                  </div>
                </div>

                <div className="space-y-1 max-h-64 overflow-y-auto p-2 border rounded-md bg-muted/10 grow">
                  {profiles
                    .filter(p => {
                      const matchesSearch = !memberSearch || p.name.toLowerCase().includes(memberSearch.toLowerCase());
                      const isAssignedElsewhere = p.team && p.team !== editingTeam?.name;
                      const isCurrentSelection = editingTeam?.memberIds?.includes(p.id);
                      return matchesSearch && (!hideAssignedMembers || !isAssignedElsewhere || isCurrentSelection);
                    })
                    .map(p => (
                    <div key={p.id} className="flex items-center gap-2 p-1.5 hover:bg-background rounded transition-colors group cursor-pointer" onClick={() => {
                      const ids = editingTeam?.memberIds || [];
                      const isChecked = ids.includes(p.id);
                      setEditingTeam({
                        ...editingTeam,
                        memberIds: !isChecked ? [...ids, p.id] : ids.filter(id => id !== p.id)
                      });
                    }}>
                      <input 
                        type="checkbox" 
                        id={`member-${p.id}`}
                        className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                        checked={editingTeam?.memberIds?.includes(p.id)}
                        readOnly
                      />
                      <label htmlFor={`member-${p.id}`} className="text-xs cursor-pointer flex-1 group-hover:text-primary transition-colors">
                        {p.name}
                        {p.team && p.team !== editingTeam?.name && (
                          <span className="ml-2 text-[9px] text-amber-600 font-bold uppercase italic">(Équipe: {p.team})</span>
                        )}
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              {/* Colonne Matériel */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-2 font-bold">
                    <Wrench className="h-4 w-4 text-primary" /> Matériel
                  </Label>
                  <Badge variant="secondary" className="text-[10px]">{editingTeam?.equipmentIds?.length || 0} sélectionnés</Badge>
                </div>
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
                  <Input placeholder="Chercher un engin..." className="h-8 pl-8 text-xs" value={equipSearch} onChange={e => setEquipmentSearch(e.target.value)} />
                </div>
                <div className="space-y-1 max-h-64 overflow-y-auto p-2 border rounded-md bg-muted/10">
                  {allEquipment.length === 0 ? (
                    <p className="text-[10px] text-center py-4 text-muted-foreground italic">Aucun matériel créé.<br/>Allez dans l'onglet "Parc Matériel".</p>
                  ) : allEquipment
                    .filter(e => !equipSearch || (e.name?.toLowerCase() || "").includes(equipSearch.toLowerCase()) || (e.type?.toLowerCase() || "").includes(equipSearch.toLowerCase()))
                    .length === 0 ? (
                      <p className="text-[10px] text-center py-4 text-muted-foreground italic">Aucun résultat pour "{equipSearch}"</p>
                    ) : (
                      allEquipment
                        .filter(e => !equipSearch || (e.name?.toLowerCase() || "").includes(equipSearch.toLowerCase()) || (e.type?.toLowerCase() || "").includes(equipSearch.toLowerCase()))
                        .map(e => {
                          const isAssignedElsewhere = !!e.team && e.team !== editingTeam?.name;
                          return (
                            <div key={e.id} className="flex items-center gap-2 p-1.5 hover:bg-background rounded transition-colors group">
                              <input 
                                type="checkbox" 
                                id={`equip-${e.id}`}
                                className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                                checked={editingTeam?.equipmentIds?.includes(e.id)}
                                onChange={(ev) => {
                                  const ids = editingTeam?.equipmentIds || [];
                                  setEditingTeam({
                                    ...editingTeam,
                                    equipmentIds: ev.target.checked ? [...ids, e.id] : ids.filter(id => id !== e.id)
                                  });
                                }}
                              />
                              <div className="flex-1 cursor-pointer" onClick={() => {
                                const ids = editingTeam?.equipmentIds || [];
                                const isChecked = ids.includes(e.id);
                                setEditingTeam({
                                  ...editingTeam,
                                  equipmentIds: !isChecked ? [...ids, e.id] : ids.filter(id => id !== e.id)
                                });
                              }}>
                                <label className="text-xs block font-medium group-hover:text-primary transition-colors cursor-pointer">
                                  {e.name}
                                  {isAssignedElsewhere && (
                                    <span className="ml-2 text-[9px] text-amber-600 font-bold uppercase italic">
                                      (Assigné: {e.team || profiles.find(p => p.id === e.assigned_to)?.name})
                                    </span>
                                  )}
                                </label>
                                <span className="text-[10px] text-muted-foreground">{e.type} · Status: {e.status}</span>
                              </div>
                            </div>
                          );
                        })
                    )}
                </div>
              </div>
            </div>
          </div>
          
          <DialogFooter className="p-6 bg-muted/30 border-t">
            <Button variant="ghost" onClick={() => setIsTeamDialogOpen(false)}>Annuler</Button>
            <Button 
              className="min-w-[150px] gap-2" 
              onClick={() => upsertTeamMutation.mutate(editingTeam)} 
              disabled={upsertTeamMutation.isPending || !editingTeam?.name}
            >
              {upsertTeamMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {editingTeam?.id ? "Mettre à jour" : "Créer l'équipe"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isEquipmentDialogOpen} onOpenChange={setIsEquipmentDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editingEquipment?.id ? 'Modifier' : 'Nouveau'} Matériel</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-4 gap-4">
              <div className="grid gap-2 col-span-1">
                <Label>N° Immo</Label>
                <Input value={editingEquipment?.internal_id || ''} onChange={e => setEditingEquipment({...editingEquipment, internal_id: e.target.value})} placeholder="001" />
              </div>
              <div className="grid gap-2 col-span-3">
                <Label>Nom de la machine</Label>
                <Input value={editingEquipment?.name || ''} onChange={e => setEditingEquipment({...editingEquipment, name: e.target.value})} placeholder="Ex: Tondeuse Autoportée X1..." />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Numéro de série</Label>
                <Input value={editingEquipment?.serial_number || ''} onChange={e => setEditingEquipment({...editingEquipment, serial_number: e.target.value})} placeholder="S/N..." />
              </div>
              <div className="grid gap-2">
                <Label>Motorisation</Label>
                <Input value={editingEquipment?.motorization_type || ''} onChange={e => setEditingEquipment({...editingEquipment, motorization_type: e.target.value})} placeholder="Essence, 2T, Elec..." />
              </div>
            </div>

            {editingEquipment?.type === 'Véhicule' && (
              <div className="grid gap-2">
                <Label>Plaque d'immatriculation</Label>
                <Input value={editingEquipment?.registration_number || ''} onChange={e => setEditingEquipment({...editingEquipment, registration_number: e.target.value})} placeholder="AA-123-BB" />
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2"><Label>Type</Label>
                <Select value={editingEquipment?.type} onValueChange={v => setEditingEquipment({...editingEquipment, type: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Engin">Engin</SelectItem>
                    <SelectItem value="Petit Matériel">Petit Matériel</SelectItem>
                    <SelectItem value="Véhicule">Véhicule</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2"><Label>Coût horaire (€/h)</Label><Input type="number" step="0.01" value={editingEquipment?.hourly_cost || 0} onChange={e => setEditingEquipment({...editingEquipment, hourly_cost: parseFloat(e.target.value) || 0})} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2"><Label>Seuil révision (h)</Label><Input type="number" value={editingEquipment?.hours_for_maintenance || 100} onChange={e => setEditingEquipment({...editingEquipment, hours_for_maintenance: parseInt(e.target.value) || 0})} /></div>
              <div className="grid gap-2"><Label>Statut actuel</Label>
                <Select value={editingEquipment?.status} onValueChange={v => setEditingEquipment({...editingEquipment, status: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="OK">Opérationnel (OK)</SelectItem>
                    <SelectItem value="Maintenance requise">Maintenance requise</SelectItem>
                    <SelectItem value="En panne">En panne</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button className="w-full" onClick={() => upsertEquipmentMutation.mutate(editingEquipment)} disabled={upsertEquipmentMutation.isPending}>
              {upsertEquipmentMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enregistrer le matériel"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isConfirmDeleteOpen} onOpenChange={setIsConfirmDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{itemToDelete?.type === 'team' ? "Confirmer l'archivage ?" : itemToDelete?.type === 'equipment' ? "Confirmer la suppression du matériel ?" : "Confirmer la suppression ?"}</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 pt-2 text-sm text-muted-foreground">
                {itemToDelete?.type === 'team' ? (
                  <>
                    <p>Êtes-vous sûr de vouloir archiver l'équipe <strong>"{itemToDelete?.name}"</strong> ? Elle ne sera plus visible dans le planning mais ses données historiques seront conservées.</p>
                    {hasUrgentFutureTasks ? (
                      <div className="flex items-start gap-2 p-3 rounded-md bg-destructive/10 border border-destructive/20 text-destructive text-xs font-medium">
                        <AlertTriangle className="h-4 w-4 shrink-0" />
                        <div>
                          <p className="font-bold uppercase mb-1">Archivage bloqué</p>
                          <p>Cette équipe a des chantiers <strong>urgents</strong> prévus. Vous devez les réassigner ou les annuler avant de pouvoir archiver cette équipe.</p>
                        </div>
                      </div>
                    ) : hasFutureTasks && (
                      <div className="flex items-start gap-2 p-3 rounded-md bg-destructive/10 border border-destructive/20 text-destructive text-xs font-medium">
                        <AlertTriangle className="h-4 w-4 shrink-0" />
                        <div>
                          <p className="font-bold uppercase mb-1">Attention : Chantiers en cours</p>
                          <p>Cette équipe a encore des interventions prévues ou en cours. Si vous l'archivez, ces chantiers devront être réassignés manuellement.</p>
                        </div>
                      </div>
                    )}
                  </>
                ) : itemToDelete?.type === 'equipment' ? (
                  <p>Êtes-vous sûr de vouloir supprimer définitivement <strong>"{itemToDelete?.name}"</strong> ? Cette action est irréversible et peut affecter les rapports de chantiers passés.</p>
                ) : (
                  <p>Êtes-vous sûr de vouloir supprimer <strong>"{itemToDelete?.name}"</strong> ? Cette action est irréversible.</p>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleConfirmDelete} 
              disabled={hasUrgentFutureTasks}
              className={itemToDelete?.type === 'team' ? "bg-amber-600 hover:bg-amber-700 text-white" : "bg-destructive text-white hover:bg-destructive/90"}
            >
              {itemToDelete?.type === 'team' ? "Archiver" : "Supprimer"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}