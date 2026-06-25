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
      app_security: {
        Row: {
          pin_enabled: boolean
          pin_hash: string | null
          pin_plain: string | null
          pin_salt: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          pin_enabled?: boolean
          pin_hash?: string | null
          pin_plain?: string | null
          pin_salt?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          pin_enabled?: boolean
          pin_hash?: string | null
          pin_plain?: string | null
          pin_salt?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      attendance: {
        Row: {
          class_id: string
          created_at: string
          date: string
          id: string
          notes: string | null
          status: string
          student_id: string
        }
        Insert: {
          class_id: string
          created_at?: string
          date: string
          id?: string
          notes?: string | null
          status: string
          student_id: string
        }
        Update: {
          class_id?: string
          created_at?: string
          date?: string
          id?: string
          notes?: string | null
          status?: string
          student_id?: string
        }
        Relationships: []
      }
      behavior_points: {
        Row: {
          category: string
          class_id: string
          created_at: string
          date: string
          id: string
          note: string | null
          points: number
          student_id: string
        }
        Insert: {
          category?: string
          class_id: string
          created_at?: string
          date?: string
          id?: string
          note?: string | null
          points?: number
          student_id: string
        }
        Update: {
          category?: string
          class_id?: string
          created_at?: string
          date?: string
          id?: string
          note?: string | null
          points?: number
          student_id?: string
        }
        Relationships: []
      }
      bulletin_resources: {
        Row: {
          bulletin_id: string
          created_at: string
          id: string
          owner_id: string
          resource_id: string
        }
        Insert: {
          bulletin_id: string
          created_at?: string
          id?: string
          owner_id: string
          resource_id: string
        }
        Update: {
          bulletin_id?: string
          created_at?: string
          id?: string
          owner_id?: string
          resource_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bulletin_resources_bulletin_id_fkey"
            columns: ["bulletin_id"]
            isOneToOne: false
            referencedRelation: "weekly_bulletins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bulletin_resources_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "teaching_resources"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          active: boolean
          class_id: string
          created_at: string
          description: string
          end_date: string
          id: string
          name: string
          prize: string
          start_date: string
          target_points: number
        }
        Insert: {
          active?: boolean
          class_id: string
          created_at?: string
          description?: string
          end_date?: string
          id?: string
          name: string
          prize?: string
          start_date?: string
          target_points?: number
        }
        Update: {
          active?: boolean
          class_id?: string
          created_at?: string
          description?: string
          end_date?: string
          id?: string
          name?: string
          prize?: string
          start_date?: string
          target_points?: number
        }
        Relationships: []
      }
      class_resource_usage: {
        Row: {
          class_id: string
          id: string
          notes: string
          resource_id: string
          used_at: string
        }
        Insert: {
          class_id: string
          id?: string
          notes?: string
          resource_id: string
          used_at?: string
        }
        Update: {
          class_id?: string
          id?: string
          notes?: string
          resource_id?: string
          used_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_resource_usage_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "teaching_resources"
            referencedColumns: ["id"]
          },
        ]
      }
      classes: {
        Row: {
          created_at: string
          grid_cols: number
          grid_rows: number
          hidden_seats: Json
          id: string
          name: string
          owner_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          grid_cols?: number
          grid_rows?: number
          hidden_seats?: Json
          id?: string
          name: string
          owner_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          grid_cols?: number
          grid_rows?: number
          hidden_seats?: Json
          id?: string
          name?: string
          owner_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      discipline_events: {
        Row: {
          category: string
          class_id: string
          created_at: string
          date: string
          description: string
          id: string
          parents_notified: boolean
          severity: number
          student_id: string
          type: string
        }
        Insert: {
          category?: string
          class_id: string
          created_at?: string
          date?: string
          description?: string
          id?: string
          parents_notified?: boolean
          severity?: number
          student_id: string
          type?: string
        }
        Update: {
          category?: string
          class_id?: string
          created_at?: string
          date?: string
          description?: string
          id?: string
          parents_notified?: boolean
          severity?: number
          student_id?: string
          type?: string
        }
        Relationships: []
      }
      grades: {
        Row: {
          class_id: string
          created_at: string
          date: string
          id: string
          max_value: number
          notes: string | null
          student_id: string
          subject: string
          value: number
        }
        Insert: {
          class_id: string
          created_at?: string
          date?: string
          id?: string
          max_value?: number
          notes?: string | null
          student_id: string
          subject?: string
          value: number
        }
        Update: {
          class_id?: string
          created_at?: string
          date?: string
          id?: string
          max_value?: number
          notes?: string | null
          student_id?: string
          subject?: string
          value?: number
        }
        Relationships: []
      }
      groups: {
        Row: {
          class_id: string
          color: string
          created_at: string
          id: string
          name: string
        }
        Insert: {
          class_id: string
          color?: string
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          class_id?: string
          color?: string
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      lesson_transcripts: {
        Row: {
          audio_path: string | null
          class_id: string
          created_at: string
          duration_seconds: number | null
          embedding: string | null
          error: string | null
          id: string
          key_points: Json
          owner_id: string
          status: string
          summary: string
          title: string
          transcript: string
          updated_at: string
        }
        Insert: {
          audio_path?: string | null
          class_id: string
          created_at?: string
          duration_seconds?: number | null
          embedding?: string | null
          error?: string | null
          id?: string
          key_points?: Json
          owner_id: string
          status?: string
          summary?: string
          title?: string
          transcript?: string
          updated_at?: string
        }
        Update: {
          audio_path?: string | null
          class_id?: string
          created_at?: string
          duration_seconds?: number | null
          embedding?: string | null
          error?: string | null
          id?: string
          key_points?: Json
          owner_id?: string
          status?: string
          summary?: string
          title?: string
          transcript?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_transcripts_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
        ]
      }
      parent_communications: {
        Row: {
          channel: string
          class_id: string
          created_at: string
          date: string
          document_id: string | null
          follow_up_date: string | null
          id: string
          student_id: string
          subject: string
          summary: string
        }
        Insert: {
          channel?: string
          class_id: string
          created_at?: string
          date?: string
          document_id?: string | null
          follow_up_date?: string | null
          id?: string
          student_id: string
          subject?: string
          summary?: string
        }
        Update: {
          channel?: string
          class_id?: string
          created_at?: string
          date?: string
          document_id?: string | null
          follow_up_date?: string | null
          id?: string
          student_id?: string
          subject?: string
          summary?: string
        }
        Relationships: []
      }
      parent_share_tokens: {
        Row: {
          class_id: string
          created_at: string
          id: string
          label: string
          revoked: boolean
          student_id: string | null
          token: string
        }
        Insert: {
          class_id: string
          created_at?: string
          id?: string
          label?: string
          revoked?: boolean
          student_id?: string | null
          token: string
        }
        Update: {
          class_id?: string
          created_at?: string
          id?: string
          label?: string
          revoked?: boolean
          student_id?: string | null
          token?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
        }
        Relationships: []
      }
      reminders: {
        Row: {
          class_id: string
          completed: boolean
          created_at: string
          description: string | null
          due_date: string | null
          id: string
          student_id: string
          title: string
        }
        Insert: {
          class_id: string
          completed?: boolean
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          student_id: string
          title: string
        }
        Update: {
          class_id?: string
          completed?: boolean
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          student_id?: string
          title?: string
        }
        Relationships: []
      }
      resource_collection_items: {
        Row: {
          added_at: string
          collection_id: string
          resource_id: string
        }
        Insert: {
          added_at?: string
          collection_id: string
          resource_id: string
        }
        Update: {
          added_at?: string
          collection_id?: string
          resource_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "resource_collection_items_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "resource_collections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resource_collection_items_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "teaching_resources"
            referencedColumns: ["id"]
          },
        ]
      }
      resource_collections: {
        Row: {
          color: string
          created_at: string
          description: string
          id: string
          name: string
          owner_id: string
        }
        Insert: {
          color?: string
          created_at?: string
          description?: string
          id?: string
          name: string
          owner_id: string
        }
        Update: {
          color?: string
          created_at?: string
          description?: string
          id?: string
          name?: string
          owner_id?: string
        }
        Relationships: []
      }
      reward_redemptions: {
        Row: {
          campaign_id: string | null
          class_id: string
          created_at: string
          date: string
          id: string
          notes: string
          points_spent: number
          prize_name: string
          reward_id: string | null
          student_id: string
        }
        Insert: {
          campaign_id?: string | null
          class_id: string
          created_at?: string
          date?: string
          id?: string
          notes?: string
          points_spent?: number
          prize_name?: string
          reward_id?: string | null
          student_id: string
        }
        Update: {
          campaign_id?: string | null
          class_id?: string
          created_at?: string
          date?: string
          id?: string
          notes?: string
          points_spent?: number
          prize_name?: string
          reward_id?: string | null
          student_id?: string
        }
        Relationships: []
      }
      rewards: {
        Row: {
          active: boolean
          class_id: string
          created_at: string
          description: string
          id: string
          name: string
          points_cost: number
          stock: number | null
        }
        Insert: {
          active?: boolean
          class_id: string
          created_at?: string
          description?: string
          id?: string
          name: string
          points_cost?: number
          stock?: number | null
        }
        Update: {
          active?: boolean
          class_id?: string
          created_at?: string
          description?: string
          id?: string
          name?: string
          points_cost?: number
          stock?: number | null
        }
        Relationships: []
      }
      seating_configs: {
        Row: {
          class_id: string
          created_at: string
          id: string
          name: string
          snapshot: Json
        }
        Insert: {
          class_id: string
          created_at?: string
          id?: string
          name: string
          snapshot: Json
        }
        Update: {
          class_id?: string
          created_at?: string
          id?: string
          name?: string
          snapshot?: Json
        }
        Relationships: []
      }
      student_documents: {
        Row: {
          category: string
          class_id: string
          created_at: string
          description: string | null
          file_path: string | null
          file_size: number | null
          id: string
          mime_type: string | null
          school_year: string | null
          student_id: string
          title: string
        }
        Insert: {
          category?: string
          class_id: string
          created_at?: string
          description?: string | null
          file_path?: string | null
          file_size?: number | null
          id?: string
          mime_type?: string | null
          school_year?: string | null
          student_id: string
          title: string
        }
        Update: {
          category?: string
          class_id?: string
          created_at?: string
          description?: string | null
          file_path?: string | null
          file_size?: number | null
          id?: string
          mime_type?: string | null
          school_year?: string | null
          student_id?: string
          title?: string
        }
        Relationships: []
      }
      student_groups: {
        Row: {
          group_id: string
          student_id: string
        }
        Insert: {
          group_id: string
          student_id: string
        }
        Update: {
          group_id?: string
          student_id?: string
        }
        Relationships: []
      }
      student_relations: {
        Row: {
          class_id: string
          created_at: string
          id: string
          kind: string
          student_a: string
          student_b: string
        }
        Insert: {
          class_id: string
          created_at?: string
          id?: string
          kind: string
          student_a: string
          student_b: string
        }
        Update: {
          class_id?: string
          created_at?: string
          id?: string
          kind?: string
          student_a?: string
          student_b?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_relations_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_relations_student_a_fkey"
            columns: ["student_a"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_relations_student_b_fkey"
            columns: ["student_b"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      students: {
        Row: {
          class_id: string
          corner_pref: boolean
          created_at: string
          gender: string | null
          height: string
          id: string
          name: string
          notes: string | null
          row_pref: string
          seat_col: number | null
          seat_locked: boolean
          seat_row: number | null
        }
        Insert: {
          class_id: string
          corner_pref?: boolean
          created_at?: string
          gender?: string | null
          height?: string
          id?: string
          name: string
          notes?: string | null
          row_pref?: string
          seat_col?: number | null
          seat_locked?: boolean
          seat_row?: number | null
        }
        Update: {
          class_id?: string
          corner_pref?: boolean
          created_at?: string
          gender?: string | null
          height?: string
          id?: string
          name?: string
          notes?: string | null
          row_pref?: string
          seat_col?: number | null
          seat_locked?: boolean
          seat_row?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "students_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
        ]
      }
      teacher_style_profile: {
        Row: {
          avg_question_length: number
          avg_questions_per_worksheet: number
          last_ai_summary: string
          last_updated_at: string
          preferred_resource_types: Json
          preferred_subjects: Json
          resource_count: number
          tone_keywords: string[]
          user_id: string
          weekly_pace: Json
          writing_style_sample: string
        }
        Insert: {
          avg_question_length?: number
          avg_questions_per_worksheet?: number
          last_ai_summary?: string
          last_updated_at?: string
          preferred_resource_types?: Json
          preferred_subjects?: Json
          resource_count?: number
          tone_keywords?: string[]
          user_id: string
          weekly_pace?: Json
          writing_style_sample?: string
        }
        Update: {
          avg_question_length?: number
          avg_questions_per_worksheet?: number
          last_ai_summary?: string
          last_updated_at?: string
          preferred_resource_types?: Json
          preferred_subjects?: Json
          resource_count?: number
          tone_keywords?: string[]
          user_id?: string
          weekly_pace?: Json
          writing_style_sample?: string
        }
        Relationships: []
      }
      teaching_resources: {
        Row: {
          ai_generated: boolean
          content: Json
          created_at: string
          description: string
          embedding: string | null
          file_path: string | null
          grade_level: string
          id: string
          mime_type: string | null
          owner_id: string
          resource_type: string
          source_prompt: string
          source_transcript_id: string | null
          subject: string
          tags: string[]
          title: string
          updated_at: string
        }
        Insert: {
          ai_generated?: boolean
          content?: Json
          created_at?: string
          description?: string
          embedding?: string | null
          file_path?: string | null
          grade_level?: string
          id?: string
          mime_type?: string | null
          owner_id: string
          resource_type?: string
          source_prompt?: string
          source_transcript_id?: string | null
          subject?: string
          tags?: string[]
          title: string
          updated_at?: string
        }
        Update: {
          ai_generated?: boolean
          content?: Json
          created_at?: string
          description?: string
          embedding?: string | null
          file_path?: string | null
          grade_level?: string
          id?: string
          mime_type?: string | null
          owner_id?: string
          resource_type?: string
          source_prompt?: string
          source_transcript_id?: string | null
          subject?: string
          tags?: string[]
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      weekly_bulletins: {
        Row: {
          activities: Json
          class_id: string
          created_at: string
          digest_summary: string
          embedding: string | null
          end_date: string
          id: string
          notes: string
          recap_questions: Json
          start_date: string
          study_points: Json
          title: string
          weekly_riddle: string
          weekly_riddle_answer: string
        }
        Insert: {
          activities?: Json
          class_id: string
          created_at?: string
          digest_summary?: string
          embedding?: string | null
          end_date: string
          id?: string
          notes?: string
          recap_questions?: Json
          start_date: string
          study_points?: Json
          title?: string
          weekly_riddle?: string
          weekly_riddle_answer?: string
        }
        Update: {
          activities?: Json
          class_id?: string
          created_at?: string
          digest_summary?: string
          embedding?: string | null
          end_date?: string
          id?: string
          notes?: string
          recap_questions?: Json
          start_date?: string
          study_points?: Json
          title?: string
          weekly_riddle?: string
          weekly_riddle_answer?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      match_resources: {
        Args: {
          exclude_id?: string
          match_count?: number
          owner: string
          query_embedding: string
        }
        Returns: {
          id: string
          similarity: number
        }[]
      }
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
