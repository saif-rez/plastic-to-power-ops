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
      activity_log: {
        Row: {
          created_at: string
          id: string
          kind: string
          message: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind?: string
          message: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          message?: string
        }
        Relationships: []
      }
      attendance: {
        Row: {
          clock_in: string
          clock_out: string | null
          created_at: string
          employee_id: string
          hours: number | null
          id: string
          work_date: string
        }
        Insert: {
          clock_in: string
          clock_out?: string | null
          created_at?: string
          employee_id: string
          hours?: number | null
          id?: string
          work_date?: string
        }
        Update: {
          clock_in?: string
          clock_out?: string | null
          created_at?: string
          employee_id?: string
          hours?: number | null
          id?: string
          work_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          address: string
          city: string
          company: string
          contact_name: string
          created_at: string
          email: string
          id: string
          notes: string
          phone: string
        }
        Insert: {
          address?: string
          city?: string
          company: string
          contact_name?: string
          created_at?: string
          email?: string
          id?: string
          notes?: string
          phone?: string
        }
        Update: {
          address?: string
          city?: string
          company?: string
          contact_name?: string
          created_at?: string
          email?: string
          id?: string
          notes?: string
          phone?: string
        }
        Relationships: []
      }
      employees: {
        Row: {
          created_at: string
          department: string
          email: string
          first_name: string
          hire_date: string
          id: string
          last_name: string
          phone: string
          position: string
          status: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          department?: string
          email?: string
          first_name: string
          hire_date?: string
          id?: string
          last_name: string
          phone?: string
          position?: string
          status?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          department?: string
          email?: string
          first_name?: string
          hire_date?: string
          id?: string
          last_name?: string
          phone?: string
          position?: string
          status?: string
          user_id?: string | null
        }
        Relationships: []
      }
      energy_records: {
        Row: {
          cost: number | null
          created_at: string
          energy_type: string
          id: string
          machine: string
          quantity: number
          record_date: string
          unit: string
          unit_cost: number
        }
        Insert: {
          cost?: number | null
          created_at?: string
          energy_type?: string
          id?: string
          machine?: string
          quantity?: number
          record_date?: string
          unit?: string
          unit_cost?: number
        }
        Update: {
          cost?: number | null
          created_at?: string
          energy_type?: string
          id?: string
          machine?: string
          quantity?: number
          record_date?: string
          unit?: string
          unit_cost?: number
        }
        Relationships: []
      }
      invoice_items: {
        Row: {
          description: string
          id: string
          invoice_id: string
          product_id: string | null
          quantity: number
          unit_price: number
        }
        Insert: {
          description: string
          id?: string
          invoice_id: string
          product_id?: string | null
          quantity?: number
          unit_price?: number
        }
        Update: {
          description?: string
          id?: string
          invoice_id?: string
          product_id?: string | null
          quantity?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          client_id: string
          created_at: string
          due_date: string
          id: string
          invoice_number: string
          issue_date: string
          status: string
          total: number
        }
        Insert: {
          client_id: string
          created_at?: string
          due_date?: string
          id?: string
          invoice_number: string
          issue_date?: string
          status?: string
          total?: number
        }
        Update: {
          client_id?: string
          created_at?: string
          due_date?: string
          id?: string
          invoice_number?: string
          issue_date?: string
          status?: string
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoices_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          category: string
          created_at: string
          description: string
          id: string
          min_stock: number
          name: string
          price: number
          quantity: number
          status: string
          unit: string
        }
        Insert: {
          category?: string
          created_at?: string
          description?: string
          id?: string
          min_stock?: number
          name: string
          price?: number
          quantity?: number
          status?: string
          unit?: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string
          id?: string
          min_stock?: number
          name?: string
          price?: number
          quantity?: number
          status?: string
          unit?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          full_name: string
          id: string
        }
        Insert: {
          created_at?: string
          email?: string
          full_name?: string
          id: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string
          id?: string
        }
        Relationships: []
      }
      stock_movements: {
        Row: {
          created_at: string
          id: string
          movement_type: string
          note: string
          product_id: string
          quantity: number
        }
        Insert: {
          created_at?: string
          id?: string
          movement_type: string
          note?: string
          product_id: string
          quantity: number
        }
        Update: {
          created_at?: string
          id?: string
          movement_type?: string
          note?: string
          product_id?: string
          quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_orders: {
        Row: {
          amount: number
          description: string
          id: string
          order_date: string
          order_number: string
          status: string
          supplier_id: string
        }
        Insert: {
          amount?: number
          description?: string
          id?: string
          order_date?: string
          order_number: string
          status?: string
          supplier_id: string
        }
        Update: {
          amount?: number
          description?: string
          id?: string
          order_date?: string
          order_number?: string
          status?: string
          supplier_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_orders_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_products: {
        Row: {
          id: string
          product_name: string
          supplier_id: string
          unit: string
          unit_price: number
        }
        Insert: {
          id?: string
          product_name: string
          supplier_id: string
          unit?: string
          unit_price?: number
        }
        Update: {
          id?: string
          product_name?: string
          supplier_id?: string
          unit?: string
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "supplier_products_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          address: string
          category: string
          city: string
          contact_name: string
          created_at: string
          email: string
          id: string
          name: string
          phone: string
        }
        Insert: {
          address?: string
          category?: string
          city?: string
          contact_name?: string
          created_at?: string
          email?: string
          id?: string
          name: string
          phone?: string
        }
        Update: {
          address?: string
          category?: string
          city?: string
          contact_name?: string
          created_at?: string
          email?: string
          id?: string
          name?: string
          phone?: string
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
      is_admin: { Args: never; Returns: boolean }
      my_employee_id: { Args: never; Returns: string }
    }
    Enums: {
      app_role: "admin" | "employee"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: ["admin", "employee"],
    },
  },
} as const
