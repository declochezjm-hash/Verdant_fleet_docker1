// Données fictives pour la V1 démo (in-memory, partagées via Zustand-like store léger)
import { create } from "zustand";

export type Role = "agent" | "coordinator" | "admin";

export interface User {
  id: string;
  name: string;
  role: Role;
  team: string;
  hourlyRate: number;
  avatar?: string;
}

export interface Product {
  id: string;
  name: string;
  ammNumber?: string; // Pour le registre phytosanitaire
  category: "Engrais" | "Phyto" | "Semences";
  unit: "L" | "Kg" | "Sac";
  stock: number;
  threshold: number;
  pricePerUnit: number;
}

export interface Equipment {
  id: string;
  name: string;
  type: "Tondeuse" | "Camion" | "Tronçonneuse" | "Débroussailleuse" | "Taille-haie";
  assignedTo: string | null;
  hoursUsed: number;
  hoursForMaintenance: number;
  status: "OK" | "Maintenance requise" | "En panne";
  lastMaintenance: string;
  hourlyCost: number;
}

export interface MaintenanceLog {
  id: string;
  equipmentId: string;
  date: string;
  type: "Révision" | "Réparation" | "Contrôle";
  description: string;
  cost: number;
}

export interface ProductUsage {
  productId: string;
  quantity: number;
  lotNumber?: string;
  dosePerM2?: number;
}

export interface Task {
  id: string;
  title: string;
  client: string;
  address: string;
  lat: number;
  lng: number;
  date: string; // ISO
  duration: number; // hours
  team: string;
  assignedAgents: string[];
  equipmentIds: string[];
  status: "planifié" | "en cours" | "terminé";
  startedAt?: string;
  finishedAt?: string;
  productsUsed: ProductUsage[];
  budget: number;
  laborCost?: number;
  signature?: string;
  photos: { before?: string; after?: string };
  notes?: string;
}

export const USERS: User[] = [
  { id: "u1", name: "Lucas Martin", role: "agent", team: "Équipe Nord", hourlyRate: 38 },
  { id: "u2", name: "Sophie Bernard", role: "agent", team: "Équipe Nord", hourlyRate: 35 },
  { id: "u3", name: "Karim Dubois", role: "agent", team: "Équipe Sud", hourlyRate: 42 },
  { id: "u4", name: "Emma Laurent", role: "agent", team: "Équipe Sud", hourlyRate: 35 },
  { id: "u5", name: "Julien Roux", role: "coordinator", team: "Coordination", hourlyRate: 45 },
  { id: "u6", name: "Marie Petit", role: "admin", team: "Administration", hourlyRate: 50 },
];

const today = new Date();
const iso = (offset: number, h = 8) => {
  const d = new Date(today);
  d.setDate(d.getDate() + offset);
  d.setHours(h, 0, 0, 0);
  return d.toISOString();
};

const initialProducts: Product[] = [
  { id: "p1", name: "Engrais NPK 15-15-15", category: "Engrais", unit: "Kg", stock: 120, threshold: 50, pricePerUnit: 2.5, ammNumber: "2010123" },
  { id: "p2", name: "Glyphosate Pro", category: "Phyto", unit: "L", stock: 8, threshold: 15, pricePerUnit: 18, ammNumber: "9800045" },
  { id: "p3", name: "Gazon Sport Mix", category: "Semences", unit: "Sac", stock: 24, threshold: 10, pricePerUnit: 45, ammNumber: "N/A" },
  { id: "p4", name: "Anti-mousse gazon", category: "Phyto", unit: "L", stock: 32, threshold: 10, pricePerUnit: 12, ammNumber: "2050012" },
  { id: "p5", name: "Engrais organique BIO", category: "Engrais", unit: "Sac", stock: 5, threshold: 8, pricePerUnit: 28, ammNumber: "BIO-001" },
  { id: "p6", name: "Semences prairie fleurie", category: "Semences", unit: "Kg", stock: 18, threshold: 5, pricePerUnit: 32, ammNumber: "N/A" },
];

