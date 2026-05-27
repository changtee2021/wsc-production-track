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
      announcements: {
        Row: {
          active: boolean
          created_at: string
          id: string
          message: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          message: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          message?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          value?: Json
        }
        Update: {
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      assets: {
        Row: {
          active: boolean
          brand: string | null
          category: string
          code: string | null
          created_at: string
          id: string
          image_url: string | null
          location: string | null
          model: string | null
          name: string
          note: string | null
          purchase_date: string | null
          purchase_price: number | null
          serial_no: string | null
          updated_at: string
          vendor: string | null
          warranty_until: string | null
        }
        Insert: {
          active?: boolean
          brand?: string | null
          category?: string
          code?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          location?: string | null
          model?: string | null
          name: string
          note?: string | null
          purchase_date?: string | null
          purchase_price?: number | null
          serial_no?: string | null
          updated_at?: string
          vendor?: string | null
          warranty_until?: string | null
        }
        Update: {
          active?: boolean
          brand?: string | null
          category?: string
          code?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          location?: string | null
          model?: string | null
          name?: string
          note?: string | null
          purchase_date?: string | null
          purchase_price?: number | null
          serial_no?: string | null
          updated_at?: string
          vendor?: string | null
          warranty_until?: string | null
        }
        Relationships: []
      }
      categories: {
        Row: {
          active: boolean
          created_at: string
          id: string
          name: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      employees: {
        Row: {
          active: boolean
          avatar_url: string | null
          created_at: string
          emp_code: string | null
          id: string
          name: string
          nationality: string | null
        }
        Insert: {
          active?: boolean
          avatar_url?: string | null
          created_at?: string
          emp_code?: string | null
          id?: string
          name: string
          nationality?: string | null
        }
        Update: {
          active?: boolean
          avatar_url?: string | null
          created_at?: string
          emp_code?: string | null
          id?: string
          name?: string
          nationality?: string | null
        }
        Relationships: []
      }
      home_banners: {
        Row: {
          active: boolean
          created_at: string
          id: string
          image_path: string
          sort_order: number
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          image_path: string
          sort_order?: number
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          image_path?: string
          sort_order?: number
        }
        Relationships: []
      }
      maintenance_employees: {
        Row: {
          active: boolean
          avatar_url: string | null
          created_at: string
          emp_code: string | null
          id: string
          name: string
        }
        Insert: {
          active?: boolean
          avatar_url?: string | null
          created_at?: string
          emp_code?: string | null
          id?: string
          name: string
        }
        Update: {
          active?: boolean
          avatar_url?: string | null
          created_at?: string
          emp_code?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      maintenance_parts_used: {
        Row: {
          created_at: string
          id: string
          note: string | null
          qty: number
          spare_part_id: string
          ticket_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          note?: string | null
          qty: number
          spare_part_id: string
          ticket_id: string
        }
        Update: {
          created_at?: string
          id?: string
          note?: string | null
          qty?: number
          spare_part_id?: string
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_parts_used_spare_part_id_fkey"
            columns: ["spare_part_id"]
            isOneToOne: false
            referencedRelation: "spare_parts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_parts_used_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "maintenance_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_tickets: {
        Row: {
          asset_id: string | null
          assignee_name: string | null
          created_at: string
          done_at: string | null
          fix_media: Json
          fix_method: string | null
          id: string
          priority: string
          problem_media: Json
          problem_text: string
          reported_at: string
          reporter_name: string
          started_at: string | null
          status: string
          summary: string | null
          ticket_no: string
          updated_at: string
        }
        Insert: {
          asset_id?: string | null
          assignee_name?: string | null
          created_at?: string
          done_at?: string | null
          fix_media?: Json
          fix_method?: string | null
          id?: string
          priority?: string
          problem_media?: Json
          problem_text: string
          reported_at?: string
          reporter_name: string
          started_at?: string | null
          status?: string
          summary?: string | null
          ticket_no?: string
          updated_at?: string
        }
        Update: {
          asset_id?: string | null
          assignee_name?: string | null
          created_at?: string
          done_at?: string | null
          fix_media?: Json
          fix_method?: string | null
          id?: string
          priority?: string
          problem_media?: Json
          problem_text?: string
          reported_at?: string
          reporter_name?: string
          started_at?: string | null
          status?: string
          summary?: string | null
          ticket_no?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_tickets_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
        ]
      }
      packing_checklists: {
        Row: {
          category_id: string
          created_at: string
          id: string
          is_active: boolean
          item_order: number
          item_text: string
          updated_at: string
        }
        Insert: {
          category_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          item_order?: number
          item_text: string
          updated_at?: string
        }
        Update: {
          category_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          item_order?: number
          item_text?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "packing_checklists_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      packing_employees: {
        Row: {
          active: boolean
          avatar_url: string | null
          created_at: string
          emp_code: string | null
          id: string
          name: string
        }
        Insert: {
          active?: boolean
          avatar_url?: string | null
          created_at?: string
          emp_code?: string | null
          id?: string
          name: string
        }
        Update: {
          active?: boolean
          avatar_url?: string | null
          created_at?: string
          emp_code?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      packing_report_items: {
        Row: {
          checklist_id: string | null
          created_at: string
          id: string
          is_passed: boolean
          item_order: number
          item_text_snapshot: string
          media: Json
          packing_report_id: string
          remark: string | null
          result_tag: string | null
        }
        Insert: {
          checklist_id?: string | null
          created_at?: string
          id?: string
          is_passed: boolean
          item_order?: number
          item_text_snapshot: string
          media?: Json
          packing_report_id: string
          remark?: string | null
          result_tag?: string | null
        }
        Update: {
          checklist_id?: string | null
          created_at?: string
          id?: string
          is_passed?: boolean
          item_order?: number
          item_text_snapshot?: string
          media?: Json
          packing_report_id?: string
          remark?: string | null
          result_tag?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "packing_report_items_checklist_id_fkey"
            columns: ["checklist_id"]
            isOneToOne: false
            referencedRelation: "packing_checklists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "packing_report_items_packing_report_id_fkey"
            columns: ["packing_report_id"]
            isOneToOne: false
            referencedRelation: "packing_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      packing_reports: {
        Row: {
          category_id: string | null
          created_at: string
          employee_id: string | null
          id: string
          job_id: string
          media: Json
          note: string | null
          overall_result: string | null
          packing_employee_id: string | null
          production_log_id: string | null
          status: string
          step_id: string | null
          summary: string | null
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          employee_id?: string | null
          id?: string
          job_id: string
          media?: Json
          note?: string | null
          overall_result?: string | null
          packing_employee_id?: string | null
          production_log_id?: string | null
          status?: string
          step_id?: string | null
          summary?: string | null
        }
        Update: {
          category_id?: string | null
          created_at?: string
          employee_id?: string | null
          id?: string
          job_id?: string
          media?: Json
          note?: string | null
          overall_result?: string | null
          packing_employee_id?: string | null
          production_log_id?: string | null
          status?: string
          step_id?: string | null
          summary?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "packing_reports_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "packing_reports_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "packing_reports_packing_employee_id_fkey"
            columns: ["packing_employee_id"]
            isOneToOne: false
            referencedRelation: "packing_employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "packing_reports_production_log_id_fkey"
            columns: ["production_log_id"]
            isOneToOne: false
            referencedRelation: "production_logs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "packing_reports_step_id_fkey"
            columns: ["step_id"]
            isOneToOne: false
            referencedRelation: "steps"
            referencedColumns: ["id"]
          },
        ]
      }
      production_logs: {
        Row: {
          action: string
          category_id: string | null
          created_at: string
          employee_id: string | null
          id: string
          job_id: string
          note: string | null
          note_image_url: string | null
          step_id: string
        }
        Insert: {
          action: string
          category_id?: string | null
          created_at?: string
          employee_id?: string | null
          id?: string
          job_id: string
          note?: string | null
          note_image_url?: string | null
          step_id: string
        }
        Update: {
          action?: string
          category_id?: string | null
          created_at?: string
          employee_id?: string | null
          id?: string
          job_id?: string
          note?: string | null
          note_image_url?: string | null
          step_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "production_logs_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_logs_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_logs_step_id_fkey"
            columns: ["step_id"]
            isOneToOne: false
            referencedRelation: "steps"
            referencedColumns: ["id"]
          },
        ]
      }
      qc_checklists: {
        Row: {
          category_id: string
          created_at: string
          id: string
          is_active: boolean
          item_order: number
          item_text: string
          updated_at: string
        }
        Insert: {
          category_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          item_order?: number
          item_text: string
          updated_at?: string
        }
        Update: {
          category_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          item_order?: number
          item_text?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "qc_checklists_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      qc_employees: {
        Row: {
          active: boolean
          avatar_url: string | null
          created_at: string
          emp_code: string | null
          id: string
          name: string
        }
        Insert: {
          active?: boolean
          avatar_url?: string | null
          created_at?: string
          emp_code?: string | null
          id?: string
          name: string
        }
        Update: {
          active?: boolean
          avatar_url?: string | null
          created_at?: string
          emp_code?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      qc_report_items: {
        Row: {
          checklist_id: string | null
          created_at: string
          id: string
          is_passed: boolean
          item_order: number
          item_text_snapshot: string
          media: Json
          qc_report_id: string
          remark: string | null
          result_tag: string | null
        }
        Insert: {
          checklist_id?: string | null
          created_at?: string
          id?: string
          is_passed: boolean
          item_order?: number
          item_text_snapshot: string
          media?: Json
          qc_report_id: string
          remark?: string | null
          result_tag?: string | null
        }
        Update: {
          checklist_id?: string | null
          created_at?: string
          id?: string
          is_passed?: boolean
          item_order?: number
          item_text_snapshot?: string
          media?: Json
          qc_report_id?: string
          remark?: string | null
          result_tag?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "qc_report_items_checklist_id_fkey"
            columns: ["checklist_id"]
            isOneToOne: false
            referencedRelation: "qc_checklists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qc_report_items_qc_report_id_fkey"
            columns: ["qc_report_id"]
            isOneToOne: false
            referencedRelation: "qc_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      qc_reports: {
        Row: {
          category_id: string | null
          created_at: string
          employee_id: string | null
          id: string
          job_id: string
          media: Json
          note: string | null
          overall_result: string | null
          production_log_id: string | null
          qc_employee_id: string | null
          status: string
          step_id: string | null
          summary: string | null
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          employee_id?: string | null
          id?: string
          job_id: string
          media?: Json
          note?: string | null
          overall_result?: string | null
          production_log_id?: string | null
          qc_employee_id?: string | null
          status?: string
          step_id?: string | null
          summary?: string | null
        }
        Update: {
          category_id?: string | null
          created_at?: string
          employee_id?: string | null
          id?: string
          job_id?: string
          media?: Json
          note?: string | null
          overall_result?: string | null
          production_log_id?: string | null
          qc_employee_id?: string | null
          status?: string
          step_id?: string | null
          summary?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "qc_reports_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qc_reports_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qc_reports_qc_employee_id_fkey"
            columns: ["qc_employee_id"]
            isOneToOne: false
            referencedRelation: "qc_employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qc_reports_step_id_fkey"
            columns: ["step_id"]
            isOneToOne: false
            referencedRelation: "steps"
            referencedColumns: ["id"]
          },
        ]
      }
      spare_part_movements: {
        Row: {
          created_at: string
          delta: number
          id: string
          note: string | null
          reason: string
          spare_part_id: string
          ticket_id: string | null
        }
        Insert: {
          created_at?: string
          delta: number
          id?: string
          note?: string | null
          reason: string
          spare_part_id: string
          ticket_id?: string | null
        }
        Update: {
          created_at?: string
          delta?: number
          id?: string
          note?: string | null
          reason?: string
          spare_part_id?: string
          ticket_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "spare_part_movements_spare_part_id_fkey"
            columns: ["spare_part_id"]
            isOneToOne: false
            referencedRelation: "spare_parts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "spare_part_movements_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "maintenance_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      spare_parts: {
        Row: {
          active: boolean
          code: string | null
          created_at: string
          id: string
          image_url: string | null
          location_bin: string | null
          min_qty: number
          name: string
          note: string | null
          stock_qty: number
          unit: string
          unit_cost: number | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          code?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          location_bin?: string | null
          min_qty?: number
          name: string
          note?: string | null
          stock_qty?: number
          unit?: string
          unit_cost?: number | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          code?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          location_bin?: string | null
          min_qty?: number
          name?: string
          note?: string | null
          stock_qty?: number
          unit?: string
          unit_cost?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      steps: {
        Row: {
          active: boolean
          created_at: string
          description: string | null
          icon: string | null
          id: string
          image_url: string | null
          std_duration_minutes: number | null
          step_name: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          image_url?: string | null
          std_duration_minutes?: number | null
          step_name: string
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          image_url?: string | null
          std_duration_minutes?: number | null
          step_name?: string
        }
        Relationships: []
      }
      system_logs: {
        Row: {
          category: string
          created_at: string
          id: string
          paths: string[]
          summary: string
          title: string
          version: string | null
        }
        Insert: {
          category: string
          created_at?: string
          id?: string
          paths?: string[]
          summary: string
          title: string
          version?: string | null
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          paths?: string[]
          summary?: string
          title?: string
          version?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_db_usage_stats: { Args: never; Returns: Json }
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
