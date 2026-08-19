import * as React from "react";

export type VerduraEntityType = "task" | "equipment" | "product";

/** Contexte page actif — alimente useVerduraChat (Sprint 3+). */
export interface VerduraPageContextValue {
  type?: VerduraEntityType;
  id?: string;
  label?: string;
  taskId?: string;
  projectNumber?: string;
  equipmentId?: string;
  internalId?: string;
  productId?: string;
  ammNumber?: string;
}

interface VerduraPageContextState {
  value: VerduraPageContextValue | null;
  setPageContext: (value: VerduraPageContextValue | null) => void;
}

const VerduraPageContext = React.createContext<VerduraPageContextState | undefined>(
  undefined,
);

export function buildTaskPageContext(task: {
  id: string;
  project_number?: string | null;
  title: string;
}): VerduraPageContextValue {
  const label = task.project_number || task.title;
  return {
    type: "task",
    id: task.id,
    label,
    taskId: task.id,
    projectNumber: task.project_number ?? undefined,
  };
}

export function buildEquipmentPageContext(equipment: {
  id: string;
  internal_id?: string | null;
  name: string;
}): VerduraPageContextValue {
  const label = equipment.internal_id || equipment.name;
  return {
    type: "equipment",
    id: equipment.id,
    label,
    equipmentId: equipment.id,
    internalId: equipment.internal_id ?? undefined,
  };
}

export function buildProductPageContext(product: {
  id: string;
  amm_number?: string | null;
  name: string;
}): VerduraPageContextValue {
  const label = product.amm_number || product.name;
  return {
    type: "product",
    id: product.id,
    label,
    productId: product.id,
    ammNumber: product.amm_number ?? undefined,
  };
}

export function VerduraPageContextProvider({ children }: { children: React.ReactNode }) {
  const [value, setPageContext] = React.useState<VerduraPageContextValue | null>(null);

  const ctx = React.useMemo(
    () => ({ value, setPageContext }),
    [value],
  );

  return (
    <VerduraPageContext.Provider value={ctx}>{children}</VerduraPageContext.Provider>
  );
}

export function useVerduraPageContext() {
  const ctx = React.useContext(VerduraPageContext);
  if (!ctx) {
    throw new Error("useVerduraPageContext must be used within VerduraPageContextProvider");
  }
  return ctx.value;
}

/** Variante tolérante — retourne null hors provider (ex. hook chat). */
export function useOptionalVerduraPageContext(): VerduraPageContextValue | null {
  const ctx = React.useContext(VerduraPageContext);
  return ctx?.value ?? null;
}

export function useVerduraPageContextSetter() {
  const ctx = React.useContext(VerduraPageContext);
  if (!ctx) {
    throw new Error("useVerduraPageContextSetter must be used within VerduraPageContextProvider");
  }
  return ctx;
}
