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
      employee_badges: {
        Row: {
          awarded_at: string
          badge_code: string
          employee_id: string
          id: string
          meta: Json
        }
        Insert: {
          awarded_at?: string
          badge_code: string
          employee_id: string
          id?: string
          meta?: Json
        }
        Update: {
          awarded_at?: string
          badge_code?: string
          employee_id?: string
          id?: string
          meta?: Json
        }
        Relationships: [
          {
            foreignKeyName: "employee_badges_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_scores: {
        Row: {
          actual_seconds: number
          category_id: string | null
          employee_id: string
          finish_log_id: string
          id: string
          job_id: string
          points: number
          scored_at: string
          start_log_id: string | null
          step_id: string
          target_seconds: number
          tier: string
        }
        Insert: {
          actual_seconds: number
          category_id?: string | null
          employee_id: string
          finish_log_id: string
          id?: string
          job_id: string
          points: number
          scored_at?: string
          start_log_id?: string | null
          step_id: string
          target_seconds: number
          tier: string
        }
        Update: {
          actual_seconds?: number
          category_id?: string | null
          employee_id?: string
          finish_log_id?: string
          id?: string
          job_id?: string
          points?: number
          scored_at?: string
          start_log_id?: string | null
          step_id?: string
          target_seconds?: number
          tier?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_scores_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_scores_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_scores_finish_log_id_fkey"
            columns: ["finish_log_id"]
            isOneToOne: false
            referencedRelation: "production_logs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_scores_start_log_id_fkey"
            columns: ["start_log_id"]
            isOneToOne: false
            referencedRelation: "production_logs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_scores_step_id_fkey"
            columns: ["step_id"]
            isOneToOne: false
            referencedRelation: "steps"
            referencedColumns: ["id"]
          },
        ]
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
      expense_categories: {
        Row: {
          active: boolean
          created_at: string
          id: string
          keywords: string[]
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          keywords?: string[]
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          keywords?: string[]
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      expense_status_history: {
        Row: {
          changed_by: string | null
          created_at: string
          expense_id: string
          from_status: string | null
          id: string
          note: string | null
          to_status: string
        }
        Insert: {
          changed_by?: string | null
          created_at?: string
          expense_id: string
          from_status?: string | null
          id?: string
          note?: string | null
          to_status: string
        }
        Update: {
          changed_by?: string | null
          created_at?: string
          expense_id?: string
          from_status?: string | null
          id?: string
          note?: string | null
          to_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "expense_status_history_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "expenses"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          ai_confidence: number | null
          ai_extracted: Json | null
          approved_at: string | null
          approver_employee_id: string | null
          approver_name: string | null
          bill_type: string
          buyer_match_wsc: boolean
          category_id: string | null
          created_at: string
          duplicate_of: string | null
          exp_no: string
          id: string
          image_paths: string[]
          linked_office_request_id: string | null
          merchant_name: string | null
          note: string | null
          paid_at: string | null
          paid_by: string | null
          receipt_date: string | null
          receipt_no: string | null
          reject_reason: string | null
          requester_employee_id: string | null
          requester_name: string
          status: string
          subtotal: number
          tax_id: string | null
          total_amount: number
          updated_at: string
          vat_amount: number
        }
        Insert: {
          ai_confidence?: number | null
          ai_extracted?: Json | null
          approved_at?: string | null
          approver_employee_id?: string | null
          approver_name?: string | null
          bill_type?: string
          buyer_match_wsc?: boolean
          category_id?: string | null
          created_at?: string
          duplicate_of?: string | null
          exp_no?: string
          id?: string
          image_paths?: string[]
          linked_office_request_id?: string | null
          merchant_name?: string | null
          note?: string | null
          paid_at?: string | null
          paid_by?: string | null
          receipt_date?: string | null
          receipt_no?: string | null
          reject_reason?: string | null
          requester_employee_id?: string | null
          requester_name: string
          status?: string
          subtotal?: number
          tax_id?: string | null
          total_amount?: number
          updated_at?: string
          vat_amount?: number
        }
        Update: {
          ai_confidence?: number | null
          ai_extracted?: Json | null
          approved_at?: string | null
          approver_employee_id?: string | null
          approver_name?: string | null
          bill_type?: string
          buyer_match_wsc?: boolean
          category_id?: string | null
          created_at?: string
          duplicate_of?: string | null
          exp_no?: string
          id?: string
          image_paths?: string[]
          linked_office_request_id?: string | null
          merchant_name?: string | null
          note?: string | null
          paid_at?: string | null
          paid_by?: string | null
          receipt_date?: string | null
          receipt_no?: string | null
          reject_reason?: string | null
          requester_employee_id?: string | null
          requester_name?: string
          status?: string
          subtotal?: number
          tax_id?: string | null
          total_amount?: number
          updated_at?: string
          vat_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "expenses_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "expense_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_duplicate_of_fkey"
            columns: ["duplicate_of"]
            isOneToOne: false
            referencedRelation: "expenses"
            referencedColumns: ["id"]
          },
        ]
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
      inventory_items: {
        Row: {
          active: boolean
          category: string | null
          created_at: string
          id: string
          image_url: string | null
          item_code: string
          item_name: string
          location: string | null
          max_stock_level: number
          min_safety_stock: number
          note: string | null
          total_qty: number
          unit: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          category?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          item_code: string
          item_name: string
          location?: string | null
          max_stock_level?: number
          min_safety_stock?: number
          note?: string | null
          total_qty?: number
          unit?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          category?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          item_code?: string
          item_name?: string
          location?: string | null
          max_stock_level?: number
          min_safety_stock?: number
          note?: string | null
          total_qty?: number
          unit?: string
          updated_at?: string
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
      office_asset_categories: {
        Row: {
          active: boolean
          created_at: string
          default_useful_life_months: number
          id: string
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          default_useful_life_months?: number
          id?: string
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          default_useful_life_months?: number
          id?: string
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      office_assets: {
        Row: {
          active: boolean
          assignee: string | null
          brand: string | null
          category_id: string | null
          code: string
          created_at: string
          id: string
          image_url: string | null
          location: string | null
          min_qty: number
          model: string | null
          name: string
          note: string | null
          purchase_date: string | null
          purchase_price: number | null
          salvage_value: number
          serial_no: string | null
          status: string
          stock_qty: number
          unit: string
          updated_at: string
          useful_life_months: number | null
          vendor: string | null
          warranty_until: string | null
        }
        Insert: {
          active?: boolean
          assignee?: string | null
          brand?: string | null
          category_id?: string | null
          code?: string
          created_at?: string
          id?: string
          image_url?: string | null
          location?: string | null
          min_qty?: number
          model?: string | null
          name: string
          note?: string | null
          purchase_date?: string | null
          purchase_price?: number | null
          salvage_value?: number
          serial_no?: string | null
          status?: string
          stock_qty?: number
          unit?: string
          updated_at?: string
          useful_life_months?: number | null
          vendor?: string | null
          warranty_until?: string | null
        }
        Update: {
          active?: boolean
          assignee?: string | null
          brand?: string | null
          category_id?: string | null
          code?: string
          created_at?: string
          id?: string
          image_url?: string | null
          location?: string | null
          min_qty?: number
          model?: string | null
          name?: string
          note?: string | null
          purchase_date?: string | null
          purchase_price?: number | null
          salvage_value?: number
          serial_no?: string | null
          status?: string
          stock_qty?: number
          unit?: string
          updated_at?: string
          useful_life_months?: number | null
          vendor?: string | null
          warranty_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "office_assets_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "office_asset_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      office_employees: {
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
      office_request_items: {
        Row: {
          asset_id: string
          asset_name_snapshot: string
          created_at: string
          id: string
          qty: number
          request_id: string
          unit_price_snapshot: number
        }
        Insert: {
          asset_id: string
          asset_name_snapshot: string
          created_at?: string
          id?: string
          qty: number
          request_id: string
          unit_price_snapshot?: number
        }
        Update: {
          asset_id?: string
          asset_name_snapshot?: string
          created_at?: string
          id?: string
          qty?: number
          request_id?: string
          unit_price_snapshot?: number
        }
        Relationships: [
          {
            foreignKeyName: "office_request_items_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "office_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      office_requests: {
        Row: {
          approved_at: string | null
          approver_employee_id: string | null
          approver_name: string | null
          created_at: string
          id: string
          note: string | null
          reject_reason: string | null
          req_no: string
          requester_employee_id: string | null
          requester_name: string
          status: string
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approver_employee_id?: string | null
          approver_name?: string | null
          created_at?: string
          id?: string
          note?: string | null
          reject_reason?: string | null
          req_no?: string
          requester_employee_id?: string | null
          requester_name: string
          status?: string
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approver_employee_id?: string | null
          approver_name?: string | null
          created_at?: string
          id?: string
          note?: string | null
          reject_reason?: string | null
          req_no?: string
          requester_employee_id?: string | null
          requester_name?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      office_stock_movements: {
        Row: {
          asset_id: string
          created_at: string
          delta: number
          id: string
          note: string | null
          reason: string
          request_id: string | null
          unit_price_snapshot: number
        }
        Insert: {
          asset_id: string
          created_at?: string
          delta: number
          id?: string
          note?: string | null
          reason: string
          request_id?: string | null
          unit_price_snapshot?: number
        }
        Update: {
          asset_id?: string
          created_at?: string
          delta?: number
          id?: string
          note?: string | null
          reason?: string
          request_id?: string | null
          unit_price_snapshot?: number
        }
        Relationships: []
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
      policies: {
        Row: {
          content: string
          created_at: string
          id: string
          key: string
          title: string
          updated_at: string
          updated_by: string | null
          version: number
        }
        Insert: {
          content?: string
          created_at?: string
          id?: string
          key: string
          title: string
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          key?: string
          title?: string
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Relationships: []
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
      production_standards: {
        Row: {
          active: boolean
          bonus_points: number
          category_id: string | null
          created_at: string
          fast_seconds: number | null
          id: string
          late_points: number
          on_time_points: number
          red_threshold: number | null
          step_id: string
          target_seconds: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          bonus_points?: number
          category_id?: string | null
          created_at?: string
          fast_seconds?: number | null
          id?: string
          late_points?: number
          on_time_points?: number
          red_threshold?: number | null
          step_id: string
          target_seconds: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          bonus_points?: number
          category_id?: string | null
          created_at?: string
          fast_seconds?: number | null
          id?: string
          late_points?: number
          on_time_points?: number
          red_threshold?: number | null
          step_id?: string
          target_seconds?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "production_standards_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_standards_step_id_fkey"
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
      stock_count_batches: {
        Row: {
          batch_no: number
          counted_by_emp_code: string
          counted_by_emp_id: string | null
          counted_by_name: string
          created_at: string
          id: string
          note: string
          status: string
          submitted_at: string | null
          updated_at: string
        }
        Insert: {
          batch_no?: number
          counted_by_emp_code?: string
          counted_by_emp_id?: string | null
          counted_by_name?: string
          created_at?: string
          id?: string
          note?: string
          status?: string
          submitted_at?: string | null
          updated_at?: string
        }
        Update: {
          batch_no?: number
          counted_by_emp_code?: string
          counted_by_emp_id?: string | null
          counted_by_name?: string
          created_at?: string
          id?: string
          note?: string
          status?: string
          submitted_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_count_batches_counted_by_emp_id_fkey"
            columns: ["counted_by_emp_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_counts: {
        Row: {
          batch_id: string
          counted_by_emp_id: string | null
          counted_by_name: string
          counted_qty: number
          created_at: string
          id: string
          item_code: string
          item_id: string | null
          item_name: string
          note: string
          status: string
          system_qty: number
          unit: string
          variance: number
        }
        Insert: {
          batch_id: string
          counted_by_emp_id?: string | null
          counted_by_name?: string
          counted_qty?: number
          created_at?: string
          id?: string
          item_code: string
          item_id?: string | null
          item_name: string
          note?: string
          status: string
          system_qty?: number
          unit?: string
          variance?: number
        }
        Update: {
          batch_id?: string
          counted_by_emp_id?: string | null
          counted_by_name?: string
          counted_qty?: number
          created_at?: string
          id?: string
          item_code?: string
          item_id?: string | null
          item_name?: string
          note?: string
          status?: string
          system_qty?: number
          unit?: string
          variance?: number
        }
        Relationships: [
          {
            foreignKeyName: "stock_counts_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "stock_count_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_counts_counted_by_emp_id_fkey"
            columns: ["counted_by_emp_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_counts_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
        ]
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
