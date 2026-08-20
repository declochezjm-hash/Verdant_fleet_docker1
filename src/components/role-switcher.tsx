import { useAuth } from "@/lib/auth-context";
import { useStore, type Role } from "@/lib/mock-data";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LogOut, LogIn } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { VerduraChatButton } from "@/components/chat/VerduraFloatingButton";

export function RoleSwitcher() {
  const { session, profile, primaryRole, signOut } = useAuth();
  const { currentRole, setCurrentRole } = useStore();

  if (!session) {
    return (
      <Button asChild size="sm" variant="outline">
        <Link to="/auth"><LogIn className="mr-1 h-4 w-4" /> Se connecter</Link>
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-2 sm:gap-3">
      <VerduraChatButton />
      <div className="hidden text-right sm:block">
        <div className="text-sm font-medium leading-tight">{profile?.name ?? session.user.email}</div>
        <div className="text-xs text-muted-foreground">{profile?.team}</div>
      </div>
      <Badge variant="secondary" className="hidden md:inline-flex capitalize">{primaryRole ?? "—"}</Badge>
      {/* Mock view switcher: useful for coord/admin to preview other dashboards */}
      <Select value={currentRole} onValueChange={(v) => setCurrentRole(v as Role)}>
        <SelectTrigger className="w-[170px]"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="agent">👷 Vue Agent (démo)</SelectItem>
          <SelectItem value="coordinator">🗺️ Vue Coordinateur</SelectItem>
          <SelectItem value="admin">📊 Vue Admin</SelectItem>
        </SelectContent>
      </Select>
      <Button size="icon" variant="ghost" onClick={signOut} title="Se déconnecter"><LogOut className="h-4 w-4" /></Button>
    </div>
  );
}
