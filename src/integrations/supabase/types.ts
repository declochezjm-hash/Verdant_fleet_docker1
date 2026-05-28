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
  public: {
    Tables: {
      anomalies: {
        Row: {
          created_at: string
          description: string
          equipment_id: string | null
          id: string
          reported_by: string | null
          resolved: boolean
          task_id: string | null
        }
        Insert: {
          created_at?: string
          description?: string
          equipment_id?: string | null
          id?: string
          reported_by?: string | null
          resolved?: boolean
          task_id?: string | null
        }
        Update: {
          created_at?: string
          description?: string
          equipment_id?: string | null
          id?: string
          reported_by?: string | null
          resolved?: boolean
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
      equipment: {
        Row: {
          assigned_to: string | null
          created_at: string
          hourly_cost: number
          hours_for_maintenance: number
          hours_used: number
          id: string
          last_maintenance: string | null
          name: string
          status: Database["public"]["Enums"]["equipment_status"]
          type: string
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string
          hourly_cost?: number
          hours_for_maintenance?: number
          hours_used?: number
          id?: string
          last_maintenance?: string | null
          name: string
          status?: Database["public"]["Enums"]["equipment_status"]
          type: string
        }
        Update: {
          assigned_to?: string | null
          created_at?: string
          hourly_cost?: number
          hours_for_maintenance?: number
          hours_used?: number
          id?: string
          last_maintenance?: string | null
          name?: string
          status?: Database["public"]["Enums"]["equipment_status"]
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
      products: {
        Row: {
          category: Database["public"]["Enums"]["product_category"]
          created_at: string
          id: string
          name: string
          price_per_unit: number
          stock: number
          threshold: number
          unit: Database["public"]["Enums"]["product_unit"]
        }
        Insert: {
          category: Database["public"]["Enums"]["product_category"]
          created_at?: string
          id?: string
          name: string
          price_per_unit?: number
          stock?: number
          threshold?: number
          unit: Database["public"]["Enums"]["product_unit"]
        }
        Update: {
          category?: Database["public"]["Enums"]["product_category"]
          created_at?: string
          id?: string
          name?: string
          price_per_unit?: number
          stock?: number
          threshold?: number
          unit?: Database["public"]["Enums"]["product_unit"]
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          id: string
          name: string
          team: string | null
          hourly_rate: number
        }
        Insert: {
          created_at?: string
          id: string
          name?: string
          team?: string | null
          hourly_rate?: number
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          team?: string | null
          hourly_rate?: number
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
          created_at: string
          id: string
          product_id: string
          quantity: number
          task_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          quantity?: number
          task_id: string
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          quantity?: number
          task_id?: string
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
          address: string
          budget: number
          client: string
          created_at: string
          duration: number
          finished_at: string | null
          id: string
          labor_cost: number | null
          lat: number | null
          lng: number | null
          notes: string | null
          photo_after_url: string | null
          photo_before_url: string | null
          scheduled_at: string
          signature_url: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["task_status"]
          team: string
          title: string
        }
        Insert: {
          address?: string
          budget?: number
          client?: string
          created_at?: string
          duration?: number
          finished_at?: string | null
          id?: string
          labor_cost?: number | null
          lat?: number | null
          lng?: number | null
          notes?: string | null
          photo_after_url?: string | null
          photo_before_url?: string | null
          scheduled_at: string
          signature_url?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          team?: string
          title: string
        }
        Update: {
          address?: string
          budget?: number
          client?: string
          created_at?: string
          duration?: number
          finished_at?: string | null
          id?: string
          labor_cost?: number | null
          lat?: number | null
          lng?: number | null
          notes?: string | null
          photo_after_url?: string | null
          photo_before_url?: string | null
          scheduled_at?: string
          signature_url?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          team?: string
          title?: string
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
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_assigned: { Args: { _task: string; _user: string }; Returns: boolean }
    }
    Enums: {
      app_role: "agent" | "coordinator" | "admin"
      equipment_status: "OK" | "Maintenance requise" | "En panne"
      product_category: "Engrais" | "Phyto" | "Semences"
      product_unit: "L" | "Kg" | "Sac"
      task_status: "planifie" | "en_cours" | "termine"
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
  public: {
    Enums: {
      app_role: ["agent", "coordinator", "admin"],
      equipment_status: ["OK", "Maintenance requise", "En panne"],
      product_category: ["Engrais", "Phyto", "Semences"],
      product_unit: ["L", "Kg", "Sac"],
      task_status: ["planifie", "en_cours", "termine"],
    },
  },
} as const
