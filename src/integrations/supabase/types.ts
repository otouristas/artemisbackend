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
      bookings: {
        Row: {
          booking_source: string | null
          check_in: string
          check_out: string
          client_id: string | null
          comments: string | null
          created_at: string
          customer_email: string | null
          customer_name: string
          customer_phone: string | null
          delivery_location: string | null
          deposit_amount: number | null
          id: string
          id_document: string | null
          payment_notes: string | null
          plate: string | null
          status: Database["public"]["Enums"]["booking_status"]
          total_price: number | null
          updated_at: string
          vehicle_id: string
        }
        Insert: {
          booking_source?: string | null
          check_in: string
          check_out: string
          client_id?: string | null
          comments?: string | null
          created_at?: string
          customer_email?: string | null
          customer_name: string
          customer_phone?: string | null
          delivery_location?: string | null
          deposit_amount?: number | null
          id?: string
          id_document?: string | null
          payment_notes?: string | null
          plate?: string | null
          status?: Database["public"]["Enums"]["booking_status"]
          total_price?: number | null
          updated_at?: string
          vehicle_id: string
        }
        Update: {
          booking_source?: string | null
          check_in?: string
          check_out?: string
          client_id?: string | null
          comments?: string | null
          created_at?: string
          customer_email?: string | null
          customer_name?: string
          customer_phone?: string | null
          delivery_location?: string | null
          deposit_amount?: number | null
          id?: string
          id_document?: string | null
          payment_notes?: string | null
          plate?: string | null
          status?: Database["public"]["Enums"]["booking_status"]
          total_price?: number | null
          updated_at?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookings_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          created_at: string
          email: string | null
          id: string
          id_document: string | null
          name: string
          notes: string | null
          phone: string | null
          preferred_language: string | null
          preferred_vehicle_id: string | null
          tags: string[] | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          id_document?: string | null
          name: string
          notes?: string | null
          phone?: string | null
          preferred_language?: string | null
          preferred_vehicle_id?: string | null
          tags?: string[] | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          id_document?: string | null
          name?: string
          notes?: string | null
          phone?: string | null
          preferred_language?: string | null
          preferred_vehicle_id?: string | null
          tags?: string[] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clients_preferred_vehicle_id_fkey"
            columns: ["preferred_vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicle_checklists: {
        Row: {
          booking_id: string
          created_at: string
          damage_notes: string | null
          fuel_level: number | null
          id: string
          mileage: number | null
          photo_urls: string[] | null
          type: Database["public"]["Enums"]["checklist_type"]
        }
        Insert: {
          booking_id: string
          created_at?: string
          damage_notes?: string | null
          fuel_level?: number | null
          id?: string
          mileage?: number | null
          photo_urls?: string[] | null
          type: Database["public"]["Enums"]["checklist_type"]
        }
        Update: {
          booking_id?: string
          created_at?: string
          damage_notes?: string | null
          fuel_level?: number | null
          id?: string
          mileage?: number | null
          photo_urls?: string[] | null
          type?: Database["public"]["Enums"]["checklist_type"]
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_checklists_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicle_blocks: {
        Row: {
          created_at: string
          end_date: string
          id: string
          reason: string | null
          start_date: string
          vehicle_id: string
        }
        Insert: {
          created_at?: string
          end_date: string
          id?: string
          reason?: string | null
          start_date: string
          vehicle_id: string
        }
        Update: {
          created_at?: string
          end_date?: string
          id?: string
          reason?: string | null
          start_date?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_blocks_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicles: {
        Row: {
          active: boolean
          cc: number
          created_at: string
          daily_rate_high: number
          daily_rate_low: number
          id: string
          image_url: string | null
          name: string
          notes: string | null
          plate: string | null
          plates: string[] | null
          type: Database["public"]["Enums"]["vehicle_type"]
          quantity: number
        }
        Insert: {
          active?: boolean
          cc: number
          created_at?: string
          daily_rate_high: number
          daily_rate_low: number
          id?: string
          image_url?: string | null
          name: string
          notes?: string | null
          plate?: string | null
          plates?: string[] | null
          type: Database["public"]["Enums"]["vehicle_type"]
          quantity?: number
        }
        Update: {
          active?: boolean
          cc?: number
          created_at?: string
          daily_rate_high?: number
          daily_rate_low?: number
          id?: string
          image_url?: string | null
          name?: string
          notes?: string | null
          plate?: string | null
          type?: Database["public"]["Enums"]["vehicle_type"]
          quantity?: number
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      booking_status: "pending" | "confirmed" | "cancelled"
      checklist_type: "check_in" | "check_out"
      vehicle_type: "car" | "scooter"
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
      booking_status: ["pending", "confirmed", "cancelled"],
      checklist_type: ["check_in", "check_out"],
      vehicle_type: ["car", "scooter"],
    },
  },
} as const