const initialEquipment: Equipment[] = [
  { id: "e1", name: "Tondeuse Honda HRX", type: "Tondeuse", assignedTo: "u1", hoursUsed: 145, hoursForMaintenance: 150, status: "Maintenance requise", lastMaintenance: "2026-02-10", hourlyCost: 4.5 },
  { id: "e2", name: "Camion Renault Master", type: "Camion", assignedTo: "u1", hoursUsed: 820, hoursForMaintenance: 1000, status: "OK", lastMaintenance: "2026-03-15", hourlyCost: 12 },
  { id: "e3", name: "Tronçonneuse Stihl MS261", type: "Tronçonneuse", assignedTo: "u3", hoursUsed: 95, hoursForMaintenance: 100, status: "Maintenance requise", lastMaintenance: "2026-01-20", hourlyCost: 3.2 },
  { id: "e4", name: "Débroussailleuse Husqvarna", type: "Débroussailleuse", assignedTo: "u2", hoursUsed: 60, hoursForMaintenance: 120, status: "OK", lastMaintenance: "2026-04-01", hourlyCost: 2.8 },
  { id: "e5", name: "Taille-haie Stihl HS82", type: "Taille-haie", assignedTo: null, hoursUsed: 30, hoursForMaintenance: 80, status: "OK", lastMaintenance: "2026-04-22", hourlyCost: 2.1 },
  { id: "e6", name: "Tondeuse autoportée Kubota", type: "Tondeuse", assignedTo: "u4", hoursUsed: 210, hoursForMaintenance: 250, status: "OK", lastMaintenance: "2026-03-01", hourlyCost: 8.5 },
];

const initialMaintenance: MaintenanceLog[] = [
  { id: "m1", equipmentId: "e1", date: "2026-02-10", type: "Révision", description: "Vidange + filtre + lame", cost: 85 },
  { id: "m2", equipmentId: "e2", date: "2026-03-15", type: "Contrôle", description: "Contrôle technique annuel", cost: 95 },
  { id: "m3", equipmentId: "e3", date: "2026-01-20", type: "Réparation", description: "Remplacement chaîne et guide", cost: 120 },
  { id: "m4", equipmentId: "e6", date: "2026-03-01", type: "Révision", description: "Révision 200h complète", cost: 240 },
];

