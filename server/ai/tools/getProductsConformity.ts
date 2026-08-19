import { z } from "zod";
import type { AiSessionContext } from "../../db/readOnlyClient";
import { createReadOnlyClient } from "../../db/readOnlyClient";
import { assertNoDbError } from "./dbHelpers";

export const getProductsConformitySchema = z.object({
  ammNumber: z.string().optional(),
  searchQuery: z.string().optional(),
  onlyControlled: z.boolean().optional(),
});

export type GetProductsConformityInput = z.infer<typeof getProductsConformitySchema>;

const EPI_PHYTO_DEFAULT = [
  "Gants chimiques certifiés",
  "Lunettes étanches",
  "Masque anti-poussière / vapeurs (selon produit)",
  "Blouse ou combinaison jetable",
  "Bottes imperméables",
] as const;

export interface ProductConformityItem {
  id: string;
  name: string;
  ammNumber: string | null;
  category: "Engrais" | "Phyto" | "Semences";
  stock: number;
  threshold: number;
  isBelowThreshold: boolean;
  unit: string;
  epiRequired: string[] | null;
  usageConditions: string | null;
}

export interface GetProductsConformityOutput {
  badge: "Conformité Phyto";
  total: number;
  controlledCount: number;
  belowThresholdCount: number;
  items: ProductConformityItem[];
}

export async function getProductsConformity(
  ctx: AiSessionContext,
  rawInput: unknown,
): Promise<GetProductsConformityOutput> {
  const input = getProductsConformitySchema.parse(rawInput);
  const client = createReadOnlyClient(ctx);

  let query = client
    .from("products")
    .select("id, name, amm_number, category, stock, threshold, unit")
    .order("category")
    .order("name")
    .limit(100);

  if (input.onlyControlled) query = query.eq("category", "Phyto");
  if (input.ammNumber) query = query.eq("amm_number", input.ammNumber);
  if (input.searchQuery) {
    const term = input.searchQuery.trim();
    query = query.or(`name.ilike.%${term}%,amm_number.ilike.%${term}%`);
  }

  const { data, error } = await query;
  assertNoDbError(error, "liste produits");

  const items: ProductConformityItem[] = (data ?? []).map((row) => {
    const stock = row.stock ?? 0;
    const threshold = row.threshold ?? 0;
    const isPhyto = row.category === "Phyto";

    return {
      id: row.id,
      name: row.name,
      ammNumber: row.amm_number,
      category: row.category,
      stock,
      threshold,
      isBelowThreshold: stock <= threshold,
      unit: row.unit,
      epiRequired: isPhyto ? [...EPI_PHYTO_DEFAULT] : null,
      usageConditions: isPhyto
        ? "Respecter la dose homologuée (task_products.dose_per_m2) et le registre phytosanitaire (lot_number obligatoire à la clôture)."
        : null,
    };
  });

  return {
    badge: "Conformité Phyto",
    total: items.length,
    controlledCount: items.filter((i) => i.category === "Phyto").length,
    belowThresholdCount: items.filter((i) => i.isBelowThreshold).length,
    items,
  };
}
