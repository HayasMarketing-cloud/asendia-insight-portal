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
      accounts: {
        Row: {
          created_at: string
          id: string
          name: string
          slug: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          slug: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          slug?: string
        }
        Relationships: []
      }
      leads: {
        Row: {
          account_id: string
          asendia_icp_segment: string | null
          asendia_region: string | null
          buyer_intent_signals: string | null
          company_name: string
          countries_with_revenue: number | null
          domain: string | null
          gmv: number | null
          gmv_growth_yoy_pct: number | null
          growth_momentum: string | null
          high_intent_override: boolean | null
          hubspot_company_id: string
          hubspot_updated_at: string | null
          id: string
          international_maturity: string | null
          intl_revenue_share: number | null
          missing_ecdb: boolean | null
          orders_annual: number | null
          review_reason: string | null
          score_breakdown: string | null
          score_confidence: string
          score_last_calculated_at: string | null
          score_total: number | null
          sequence_engagement: Json | null
          status: string
          sugarcrm_url: string | null
          synced_at: string
        }
        Insert: {
          account_id: string
          asendia_icp_segment?: string | null
          asendia_region?: string | null
          buyer_intent_signals?: string | null
          company_name: string
          countries_with_revenue?: number | null
          domain?: string | null
          gmv?: number | null
          gmv_growth_yoy_pct?: number | null
          growth_momentum?: string | null
          high_intent_override?: boolean | null
          hubspot_company_id: string
          hubspot_updated_at?: string | null
          id?: string
          international_maturity?: string | null
          intl_revenue_share?: number | null
          missing_ecdb?: boolean | null
          orders_annual?: number | null
          review_reason?: string | null
          score_breakdown?: string | null
          score_confidence?: string
          score_last_calculated_at?: string | null
          score_total?: number | null
          sequence_engagement?: Json | null
          status: string
          sugarcrm_url?: string | null
          synced_at?: string
        }
        Update: {
          account_id?: string
          asendia_icp_segment?: string | null
          asendia_region?: string | null
          buyer_intent_signals?: string | null
          company_name?: string
          countries_with_revenue?: number | null
          domain?: string | null
          gmv?: number | null
          gmv_growth_yoy_pct?: number | null
          growth_momentum?: string | null
          high_intent_override?: boolean | null
          hubspot_company_id?: string
          hubspot_updated_at?: string | null
          id?: string
          international_maturity?: string | null
          intl_revenue_share?: number | null
          missing_ecdb?: boolean | null
          orders_annual?: number | null
          review_reason?: string | null
          score_breakdown?: string | null
          score_confidence?: string
          score_last_calculated_at?: string | null
          score_total?: number | null
          sequence_engagement?: Json | null
          status?: string
          sugarcrm_url?: string | null
          synced_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leads_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      ops_log: {
        Row: {
          account_id: string
          api_status: Json | null
          credits_consumed: Json | null
          discard_count: number | null
          duration_seconds: number | null
          ecdb_coverage_pct: number | null
          ecdb_credit_balance: number | null
          errors: Json | null
          event_type: string
          gated_count: number | null
          id: string
          leads_processed: number | null
          mql_count: number | null
          run_at: string
          run_status: string
          sql_count: number | null
          workflow_name: string
          write_errors: number | null
        }
        Insert: {
          account_id: string
          api_status?: Json | null
          credits_consumed?: Json | null
          discard_count?: number | null
          duration_seconds?: number | null
          ecdb_coverage_pct?: number | null
          ecdb_credit_balance?: number | null
          errors?: Json | null
          event_type: string
          gated_count?: number | null
          id?: string
          leads_processed?: number | null
          mql_count?: number | null
          run_at?: string
          run_status?: string
          sql_count?: number | null
          workflow_name: string
          write_errors?: number | null
        }
        Update: {
          account_id?: string
          api_status?: Json | null
          credits_consumed?: Json | null
          discard_count?: number | null
          duration_seconds?: number | null
          ecdb_coverage_pct?: number | null
          ecdb_credit_balance?: number | null
          errors?: Json | null
          event_type?: string
          gated_count?: number | null
          id?: string
          leads_processed?: number | null
          mql_count?: number | null
          run_at?: string
          run_status?: string
          sql_count?: number | null
          workflow_name?: string
          write_errors?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ops_log_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          account_id: string | null
          created_at: string
          email: string
          full_name: string | null
          id: string
          role: string
        }
        Insert: {
          account_id?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          role?: string
        }
        Update: {
          account_id?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      sla_events: {
        Row: {
          accepted_at: string | null
          account_id: string
          created_at: string
          id: string
          lead_id: string
          routing_type: string | null
          sla_applies: boolean
          sql_marked_at: string
        }
        Insert: {
          accepted_at?: string | null
          account_id: string
          created_at?: string
          id?: string
          lead_id: string
          routing_type?: string | null
          sla_applies?: boolean
          sql_marked_at: string
        }
        Update: {
          accepted_at?: string | null
          account_id?: string
          created_at?: string
          id?: string
          lead_id?: string
          routing_type?: string | null
          sla_applies?: boolean
          sql_marked_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sla_events_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sla_events_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      kpi_summary: {
        Row: {
          account_id: string | null
          coverage_rate_pct: number | null
          discard_count: number | null
          high_intent_count: number | null
          manual_count: number | null
          mql_count: number | null
          sql_count: number | null
          total_leads: number | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      sla_status: {
        Row: {
          accepted_at: string | null
          account_id: string | null
          company_name: string | null
          lead_id: string | null
          routing_type: string | null
          sla_state: string | null
          sql_marked_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sla_events_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sla_events_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      current_account_id: { Args: never; Returns: string }
      is_hayas_admin: { Args: never; Returns: boolean }
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