const initialTasks: Task[] = [
  {
    id: "t1", title: "Tonte parc municipal", client: "Mairie de Lyon", address: "Parc de la Tête d'Or, Lyon",
    lat: 45.7785, lng: 4.852, date: iso(0, 8), duration: 4, team: "Équipe Nord",
    assignedAgents: ["u1", "u2"], equipmentIds: ["e1", "e2"], status: "planifié",
    productsUsed: [], budget: 480, photos: {},
  },
  {
    id: "t2", title: "Traitement anti-mousse", client: "Résidence Les Tilleuls", address: "12 av. des Frères Lumière, Lyon",
    lat: 45.745, lng: 4.87, date: iso(0, 13), duration: 3, team: "Équipe Nord",
    assignedAgents: ["u1"], equipmentIds: ["e4"], status: "planifié",
    productsUsed: [], budget: 320, photos: {},
  },
  {
    id: "t3", title: "Élagage allée bordée", client: "Domaine du Château", address: "Route de Vienne, Saint-Priest",
    lat: 45.696, lng: 4.945, date: iso(0, 9), duration: 6, team: "Équipe Sud",
    assignedAgents: ["u3", "u4"], equipmentIds: ["e3", "e6"], status: "en cours",
    startedAt: new Date().toISOString(),
    productsUsed: [], budget: 720, photos: {},
  },
  {
    id: "t4", title: "Semis prairie fleurie", client: "Lycée Agricole", address: "Chemin des Vignes, Écully",
    lat: 45.775, lng: 4.78, date: iso(1, 8), duration: 5, team: "Équipe Nord",
    assignedAgents: ["u2"], equipmentIds: ["e4"], status: "planifié",
    productsUsed: [], budget: 540, photos: {},
  },
  {
    id: "t5", title: "Fertilisation terrain de sport", client: "Club Olympique", address: "Stade Gerland, Lyon",
    lat: 45.722, lng: 4.832, date: iso(2, 8), duration: 4, team: "Équipe Sud",
    assignedAgents: ["u3"], equipmentIds: ["e6"], status: "planifié",
    productsUsed: [], budget: 460, photos: {},
  },
  {
    id: "t6", title: "Tonte espaces verts copro", client: "Syndic Habitat 69", address: "Rue Garibaldi, Lyon",
    lat: 45.756, lng: 4.852, date: iso(-1, 8), duration: 5, team: "Équipe Nord",
    assignedAgents: ["u1", "u2"], equipmentIds: ["e1"], status: "terminé",
    startedAt: iso(-1, 8), finishedAt: iso(-1, 13),
    productsUsed: [{ productId: "p1", quantity: 12 }],
    budget: 600, laborCost: 525, photos: {},
  },
  {
    id: "t7", title: "Désherbage cour école", client: "École Jean Jaurès", address: "Place Jaurès, Villeurbanne",
    lat: 45.768, lng: 4.882, date: iso(-2, 9), duration: 3, team: "Équipe Sud",
    assignedAgents: ["u4"], equipmentIds: ["e4"], status: "terminé",
    startedAt: iso(-2, 9), finishedAt: iso(-2, 12),
    productsUsed: [{ productId: "p2", quantity: 4 }, { productId: "p4", quantity: 6 }],
    budget: 380, laborCost: 285, photos: {},
  },
];

interface AppState {
  currentUserId: string;
  setCurrentUserId: (id: string) => void;
  currentRole: Role;
  setCurrentRole: (r: Role) => void;
  users: User[];
  products: Product[];
  equipment: Equipment[];
  maintenance: MaintenanceLog[];
  tasks: Task[];
  startTask: (taskId: string) => void;
  finishTask: (taskId: string, payload: { signature?: string; notes?: string; products?: ProductUsage[] }) => void;
  addProductUsage: (taskId: string, usage: ProductUsage) => void;
  removeProductUsage: (taskId: string, productId: string) => void;
  setTaskPhoto: (taskId: string, kind: "before" | "after", dataUrl: string) => void;
  reportAnomaly: (taskId: string, equipmentId: string, description: string) => void;
  reassignTaskTeam: (taskId: string, team: string, dateISO?: string) => void;
  addMaintenance: (log: Omit<MaintenanceLog, "id">) => void;
  updateUserRate: (userId: string, rate: number) => void;
  anomalies: { id: string; taskId: string; equipmentId: string; description: string; date: string }[];
}

