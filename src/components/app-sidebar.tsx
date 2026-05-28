import { Link, useRouterState } from "@tanstack/react-router";
import {
  CalendarDays,
  LayoutDashboard,
  Package,
  Wrench,
  Map as MapIcon,
  Receipt,
  ClipboardList,
  Leaf,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { useStore } from "@/lib/mock-data";

const coordinatorItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Planning", url: "/planning", icon: CalendarDays },
  { title: "Carte chantiers", url: "/carte", icon: MapIcon },
  { title: "Stocks & Phyto", url: "/stocks", icon: Package },
  { title: "Parc matériel", url: "/materiel", icon: Wrench },
];

const adminItems = [
  { title: "Analytique", url: "/analytique", icon: Receipt },
  { title: "Stocks & Phyto", url: "/stocks", icon: Package },
  { title: "Parc matériel", url: "/materiel", icon: Wrench },
];

const agentItems = [
  { title: "Mon planning", url: "/", icon: ClipboardList },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const role = useStore((s) => s.currentRole);
  const path = useRouterState({ select: (r) => r.location.pathname });
  const items = role === "agent" ? agentItems : role === "admin" ? adminItems : coordinatorItems;

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border px-3 py-4">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Leaf className="h-5 w-5" />
          </div>
          {!collapsed && (
            <div>
              <div className="text-sm font-semibold">Verdura</div>
              <div className="text-xs text-muted-foreground">Espaces verts</div>
            </div>
          )}
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>
            {role === "agent" ? "Terrain" : role === "admin" ? "Compta" : "Pilotage"}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild isActive={path === item.url}>
                    <Link to={item.url} className="flex items-center gap-2">
                      <item.icon className="h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
