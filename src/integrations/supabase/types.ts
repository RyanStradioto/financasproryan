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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      accounts: {
        Row: {
          archived: boolean
          color: string
          created_at: string
          icon: string
          id: string
          initial_balance: number
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          archived?: boolean
          color?: string
          created_at?: string
          icon?: string
          id?: string
          initial_balance?: number
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          archived?: boolean
          color?: string
          created_at?: string
          icon?: string
          id?: string
          initial_balance?: number
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      categories: {
        Row: {
          archived: boolean
          color: string
          created_at: string
          icon: string
          id: string
          monthly_budget: number
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          archived?: boolean
          color?: string
          created_at?: string
          icon?: string
          id?: string
          monthly_budget?: number
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          archived?: boolean
          color?: string
          created_at?: string
          icon?: string
          id?: string
          monthly_budget?: number
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      category_account_budgets: {
        Row: {
          account_id: string
          category_id: string
          created_at: string
          id: string
          monthly_budget: number
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id: string
          category_id: string
          created_at?: string
          id?: string
          monthly_budget?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          account_id?: string
          category_id?: string
          created_at?: string
          id?: string
          monthly_budget?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "category_account_budgets_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "category_account_budgets_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_card_transactions: {
        Row: {
          amount: number
          bill_month: string
          category_id: string | null
          created_at: string
          credit_card_id: string
          date: string
          description: string
          id: string
          installment_group_id: string | null
          installment_number: number | null
          is_installment: boolean
          is_recurring: boolean
          notes: string | null
          paid: boolean
          total_installments: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          bill_month: string
          category_id?: string | null
          created_at?: string
          credit_card_id: string
          date?: string
          description?: string
          id?: string
          installment_group_id?: string | null
          installment_number?: number | null
          is_installment?: boolean
          is_recurring?: boolean
          notes?: string | null
          paid?: boolean
          total_installments?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          bill_month?: string
          category_id?: string | null
          created_at?: string
          credit_card_id?: string
          date?: string
          description?: string
          id?: string
          installment_group_id?: string | null
          installment_number?: number | null
          is_installment?: boolean
          is_recurring?: boolean
          notes?: string | null
          paid?: boolean
          total_installments?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_card_transactions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_card_transactions_credit_card_id_fkey"
            columns: ["credit_card_id"]
            isOneToOne: false
            referencedRelation: "credit_cards"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_cards: {
        Row: {
          archived: boolean
          closing_day: number
          color: string
          created_at: string
          credit_limit: number
          due_day: number
          icon: string
          id: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          archived?: boolean
          closing_day?: number
          color?: string
          created_at?: string
          credit_limit?: number
          due_day?: number
          icon?: string
          id?: string
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          archived?: boolean
          closing_day?: number
          color?: string
          created_at?: string
          credit_limit?: number
          due_day?: number
          icon?: string
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      expenses: {
        Row: {
          account_id: string | null
          amount: number
          attachment_name: string | null
          attachment_url: string | null
          category_id: string | null
          created_at: string
          date: string
          deleted_at: string | null
          description: string
          id: string
          is_recurring: boolean
          notes: string | null
          recurring_day: number | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id?: string | null
          amount: number
          attachment_name?: string | null
          attachment_url?: string | null
          category_id?: string | null
          created_at?: string
          date?: string
          deleted_at?: string | null
          description?: string
          id?: string
          is_recurring?: boolean
          notes?: string | null
          recurring_day?: number | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          account_id?: string | null
          amount?: number
          attachment_name?: string | null
          attachment_url?: string | null
          category_id?: string | null
          created_at?: string
          date?: string
          deleted_at?: string | null
          description?: string
          id?: string
          is_recurring?: boolean
          notes?: string | null
          recurring_day?: number | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "expenses_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      recent_deletions: {
        Row: {
          deleted_at: string
          id: string
          payload: Json
          record_id: string
          table_name: string
          user_id: string
        }
        Insert: {
          deleted_at?: string
          id?: string
          payload: Json
          record_id: string
          table_name: string
          user_id: string
        }
        Update: {
          deleted_at?: string
          id?: string
          payload?: Json
          record_id?: string
          table_name?: string
          user_id?: string
        }
        Relationships: []
      }
      income: {
        Row: {
          account_id: string | null
          amount: number
          attachment_name: string | null
          attachment_url: string | null
          created_at: string
          date: string
          deleted_at: string | null
          description: string
          id: string
          notes: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id?: string | null
          amount: number
          attachment_name?: string | null
          attachment_url?: string | null
          created_at?: string
          date?: string
          deleted_at?: string | null
          description?: string
          id?: string
          notes?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          account_id?: string | null
          amount?: number
          attachment_name?: string | null
          attachment_url?: string | null
          created_at?: string
          date?: string
          deleted_at?: string | null
          description?: string
          id?: string
          notes?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "income_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      investment_transactions: {
        Row: {
          account_id: string | null
          amount: number
          created_at: string
          date: string
          description: string
          id: string
          investment_id: string
          notes: string | null
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id?: string | null
          amount: number
          created_at?: string
          date?: string
          description?: string
          id?: string
          investment_id: string
          notes?: string | null
          type?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          account_id?: string | null
          amount?: number
          created_at?: string
          date?: string
          description?: string
          id?: string
          investment_id?: string
          notes?: string | null
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "investment_transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investment_transactions_investment_id_fkey"
            columns: ["investment_id"]
            isOneToOne: false
            referencedRelation: "investments"
            referencedColumns: ["id"]
          },
        ]
      }
      investments: {
        Row: {
          annual_rate: number | null
          archived: boolean
          color: string
          created_at: string
          current_value: number
          icon: string
          id: string
          institution: string
          liquidity: string | null
          name: string
          photo_url: string | null
          total_invested: number
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          annual_rate?: number | null
          archived?: boolean
          color?: string
          created_at?: string
          current_value?: number
          icon?: string
          id?: string
          institution?: string
          liquidity?: string | null
          name: string
          photo_url?: string | null
          total_invested?: number
          type?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          annual_rate?: number | null
          archived?: boolean
          color?: string
          created_at?: string
          current_value?: number
          icon?: string
          id?: string
          institution?: string
          liquidity?: string | null
          name?: string
          photo_url?: string | null
          total_invested?: number
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      planning_fixed_costs: {
        Row: {
          account_id: string | null
          active: boolean
          amount: number
          category_id: string | null
          created_at: string
          day: number
          description: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id?: string | null
          active?: boolean
          amount?: number
          category_id?: string | null
          created_at?: string
          day?: number
          description: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          account_id?: string | null
          active?: boolean
          amount?: number
          category_id?: string | null
          created_at?: string
          day?: number
          description?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      planning_salary_configs: {
        Row: {
          account_id: string | null
          created_at: string
          description: string
          first_split_pct: number
          gross_override: number
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id?: string | null
          created_at?: string
          description?: string
          first_split_pct?: number
          gross_override?: number
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          account_id?: string | null
          created_at?: string
          description?: string
          first_split_pct?: number
          gross_override?: number
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          first_name: string | null
          id: string
          monthly_salary: number
          monthly_summary_enabled: boolean
          updated_at: string
          user_id: string
          weekly_summary_enabled: boolean
          work_days_per_week: number
          work_hours_per_day: number
        }
        Insert: {
          created_at?: string
          first_name?: string | null
          id?: string
          monthly_salary?: number
          monthly_summary_enabled?: boolean
          updated_at?: string
          user_id: string
          weekly_summary_enabled?: boolean
          work_days_per_week?: number
          work_hours_per_day?: number
        }
        Update: {
          created_at?: string
          first_name?: string | null
          id?: string
          monthly_salary?: number
          monthly_summary_enabled?: boolean
          updated_at?: string
          user_id?: string
          weekly_summary_enabled?: boolean
          work_days_per_week?: number
          work_hours_per_day?: number
        }
        Relationships: []
      }
      transaction_classifications: {
        Row: {
          category_id: string | null
          confidence: number
          created_at: string
          id: string
          investment_id: string | null
          keyword: string
          type: string
          user_id: string
        }
        Insert: {
          category_id?: string | null
          confidence?: number
          created_at?: string
          id?: string
          investment_id?: string | null
          keyword: string
          type: string
          user_id: string
        }
        Update: {
          category_id?: string | null
          confidence?: number
          created_at?: string
          id?: string
          investment_id?: string | null
          keyword?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transaction_classifications_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transaction_classifications_investment_id_fkey"
            columns: ["investment_id"]
            isOneToOne: false
            referencedRelation: "investments"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