export const useStore = create<AppState>((set, get) => ({
  currentUserId: "u5",
  currentRole: "coordinator",
  setCurrentUserId: (id) => {
    const u = get().users.find((x) => x.id === id);
    if (u) set({ currentUserId: id, currentRole: u.role });
  },
  setCurrentRole: (r) => {
    const u = get().users.find((x) => x.role === r);
    set({ currentRole: r, currentUserId: u?.id ?? get().currentUserId });
  },
  users: USERS,
  products: initialProducts,
  equipment: initialEquipment,
  maintenance: initialMaintenance,
  tasks: initialTasks.map(t => ({ ...t, status: t.status as any })), // Alignment with task_status enum logic
  startTask: (taskId) =>
    set((s) => ({
      tasks: s.tasks.map((t) =>
        t.id === taskId ? { ...t, status: "en cours", startedAt: new Date().toISOString() } : t
      ),
    })),
  finishTask: (taskId, payload) =>
    set((s) => {
      const task = s.tasks.find((t) => t.id === taskId);
      if (!task) return s;
      const products = payload.products ?? task.productsUsed;
      // décrémenter stock
      const newProducts = s.products.map((p) => {
        const used = products.find((u) => u.productId === p.id);
        return used ? { ...p, stock: Math.max(0, p.stock - used.quantity) } : p;
      });
      const start = task.startedAt ? new Date(task.startedAt) : new Date();
      const finish = new Date();
      const hours = Math.max(0.5, (finish.getTime() - start.getTime()) / 3_600_000);
      const labor = task.assignedAgents.reduce((sum, agentId) => {
        const agent = s.users.find((u) => u.id === agentId);
        return sum + hours * (agent?.hourlyRate ?? 35);
      }, 0);
      return {
        tasks: s.tasks.map((t) =>
          t.id === taskId
            ? {
                ...t,
                status: "terminé",
                finishedAt: finish.toISOString(),
                productsUsed: products,
                signature: payload.signature ?? t.signature,
                notes: payload.notes ?? t.notes,
                laborCost: labor,
              }
            : t
        ),
        products: newProducts,
      };
    }),
  addProductUsage: (taskId, usage) =>
    set((s) => ({
      tasks: s.tasks.map((t) =>
        t.id === taskId
          ? {
              ...t,
              productsUsed: (() => {
                const idx = t.productsUsed.findIndex((u) => u.productId === usage.productId);
                if (idx >= 0) {
                  const next = [...t.productsUsed];
                  next[idx] = { ...next[idx], quantity: next[idx].quantity + usage.quantity };
                  return next;
                }
                return [...t.productsUsed, usage];
              })(),
            }
          : t
      ),
    })),
  removeProductUsage: (taskId, productId) =>
    set((s) => ({
      tasks: s.tasks.map((t) =>
        t.id === taskId ? { ...t, productsUsed: t.productsUsed.filter((u) => u.productId !== productId) } : t
      ),
    })),
  setTaskPhoto: (taskId, kind, dataUrl) =>
    set((s) => ({
      tasks: s.tasks.map((t) =>
        t.id === taskId ? { ...t, photos: { ...t.photos, [kind]: dataUrl } } : t
      ),
    })),
  anomalies: [],
  reportAnomaly: (taskId, equipmentId, description) =>
    set((s) => ({
      anomalies: [
        { id: `a${Date.now()}`, taskId, equipmentId, description, date: new Date().toISOString() },
        ...s.anomalies,
      ],
      equipment: s.equipment.map((e) =>
        e.id === equipmentId ? { ...e, status: "Maintenance requise" } : e
      ),
    })),
  updateUserRate: (userId, rate) =>
    set((s) => ({
      users: s.users.map((u) => (u.id === userId ? { ...u, hourlyRate: rate } : u)),
    })),
  reassignTaskTeam: (taskId, team, dateISO) =>
    set((s) => ({
      tasks: s.tasks.map((t) => (t.id === taskId ? { ...t, team, date: dateISO ?? t.date } : t)),
    })),
  addMaintenance: (log) =>
    set((s) => ({
      maintenance: [{ ...log, id: `m${Date.now()}` }, ...s.maintenance],
      equipment: s.equipment.map((e) =>
        e.id === log.equipmentId
          ? { ...e, status: "OK", lastMaintenance: log.date, hoursUsed: 0 }
          : e
      ),
    })),
}));

export const computeTaskCost = (task: Task, products: Product[], equipment: Equipment[], users: User[]) => {
  const labor = task.laborCost ?? task.assignedAgents.reduce((sum, agentId) => {
    const agent = users.find((u) => u.id === agentId);
    return sum + task.duration * (agent?.hourlyRate ?? 35);
  }, 0);
  const supplies = task.productsUsed.reduce((sum, u) => {
    const p = products.find((x) => x.id === u.productId);
    return sum + (p ? p.pricePerUnit * u.quantity : 0);
  }, 0);
  const equip = task.equipmentIds.reduce((sum, id) => {
    const e = equipment.find((x) => x.id === id);
    return sum + (e ? e.hourlyCost * task.duration : 0);
  }, 0);
  return { labor, supplies, equip, total: labor + supplies + equip };
};
