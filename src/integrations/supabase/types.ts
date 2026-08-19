export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      anomalies: {
        Row: {
          created_at: string | null
          description: string | null
          equipment_id: string | null
          id: string
          repair_notes: string | null
          reported_by: string | null
          resolved: boolean | null
          task_id: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          equipment_id?: string | null
          id?: string
          repair_notes?: string | null
          reported_by?: string | null
          resolved?: boolean | null
          task_id?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          equipment_id?: string | null
          id?: string
          repair_notes?: string | null
          reported_by?: string | null
          resolved?: boolean | null
          task_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "anomalies_equipment_id_fkey"
            columns: ["equipment_id"]
            isOneToOne: false
            referencedRelation: "equipment"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "anomalies_equipment_id_fkey"
            columns: ["equipment_id"]
            isOneToOne: false
            referencedRelation: "v_equipment_alerts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "anomalies_reported_by_fkey"
            columns: ["reported_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "anomalies_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      eco_wallets: {
        Row: {
          co2_saved_kg: number
          eco_tokens: number
          total_trips: number
          updated_at: string
          user_id: string
        }
        Insert: {
          co2_saved_kg?: number
          eco_tokens?: number
          total_trips?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          co2_saved_kg?: number
          eco_tokens?: number
          total_trips?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      equipment: {
        Row: {
          assigned_to: string | null
          created_at: string | null
          hourly_cost: number | null
          hours_for_maintenance: number | null
          hours_used: number | null
          id: string
          internal_id: string | null
          is_archived: boolean | null
          last_maintenance: string | null
          motorization_type: string | null
          name: string
          status: Database["public"]["Enums"]["equipment_status"] | null
          team: string | null
          type: string
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string | null
          hourly_cost?: number | null
          hours_for_maintenance?: number | null
          hours_used?: number | null
          id?: string
          internal_id?: string | null
          is_archived?: boolean | null
          last_maintenance?: string | null
          motorization_type?: string | null
          name: string
          status?: Database["public"]["Enums"]["equipment_status"] | null
          team?: string | null
          type: string
        }
        Update: {
          assigned_to?: string | null
          created_at?: string | null
          hourly_cost?: number | null
          hours_for_maintenance?: number | null
          hours_used?: number | null
          id?: string
          internal_id?: string | null
          is_archived?: boolean | null
          last_maintenance?: string | null
          motorization_type?: string | null
          name?: string
          status?: Database["public"]["Enums"]["equipment_status"] | null
          team?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "equipment_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount: number
          created_at: string | null
          due_date: string | null
          file_url: string | null
          id: string
          invoice_number: string
          order_id: string | null
          status: string | null
        }
        Insert: {
          amount: number
          created_at?: string | null
          due_date?: string | null
          file_url?: string | null
          id?: string
          invoice_number: string
          order_id?: string | null
          status?: string | null
        }
        Update: {
          amount?: number
          created_at?: string | null
          due_date?: string | null
          file_url?: string | null
          id?: string
          invoice_number?: string
          order_id?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      jarvis_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          metadata: Json | null
          role: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          metadata?: Json | null
          role: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          role?: string
          user_id?: string
        }
        Relationships: []
      }
      maintenance_logs: {
        Row: {
          cost: number | null
          date: string | null
          description: string | null
          equipment_id: string | null
          id: string
          type: string
        }
        Insert: {
          cost?: number | null
          date?: string | null
          description?: string | null
          equipment_id?: string | null
          id?: string
          type: string
        }
        Update: {
          cost?: number | null
          date?: string | null
          description?: string | null
          equipment_id?: string | null
          id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_logs_equipment_id_fkey"
            columns: ["equipment_id"]
            isOneToOne: false
            referencedRelation: "equipment"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_logs_equipment_id_fkey"
            columns: ["equipment_id"]
            isOneToOne: false
            referencedRelation: "v_equipment_alerts"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          amm_number: string | null
          category: Database["public"]["Enums"]["product_category"]
          created_at: string | null
          id: string
          name: string
          price_per_unit: number | null
          stock: number | null
          threshold: number | null
          unit: Database["public"]["Enums"]["product_unit"]
        }
        Insert: {
          amm_number?: string | null
          category: Database["public"]["Enums"]["product_category"]
          created_at?: string | null
          id?: string
          name: string
          price_per_unit?: number | null
          stock?: number | null
          threshold?: number | null
          unit: Database["public"]["Enums"]["product_unit"]
        }
        Update: {
          amm_number?: string | null
          category?: Database["public"]["Enums"]["product_category"]
          created_at?: string | null
          id?: string
          name?: string
          price_per_unit?: number | null
          stock?: number | null
          threshold?: number | null
          unit?: Database["public"]["Enums"]["product_unit"]
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          email: string | null
          hourly_rate: number | null
          id: string
          is_active: boolean | null
          is_blocked: boolean | null
          last_login_at: string | null
          name: string
          team: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string | null
          hourly_rate?: number | null
          id?: string
          is_active?: boolean | null
          is_blocked?: boolean | null
          last_login_at?: string | null
          name: string
          team?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string | null
          hourly_rate?: number | null
          id?: string
          is_active?: boolean | null
          is_blocked?: boolean | null
          last_login_at?: string | null
          name?: string
          team?: string | null
        }
        Relationships: []
      }
      purchase_order_items: {
        Row: {
          id: string
          order_id: string | null
          product_id: string | null
          quantity: number
          unit_price: number
        }
        Insert: {
          id?: string
          order_id?: string | null
          product_id?: string | null
          quantity: number
          unit_price: number
        }
        Update: {
          id?: string
          order_id?: string | null
          product_id?: string | null
          quantity?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "purchase_order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_orders: {
        Row: {
          created_at: string | null
          expected_delivery: string | null
          id: string
          status: string | null
          supplier_id: string | null
          total_amount: number | null
        }
        Insert: {
          created_at?: string | null
          expected_delivery?: string | null
          id?: string
          status?: string | null
          supplier_id?: string | null
          total_amount?: number | null
        }
        Update: {
          created_at?: string | null
          expected_delivery?: string | null
          id?: string
          status?: string | null
          supplier_id?: string | null
          total_amount?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_orders_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          contact_info: string | null
          created_at: string | null
          id: string
          name: string
        }
        Insert: {
          contact_info?: string | null
          created_at?: string | null
          id?: string
          name: string
        }
        Update: {
          contact_info?: string | null
          created_at?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      task_assignments: {
        Row: {
          task_id: string
          user_id: string
        }
        Insert: {
          task_id: string
          user_id: string
        }
        Update: {
          task_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_assignments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_assignments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      task_equipment: {
        Row: {
          equipment_id: string
          task_id: string
        }
        Insert: {
          equipment_id: string
          task_id: string
        }
        Update: {
          equipment_id?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_equipment_equipment_id_fkey"
            columns: ["equipment_id"]
            isOneToOne: false
            referencedRelation: "equipment"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_equipment_equipment_id_fkey"
            columns: ["equipment_id"]
            isOneToOne: false
            referencedRelation: "v_equipment_alerts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_equipment_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_products: {
        Row: {
          created_at: string | null
          dose_per_m2: number | null
          id: string
          lot_number: string | null
          product_id: string | null
          quantity: number
          task_id: string | null
        }
        Insert: {
          created_at?: string | null
          dose_per_m2?: number | null
          id?: string
          lot_number?: string | null
          product_id?: string | null
          quantity: number
          task_id?: string | null
        }
        Update: {
          created_at?: string | null
          dose_per_m2?: number | null
          id?: string
          lot_number?: string | null
          product_id?: string | null
          quantity?: number
          task_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "task_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_products_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          actual_weather: string | null
          address: string
          budget: number | null
          client: string
          created_at: string | null
          duration: number
          finished_at: string | null
          id: string
          labor_cost: number | null
          lat: number | null
          lng: number | null
          notes: string | null
          photo_after_url: string | null
          photo_before_url: string | null
          priority: string | null
          project_number: string | null
          requires_dry_weather: boolean | null
          scheduled_at: string
          signature_url: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["task_status"] | null
          team: string
          title: string
          weather_alert_status: string | null
        }
        Insert: {
          actual_weather?: string | null
          address: string
          budget?: number | null
          client: string
          created_at?: string | null
          duration: number
          finished_at?: string | null
          id?: string
          labor_cost?: number | null
          lat?: number | null
          lng?: number | null
          notes?: string | null
          photo_after_url?: string | null
          photo_before_url?: string | null
          priority?: string | null
          project_number?: string | null
          requires_dry_weather?: boolean | null
          scheduled_at: string
          signature_url?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["task_status"] | null
          team: string
          title: string
          weather_alert_status?: string | null
        }
        Update: {
          actual_weather?: string | null
          address?: string
          budget?: number | null
          client?: string
          created_at?: string | null
          duration?: number
          finished_at?: string | null
          id?: string
          labor_cost?: number | null
          lat?: number | null
          lng?: number | null
          notes?: string | null
          photo_after_url?: string | null
          photo_before_url?: string | null
          priority?: string | null
          project_number?: string | null
          requires_dry_weather?: boolean | null
          scheduled_at?: string
          signature_url?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["task_status"] | null
          team?: string
          title?: string
          weather_alert_status?: string | null
        }
        Relationships: []
      }
      teams: {
        Row: {
          color: string | null
          created_at: string | null
          id: string
          is_archived: boolean | null
          margin_pct: number | null
          name: string
          overhead_equip_pct: number | null
          overhead_labor_pct: number | null
          overhead_mat_pct: number | null
          tax_pct: number | null
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          id?: string
          is_archived?: boolean | null
          margin_pct?: number | null
          name: string
          overhead_equip_pct?: number | null
          overhead_labor_pct?: number | null
          overhead_mat_pct?: number | null
          tax_pct?: number | null
        }
        Update: {
          color?: string | null
          created_at?: string | null
          id?: string
          is_archived?: boolean | null
          margin_pct?: number | null
          name?: string
          overhead_equip_pct?: number | null
          overhead_labor_pct?: number | null
          overhead_mat_pct?: number | null
          tax_pct?: number | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      villes_fleuries_evaluations: {
        Row: {
          commune_name: string
          conclusions: string | null
          created_at: string
          evaluated_level: string | null
          evaluation_criteria: Json
          id: string
          jury_decision: string | null
          recommendations: string | null
          visit_date: string
        }
        Insert: {
          commune_name: string
          conclusions?: string | null
          created_at?: string
          evaluated_level?: string | null
          evaluation_criteria?: Json
          id?: string
          jury_decision?: string | null
          recommendations?: string | null
          visit_date: string
        }
        Update: {
          commune_name?: string
          conclusions?: string | null
          created_at?: string
          evaluated_level?: string | null
          evaluation_criteria?: Json
          id?: string
          jury_decision?: string | null
          recommendations?: string | null
          visit_date?: string
        }
        Relationships: []
      }
    }
    Views: {
      v_equipment_alerts: {
        Row: {
          id: string | null
          name: string | null
        }
        Insert: {
          id?: string | null
          name?: string | null
        }
        Update: {
          id?: string | null
          name?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      seed_demo_data: { Args: never; Returns: undefined }
    }
    Enums: {
      app_role: "agent" | "coordinator" | "admin"
      equipment_status: "OK" | "Maintenance requise" | "En panne"
      product_category: "Engrais" | "Phyto" | "Semences"
      product_unit: "L" | "Kg" | "Sac"
      task_priority: "normale" | "haute" | "urgente"
      task_status: "planifie" | "en_cours" | "termine" | "annule"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      app_role: ["agent", "coordinator", "admin"],
      equipment_status: ["OK", "Maintenance requise", "En panne"],
      product_category: ["Engrais", "Phyto", "Semences"],
      product_unit: ["L", "Kg", "Sac"],
      task_priority: ["normale", "haute", "urgente"],
      task_status: ["planifie", "en_cours", "termine", "annule"],
    },
  },
} as const
