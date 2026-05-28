import { createFileRoute } from "@tanstack/react-router";
import { StocksView } from "@/components/views/stocks-view";
export const Route = createFileRoute("/stocks")({ component: StocksView });
