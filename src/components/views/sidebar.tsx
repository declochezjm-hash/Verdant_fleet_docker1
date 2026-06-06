import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { 
  LayoutDashboard, 
  Briefcase, 
  CalendarDays, 
  MapPin, 
  Wrench, 
  Package, 
  TrendingUp, 
  Settings,
  AlertTriangle,
  Leaf,
  HelpCircle,
  CheckCircle2,
  Play,
  ChevronRight,
  Search,
  Info,
  BookOpen,
  Lightbulb,
  Pencil,
  Users,
  MousePointer2
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState, useMemo } from "react";

export function Sidebar() {
  const { user, primaryRole, profile } = useAuth();
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [helpSearch, setHelpSearch] = useState("");

  // Récupération du nombre d'alertes maintenance (status != 'OK')
  const { data: alertsCount = 0 } = useQuery({
    queryKey: ["equipment-alerts-count"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("v_equipment_alerts")
        .select("*", { count: "exact", head: true });
      if (error) throw error;
      return count || 0;
    },
  });

  // Récupération du nombre d'anomalies non résolues (resolved = false)
  const { data: unresolvedAnomaliesCount = 0 } = useQuery({
    queryKey: ["unresolved-anomalies-count"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("anomalies")
        .select("*", { count: "exact", head: true })
        .eq("resolved", false);
      if (error) throw error;
      return count || 0;
    },
  });

  const navItems = useMemo(() => {
    const items = [
      { label: "Tableau de bord", icon: LayoutDashboard, to: "/" },
      { label: "Gestion chantiers", icon: Briefcase, to: "/coordinator" },
      { label: "Planning", icon: CalendarDays, to: "/planning" },
      { label: "Carte", icon: MapPin, to: "/carte" },
      { 
        label: "Matériel", 
        icon: Wrench, 
        to: "/materiel",
        badge: alertsCount > 0 ? alertsCount : null 
      },
      { 
        label: "Anomalies", 
        icon: AlertTriangle, 
        to: "/anomalies",
        badge: unresolvedAnomaliesCount > 0 ? unresolvedAnomaliesCount : null 
      },
      { label: "Stocks", icon: Package, to: "/stocks" },
      { label: "Analytique", icon: TrendingUp, to: "/analytics" },
      { label: "Paramètres", icon: Settings, to: "/settings" },
    ];

    if (primaryRole === "agent") {
      // L'agent ne voit que Planning et Carte (on utilise les routes pour plus de robustesse)
      return items.filter(i => ["/planning", "/carte"].includes(i.to));
    }
    return items;
  }, [primaryRole, alertsCount, unresolvedAnomaliesCount]);

  // Base de connaissances détaillée
  const helpArticles = useMemo(() => {
    const articles = [
      {
        title: "Démarrer une mission",
        category: "Terrain",
        content: "Appuyez sur 'Démarrer' dès votre arrivée sur site. Cela active l'horodatage GPS requis pour le calcul précis de la rentabilité du chantier.",
        roles: ["agent"],
        icon: <Play className="h-4 w-4 text-primary" />
      },
      {
        title: "Photos et Annotations",
        category: "Qualité",
        content: "Capturez l'état du site 'Avant' et 'Après'. Utilisez l'outil d'annotation pour marquer des points critiques (fuites, zones non traitées) en rouge vif. Ces preuves sont horodatées et archivées dans le rapport final pour protéger l'entreprise en cas de litige client.",
        roles: ["agent"],
        icon: <Pencil className="h-4 w-4 text-primary" />
      },
      {
        title: "Itinéraires & GPS",
        category: "Navigation",
        content: "Dans l'onglet 'Carte' ou le détail d'un chantier, utilisez le bouton 'Itinéraire'. Le système calcule la distance et le temps de trajet estimé. Vous pouvez basculer vers Google Maps ou Waze pour une navigation pas à pas vers le chantier.",
        roles: ["agent", "coordinator"],
        icon: <MapPin className="h-4 w-4 text-primary" />
      },
      {
        title: "Validation des Stocks",
        category: "Stocks",
        content: "Lors de la saisie des consommables, le logiciel compare votre demande avec le stock théorique du dépôt. Si le stock est insuffisant, une alerte orange apparaît. Assurez-vous que le lot (N° AMM) correspond bien à l'étiquette physique du produit utilisé pour la traçabilité.",
        roles: ["agent"],
        icon: <Package className="h-4 w-4 text-primary" />
      },
      {
        title: "Signaler une Panne",
        category: "Urgence",
        content: "En cas de panne, utilisez le bouton triangle rouge. Précisez si l'arrêt est immédiat ou si l'engin reste utilisable pour finir la journée. Un signalement bloque automatiquement l'affectation de cet engin sur de nouveaux chantiers jusqu'à sa réparation validée.",
        roles: ["agent", "coordinator"],
        icon: <AlertTriangle className="h-4 w-4 text-destructive" />
      },
      {
        title: "Sélecteur GPS de Chantier",
        category: "Planification",
        content: "Lors de la création d'un chantier, activez 'Pointer sur la carte'. Vous pouvez saisir une adresse précise, utiliser le bouton 'Ma position' pour vous géolocaliser, ou cliquer directement sur la carte pour placer le marqueur. Le système récupère automatiquement l'adresse par géocodage inverse. Une position précise est vitale pour le guidage GPS des agents.",
        roles: ["coordinator", "admin"],
        icon: <MapPin className="h-4 w-4 text-primary" />
      },
      {
        title: "Optimisation du Planning",
        category: "Planning",
        content: "Glissez-déposez les missions pour équilibrer la charge de travail entre les équipes. Le coût horaire moyen (PV Final) de chaque groupe est affiché : comparez-le au budget du client pour garantir la rentabilité immédiate de vos affectations.",
        roles: ["coordinator", "admin"],
        icon: <CalendarDays className="h-4 w-4 text-primary" />
      },
      {
        title: "Le Glisser-Déposer (Drag & Drop)",
        category: "Trucs & Astuces",
        content: "Réorganisez votre planning en un clin d'œil : maintenez le clic sur un chantier pour le déplacer vers une autre équipe ou un autre jour. La zone de destination se colore en bleu pour confirmer l'action. Notez que l'heure exacte du chantier est conservée lors du déplacement, vous permettant de garder votre séquence logique.",
        roles: ["coordinator", "admin"],
        icon: <MousePointer2 className="h-4 w-4 text-primary" />
      },
      {
        title: "Déboursé Sec vs Prix de Revient",
        category: "Gestion",
        content: "Le 'Déboursé Sec' est le coût direct (Salaires + Carburant + Produits). Le 'Prix de Revient' y ajoute les Frais Généraux (Overheads) configurés par équipe (loyer, administratif, assurances). Vos graphiques analytiques utilisent le Prix de Revient pour calculer la Marge Nette réelle.",
        roles: ["coordinator", "admin"],
        icon: <TrendingUp className="h-4 w-4 text-primary" />
      },
      {
        title: "Alertes Météo Intelligentes",
        category: "Planning",
        content: "Le système interroge les prévisions à 5 jours. Si une tâche est marquée 'Temps sec requis' et que de la pluie est prévue, un badge d'alerte animé (bounce) apparaît sur le planning. Nous vous conseillons de décaler ces interventions pour éviter les malfaçons ou le lessivage des produits.",
        roles: ["coordinator", "admin"],
        icon: <Leaf className="h-4 w-4 text-success" />
      },
      {
        title: "Suivi du Parc Matériel",
        category: "Entretien",
        content: "Chaque engin possède un compteur d'heures incrémenté automatiquement à chaque clôture de tâche (via le RPC finish_task). Consultez l'historique d'utilisation 30 jours pour anticiper les révisions et éviter les pannes immobilisantes en pleine saison.",
        roles: ["coordinator", "admin"],
        icon: <Wrench className="h-4 w-4 text-primary" />
      },
      {
        title: "Registre Phytosanitaire Légal",
        category: "Réglementation",
        content: "L'export 'Registre Phyto' compile automatiquement les dates, produits (AMM), doses au m², numéros de lots et applicateurs. Ce document est conforme aux exigences de l'administration pour les contrôles Certiphyto et doit être conservé 5 ans par l'entreprise.",
        roles: ["admin"],
        icon: <BookOpen className="h-4 w-4 text-success" />
      },
      {
        title: "Onboarding Collaborateurs",
        category: "RH",
        content: "Utilisez le bouton 'Générer Code' dans les paramètres pour créer un accès instantané. Le collaborateur pourra se connecter avec son email et ce code sans attendre l'invitation.",
        roles: ["admin"],
        icon: <Users className="h-4 w-4 text-primary" />
      }
    ];

    return articles.filter(a => {
      const isForRole = a.roles.includes(primaryRole || "agent");
      if (!isForRole) return false;
      if (!helpSearch) return true;
      
      const search = helpSearch.toLowerCase();
      return a.title.toLowerCase().includes(search) || 
             a.content.toLowerCase().includes(search) || 
             a.category.toLowerCase().includes(search);
    });
  }, [primaryRole, helpSearch]);

  return (
    <div className="flex h-screen w-64 flex-col border-r bg-card text-card-foreground shadow-sm">
      <div className="flex h-16 items-center gap-2 border-b px-6">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Leaf className="h-5 w-5" />
        </div>
        <span className="text-lg font-bold tracking-tight text-primary">VERDURA</span>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-4">
        {navItems.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            activeProps={{
              className: "bg-primary text-primary-foreground shadow-sm",
            }}
            inactiveProps={{
              className: "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
            }}
            className={cn(
              "flex items-center justify-between gap-3 rounded-md px-3 py-2 text-sm font-medium transition-all"
            )}
          >
            <div className="flex items-center gap-3">
              <item.icon className="h-4 w-4" />
              {item.label}
            </div>
            {item.badge && (
              <span className="relative flex h-5 w-5 items-center justify-center">
                {item.label === "Anomalies" && unresolvedAnomaliesCount > 5 && (
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-destructive opacity-75"></span>
                )}
                <span className="relative flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground shadow-sm">
                  {item.badge}
                </span>
              </span>
            )}
          </Link>
        ))}
      </nav>

      <div className="border-t p-4 space-y-2">
        {/* Centre d'aide contextuel */}
        <Dialog open={isHelpOpen} onOpenChange={setIsHelpOpen}>
          <DialogTrigger asChild>
            <button className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-all">
              <HelpCircle className="h-4 w-4" />
              Aide à l'utilisation
            </button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col p-0 overflow-hidden">
            <DialogHeader className="p-6 bg-primary/5">
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <BookOpen className="h-5 w-5 text-primary" />
                      <DialogTitle className="text-xl">Centre de Connaissances</DialogTitle>
                    </div>
                    <DialogDescription>
                      Guide interactif pour le profil <span className="font-bold text-foreground capitalize">{primaryRole}</span>.
                    </DialogDescription>
                  </div>
                  <Badge variant="outline" className="bg-primary/10 text-primary uppercase text-[10px]">VF-v1.0</Badge>
                </div>
                
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input 
                    placeholder="Rechercher une fonctionnalité (ex: météo, photo, marge)..." 
                    className="pl-9 bg-background"
                    value={helpSearch}
                    onChange={(e) => setHelpSearch(e.target.value)}
                  />
                </div>
              </div>
            </DialogHeader>
            
            <ScrollArea className="flex-1 p-6">
              <div className="space-y-8">
                {helpArticles.length === 0 ? (
                  <div className="py-12 text-center space-y-2">
                    <div className="bg-muted inline-flex p-3 rounded-full mb-2">
                      <Search className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <p className="text-sm font-medium">Aucun guide trouvé pour "{helpSearch}"</p>
                    <p className="text-xs text-muted-foreground">Essayez des termes plus simples comme "chantier" ou "machine".</p>
                  </div>
                ) : (
                  helpArticles.map((article, idx) => (
                    <HelpSection key={idx} title={article.title} category={article.category} icon={article.icon}>
                      {article.content}
                    </HelpSection>
                  ))
                )}
                
                <Separator />
                
                <div className="flex items-start gap-4 rounded-lg bg-amber-50 p-4 border border-amber-200 dark:bg-amber-950/20 dark:border-amber-900/50">
                  <Lightbulb className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="text-sm font-bold text-amber-900 dark:text-amber-400">Le saviez-vous ?</p>
                    <p className="text-xs text-amber-800/80 dark:text-amber-500/80 leading-relaxed">
                      Vous pouvez cliquer sur les badges d'anomalies dans la barre latérale pour accéder directement au journal des pannes.
                    </p>
                  </div>
                </div>

                <div className="rounded-lg bg-muted/50 p-4 border border-dashed text-center">
                  <p className="text-xs text-muted-foreground font-medium flex items-center justify-center gap-2">
                    <Info className="h-3 w-3" /> Support technique
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-1 italic">Contactez le gestionnaire de flotte au 04.XX.XX.XX.XX</p>
                </div>
              </div>
            </ScrollArea>
            <div className="p-4 bg-muted/20 border-t flex justify-end">
               <Button onClick={() => { setIsHelpOpen(false); setHelpSearch(""); }} size="sm">Fermer l'aide</Button>
            </div>
          </DialogContent>
        </Dialog>

        <div className="flex items-center gap-3 rounded-lg bg-muted/50 p-3">
          <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">
            {profile?.name?.substring(0, 2).toUpperCase() || "VF"}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium capitalize">{profile?.name || "Utilisateur"}</p>
            <p className="truncate text-[10px] text-muted-foreground capitalize">{primaryRole}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function HelpSection({ title, category, icon, children }: { title: string, category: string, icon: React.ReactNode, children: React.ReactNode }) {
  return (
    <div className="space-y-1.5 group">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded bg-muted group-hover:bg-primary/10 transition-colors">
            {icon}
          </div>
          <h4 className="text-sm font-bold text-foreground">{title}</h4>
        </div>
        <Badge variant="outline" className="text-[8px] uppercase tracking-tighter opacity-60">{category}</Badge>
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed pl-9">
        {children}
      </p>
    </div>
  );
}