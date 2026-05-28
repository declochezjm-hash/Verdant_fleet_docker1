import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { 
  LayoutDashboard, 
  Briefcase, 
  CalendarDays, 
  MapPin, 
  Wrench, 
  Package, 
  TrendingUp, 
  Settings,
  Leaf
} from "lucide-react";
import { cn } from "@/lib/utils";

export function Sidebar() {
  // Récupération du nombre d'alertes maintenance (status != 'OK')
  const { data: alertsCount = 0 } = useQuery({
    queryKey: ["equipment-alerts-count"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("equipment")
        .select("*", { count: "exact", head: true })
        .neq("status", "OK");
      if (error) throw error;
      return count || 0;
    },
  });

  const navItems = [
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
    { label: "Stocks", icon: Package, to: "/stocks" },
    { label: "Analytique", icon: TrendingUp, to: "/analytics" },
    { label: "Paramètres", icon: Settings, to: "/settings" },
  ];

  return (
    <div className="flex h-screen w-64 flex-col border-r bg-card text-card-foreground shadow-sm">
      <div className="flex h-16 items-center gap-2 border-b px-6">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Leaf className="h-5 w-5" />
        </div>
        <span className="text-lg font-bold tracking-tight text-primary">Verdant Fleet</span>
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
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground shadow-sm">
                {item.badge}
              </span>
            )}
          </Link>
        ))}
      </nav>

      <div className="border-t p-4">
        <div className="flex items-center gap-3 rounded-lg bg-muted/50 p-3">
          <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">
            CP
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium">Coordination</p>
            <p className="truncate text-[10px] text-muted-foreground">Verdant Fleet Admin</p>
          </div>
        </div>
      </div>
    </div>
  );
}