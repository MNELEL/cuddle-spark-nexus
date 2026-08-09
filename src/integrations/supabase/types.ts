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
      academic_calendar_overrides: {
        Row: {
          class_id: string
          created_at: string
          end_date: string
          id: string
          label: string | null
          start_date: string
          type: string
        }
        Insert: {
          class_id: string
          created_at?: string
          end_date: string
          id?: string
          label?: string | null
          start_date: string
          type: string
        }
        Update: {
          class_id?: string
          created_at?: string
          end_date?: string
          id?: string
          label?: string | null
          start_date?: string
          type?: string
        }
        Relationships: []
      }
      app_logs: {
        Row: {
          context: Json | null
          created_at: string
          id: string
          level: string
          message: string
          source: string | null
          user_id: string | null
        }
        Insert: {
          context?: Json | null
          created_at?: string
          id?: string
          level: string
          message: string
          source?: string | null
          user_id?: string | null
        }
        Update: {
          context?: Json | null
          created_at?: string
          id?: string
          level?: string
          message?: string
          source?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      app_security: {
        Row: {
          pin_enabled: boolean
          pin_hash: string | null
          pin_salt: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          pin_enabled?: boolean
          pin_hash?: string | null
          pin_salt?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          pin_enabled?: boolean
          pin_hash?: string | null
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
      badges: {
        Row: {
          active: boolean
          class_id: string
          color: string
          created_at: string
          criteria: string
          description: string
          icon: string
          id: string
          name: string
          points_reward: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          class_id: string
          color?: string
          created_at?: string
          criteria?: string
          description?: string
          icon?: string
          id?: string
          name: string
          points_reward?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          class_id?: string
          color?: string
          created_at?: string
          criteria?: string
          description?: string
          icon?: string
          id?: string
          name?: string
          points_reward?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "badges_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
        ]
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
      brand_settings: {
        Row: {
          created_at: string
          header_line: string | null
          id: string
          logo_data_url: string | null
          primary_color: string | null
          principal_name_default: string | null
          school_name: string | null
          teacher_name_default: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          header_line?: string | null
          id?: string
          logo_data_url?: string | null
          primary_color?: string | null
          principal_name_default?: string | null
          school_name?: string | null
          teacher_name_default?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          header_line?: string | null
          id?: string
          logo_data_url?: string | null
          primary_color?: string | null
          principal_name_default?: string | null
          school_name?: string | null
          teacher_name_default?: string | null
          updated_at?: string
          user_id?: string
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
      certificate_notes: {
        Row: {
          class_id: string
          conducts: Json | null
          created_at: string
          grade_overrides: Json | null
          id: string
          period_key: string
          principal_note: string
          student_id: string
          subjects: Json | null
          teacher_note: string
          updated_at: string
        }
        Insert: {
          class_id: string
          conducts?: Json | null
          created_at?: string
          grade_overrides?: Json | null
          id?: string
          period_key: string
          principal_note?: string
          student_id: string
          subjects?: Json | null
          teacher_note?: string
          updated_at?: string
        }
        Update: {
          class_id?: string
          conducts?: Json | null
          created_at?: string
          grade_overrides?: Json | null
          id?: string
          period_key?: string
          principal_note?: string
          student_id?: string
          subjects?: Json | null
          teacher_note?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "certificate_notes_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "certificate_notes_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_leads: {
        Row: {
          checklist_slug: string
          created_at: string
          email: string
          full_name: string
          id: string
          institution: string
          role: string
          user_agent: string | null
        }
        Insert: {
          checklist_slug: string
          created_at?: string
          email: string
          full_name: string
          id?: string
          institution: string
          role: string
          user_agent?: string | null
        }
        Update: {
          checklist_slug?: string
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          institution?: string
          role?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      class_events: {
        Row: {
          class_id: string
          color: string | null
          created_at: string
          created_by: string
          date: string
          end_date: string | null
          id: string
          notes: string | null
          student_id: string | null
          title: string
          type: Database["public"]["Enums"]["class_event_type"]
          updated_at: string
        }
        Insert: {
          class_id: string
          color?: string | null
          created_at?: string
          created_by?: string
          date: string
          end_date?: string | null
          id?: string
          notes?: string | null
          student_id?: string | null
          title: string
          type?: Database["public"]["Enums"]["class_event_type"]
          updated_at?: string
        }
        Update: {
          class_id?: string
          color?: string | null
          created_at?: string
          created_by?: string
          date?: string
          end_date?: string | null
          id?: string
          notes?: string | null
          student_id?: string | null
          title?: string
          type?: Database["public"]["Enums"]["class_event_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_events_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_events_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      class_notifications: {
        Row: {
          class_id: string
          class_name: string
          created_at: string
          id: string
          read_at: string | null
          recipient_id: string
          type: string
        }
        Insert: {
          class_id: string
          class_name: string
          created_at?: string
          id?: string
          read_at?: string | null
          recipient_id: string
          type?: string
        }
        Update: {
          class_id?: string
          class_name?: string
          created_at?: string
          id?: string
          read_at?: string | null
          recipient_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_notifications_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
        ]
      }
      class_pacing_settings: {
        Row: {
          buffer_percent: number
          class_id: string
          updated_at: string
        }
        Insert: {
          buffer_percent?: number
          class_id: string
          updated_at?: string
        }
        Update: {
          buffer_percent?: number
          class_id?: string
          updated_at?: string
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
          academic_year: string | null
          created_at: string
          grid_cols: number
          grid_rows: number
          hidden_seats: Json
          id: string
          institution_id: string | null
          name: string
          owner_id: string
          parent_class_id: string | null
          public_description: string | null
          public_enabled: boolean
          public_headline: string | null
          public_slug: string | null
          room_objects: Json
          status: string
          updated_at: string
        }
        Insert: {
          academic_year?: string | null
          created_at?: string
          grid_cols?: number
          grid_rows?: number
          hidden_seats?: Json
          id?: string
          institution_id?: string | null
          name: string
          owner_id: string
          parent_class_id?: string | null
          public_description?: string | null
          public_enabled?: boolean
          public_headline?: string | null
          public_slug?: string | null
          room_objects?: Json
          status?: string
          updated_at?: string
        }
        Update: {
          academic_year?: string | null
          created_at?: string
          grid_cols?: number
          grid_rows?: number
          hidden_seats?: Json
          id?: string
          institution_id?: string | null
          name?: string
          owner_id?: string
          parent_class_id?: string | null
          public_description?: string | null
          public_enabled?: boolean
          public_headline?: string | null
          public_slug?: string | null
          room_objects?: Json
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "classes_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "classes_parent_class_id_fkey"
            columns: ["parent_class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
        ]
      }
      curriculum_history_snapshots: {
        Row: {
          class_id: string
          confidence: number | null
          confirmed: boolean
          created_at: string
          estimated_end_date: string | null
          estimated_start_date: string | null
          id: string
          lessons_count: number | null
          raw_ai_notes: string | null
          source_resource_ids: string[] | null
          source_year: number
          subject: string
          unit_title: string
        }
        Insert: {
          class_id: string
          confidence?: number | null
          confirmed?: boolean
          created_at?: string
          estimated_end_date?: string | null
          estimated_start_date?: string | null
          id?: string
          lessons_count?: number | null
          raw_ai_notes?: string | null
          source_resource_ids?: string[] | null
          source_year: number
          subject: string
          unit_title: string
        }
        Update: {
          class_id?: string
          confidence?: number | null
          confirmed?: boolean
          created_at?: string
          estimated_end_date?: string | null
          estimated_start_date?: string | null
          id?: string
          lessons_count?: number | null
          raw_ai_notes?: string | null
          source_resource_ids?: string[] | null
          source_year?: number
          subject?: string
          unit_title?: string
        }
        Relationships: []
      }
      curriculum_units: {
        Row: {
          actual_lessons_used: number | null
          class_id: string
          completed_at: string | null
          created_at: string
          estimated_lessons: number | null
          id: string
          linked_resource_ids: string[] | null
          notes: string | null
          order_index: number | null
          priority: string
          status: string
          subject: string
          title: string
          updated_at: string
        }
        Insert: {
          actual_lessons_used?: number | null
          class_id: string
          completed_at?: string | null
          created_at?: string
          estimated_lessons?: number | null
          id?: string
          linked_resource_ids?: string[] | null
          notes?: string | null
          order_index?: number | null
          priority?: string
          status?: string
          subject: string
          title: string
          updated_at?: string
        }
        Update: {
          actual_lessons_used?: number | null
          class_id?: string
          completed_at?: string | null
          created_at?: string
          estimated_lessons?: number | null
          id?: string
          linked_resource_ids?: string[] | null
          notes?: string | null
          order_index?: number | null
          priority?: string
          status?: string
          subject?: string
          title?: string
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
      generator_versions: {
        Row: {
          body: string
          created_at: string
          id: string
          kind: string
          owner_id: string
          params: Json
          resource_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          body?: string
          created_at?: string
          id?: string
          kind: string
          owner_id: string
          params?: Json
          resource_id?: string | null
          title?: string
          updated_at?: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          kind?: string
          owner_id?: string
          params?: Json
          resource_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "generator_versions_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "teaching_resources"
            referencedColumns: ["id"]
          },
        ]
      }
      grade_weights: {
        Row: {
          class_id: string
          created_at: string
          id: string
          subject: string
          updated_at: string
          weight: number
        }
        Insert: {
          class_id: string
          created_at?: string
          id?: string
          subject: string
          updated_at?: string
          weight?: number
        }
        Update: {
          class_id?: string
          created_at?: string
          id?: string
          subject?: string
          updated_at?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "grade_weights_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
        ]
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
      ingest_jobs: {
        Row: {
          class_id: string | null
          committed_at: string | null
          created_at: string
          error: string | null
          extracted: Json
          file_name: string
          id: string
          kind: string
          mime_type: string
          owner_id: string
          source_path: string
          status: string
          summary: string
          updated_at: string
        }
        Insert: {
          class_id?: string | null
          committed_at?: string | null
          created_at?: string
          error?: string | null
          extracted?: Json
          file_name?: string
          id?: string
          kind: string
          mime_type?: string
          owner_id: string
          source_path: string
          status?: string
          summary?: string
          updated_at?: string
        }
        Update: {
          class_id?: string | null
          committed_at?: string | null
          created_at?: string
          error?: string | null
          extracted?: Json
          file_name?: string
          id?: string
          kind?: string
          mime_type?: string
          owner_id?: string
          source_path?: string
          status?: string
          summary?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ingest_jobs_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
        ]
      }
      institutions: {
        Row: {
          created_at: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
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
      pacing_recalc_log: {
        Row: {
          ai_recommendation: string | null
          buffer_percent: number
          class_id: string
          computed_at: string
          days_elapsed: number | null
          days_remaining: number | null
          id: string
          units_ahead_count: number | null
          units_behind_count: number | null
        }
        Insert: {
          ai_recommendation?: string | null
          buffer_percent?: number
          class_id: string
          computed_at?: string
          days_elapsed?: number | null
          days_remaining?: number | null
          id?: string
          units_ahead_count?: number | null
          units_behind_count?: number | null
        }
        Update: {
          ai_recommendation?: string | null
          buffer_percent?: number
          class_id?: string
          computed_at?: string
          days_elapsed?: number | null
          days_remaining?: number | null
          id?: string
          units_ahead_count?: number | null
          units_behind_count?: number | null
        }
        Relationships: []
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
      partner_leads: {
        Row: {
          contact_name: string
          created_at: string
          demo_date: string | null
          email: string
          id: string
          institution_name: string
          institution_type: string
          message: string | null
          phone: string | null
          role: string | null
          student_count: string | null
          teacher_count: string | null
          user_agent: string | null
        }
        Insert: {
          contact_name: string
          created_at?: string
          demo_date?: string | null
          email: string
          id?: string
          institution_name: string
          institution_type?: string
          message?: string | null
          phone?: string | null
          role?: string | null
          student_count?: string | null
          teacher_count?: string | null
          user_agent?: string | null
        }
        Update: {
          contact_name?: string
          created_at?: string
          demo_date?: string | null
          email?: string
          id?: string
          institution_name?: string
          institution_type?: string
          message?: string | null
          phone?: string | null
          role?: string | null
          student_count?: string | null
          teacher_count?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      poll_votes: {
        Row: {
          created_at: string
          id: string
          option_index: number
          poll_id: string
          student_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          option_index: number
          poll_id: string
          student_id: string
        }
        Update: {
          created_at?: string
          id?: string
          option_index?: number
          poll_id?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "poll_votes_poll_id_fkey"
            columns: ["poll_id"]
            isOneToOne: false
            referencedRelation: "polls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "poll_votes_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      polls: {
        Row: {
          class_id: string
          closed_at: string | null
          created_at: string
          id: string
          options: Json
          question: string
          status: string
          updated_at: string
        }
        Insert: {
          class_id: string
          closed_at?: string | null
          created_at?: string
          id?: string
          options?: Json
          question: string
          status?: string
          updated_at?: string
        }
        Update: {
          class_id?: string
          closed_at?: string | null
          created_at?: string
          id?: string
          options?: Json
          question?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "polls_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
          onboarding_state: Json
          trial_ends_at: string | null
          trial_started_at: string | null
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id: string
          onboarding_state?: Json
          trial_ends_at?: string | null
          trial_started_at?: string | null
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
          onboarding_state?: Json
          trial_ends_at?: string | null
          trial_started_at?: string | null
        }
        Relationships: []
      }
      reminder_preferences: {
        Row: {
          created_at: string
          lead_time_minutes: number
          types_enabled: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          lead_time_minutes?: number
          types_enabled?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          lead_time_minutes?: number
          types_enabled?: Json
          updated_at?: string
          user_id?: string
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
      seating_wizard_prefs: {
        Row: {
          balance_height: boolean
          updated_at: string
          user_id: string
          weight_academic: number
          weight_behavioral: number
          weight_social: number
        }
        Insert: {
          balance_height?: boolean
          updated_at?: string
          user_id: string
          weight_academic?: number
          weight_behavioral?: number
          weight_social?: number
        }
        Update: {
          balance_height?: boolean
          updated_at?: string
          user_id?: string
          weight_academic?: number
          weight_behavioral?: number
          weight_social?: number
        }
        Relationships: []
      }
      sent_reminder_alerts: {
        Row: {
          id: string
          reminder_id: string
          sent_at: string
        }
        Insert: {
          id?: string
          reminder_id: string
          sent_at?: string
        }
        Update: {
          id?: string
          reminder_id?: string
          sent_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sent_reminder_alerts_reminder_id_fkey"
            columns: ["reminder_id"]
            isOneToOne: true
            referencedRelation: "reminders"
            referencedColumns: ["id"]
          },
        ]
      }
      sound_preferences: {
        Row: {
          created_at: string
          enabled: boolean
          event_key: string
          id: string
          owner_id: string
          sound_id: string
          updated_at: string
          volume: number
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          event_key: string
          id?: string
          owner_id: string
          sound_id: string
          updated_at?: string
          volume?: number
        }
        Update: {
          created_at?: string
          enabled?: boolean
          event_key?: string
          id?: string
          owner_id?: string
          sound_id?: string
          updated_at?: string
          volume?: number
        }
        Relationships: []
      }
      student_badges: {
        Row: {
          awarded_at: string
          badge_id: string
          class_id: string
          created_at: string
          id: string
          note: string
          student_id: string
        }
        Insert: {
          awarded_at?: string
          badge_id: string
          class_id: string
          created_at?: string
          id?: string
          note?: string
          student_id: string
        }
        Update: {
          awarded_at?: string
          badge_id?: string
          class_id?: string
          created_at?: string
          id?: string
          note?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_badges_badge_id_fkey"
            columns: ["badge_id"]
            isOneToOne: false
            referencedRelation: "badges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_badges_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_badges_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
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
      student_profiles: {
        Row: {
          class_id: string
          created_at: string
          handoff_notes: string
          sensitive_flags: string[]
          sensitive_notes: string
          student_id: string
          teaching_style_notes: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          class_id: string
          created_at?: string
          handoff_notes?: string
          sensitive_flags?: string[]
          sensitive_notes?: string
          student_id: string
          teaching_style_notes?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          class_id?: string
          created_at?: string
          handoff_notes?: string
          sensitive_flags?: string[]
          sensitive_notes?: string
          student_id?: string
          teaching_style_notes?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "student_profiles_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_profiles_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: true
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
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
          accommodation_note: string | null
          address: string | null
          birth_date: string | null
          class_id: string
          corner_pref: boolean
          created_at: string
          father_id: string | null
          father_name: string | null
          father_phone: string | null
          gender: string | null
          has_special_accommodation: boolean
          height: string
          id: string
          mother_id: string | null
          mother_name: string | null
          mother_phone: string | null
          name: string
          national_id: string | null
          notes: string | null
          row_pref: string
          seat_col: number | null
          seat_locked: boolean
          seat_row: number | null
        }
        Insert: {
          accommodation_note?: string | null
          address?: string | null
          birth_date?: string | null
          class_id: string
          corner_pref?: boolean
          created_at?: string
          father_id?: string | null
          father_name?: string | null
          father_phone?: string | null
          gender?: string | null
          has_special_accommodation?: boolean
          height?: string
          id?: string
          mother_id?: string | null
          mother_name?: string | null
          mother_phone?: string | null
          name: string
          national_id?: string | null
          notes?: string | null
          row_pref?: string
          seat_col?: number | null
          seat_locked?: boolean
          seat_row?: number | null
        }
        Update: {
          accommodation_note?: string | null
          address?: string | null
          birth_date?: string | null
          class_id?: string
          corner_pref?: boolean
          created_at?: string
          father_id?: string | null
          father_name?: string | null
          father_phone?: string | null
          gender?: string | null
          has_special_accommodation?: boolean
          height?: string
          id?: string
          mother_id?: string | null
          mother_name?: string | null
          mother_phone?: string | null
          name?: string
          national_id?: string | null
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
          difficulty: string
          embedding: string | null
          file_path: string | null
          grade_level: string
          id: string
          is_favorite: boolean
          mime_type: string | null
          owner_id: string
          resource_type: string
          source_prompt: string
          source_transcript_id: string | null
          subject: string
          tags: string[]
          title: string
          topic_id: string | null
          updated_at: string
        }
        Insert: {
          ai_generated?: boolean
          content?: Json
          created_at?: string
          description?: string
          difficulty?: string
          embedding?: string | null
          file_path?: string | null
          grade_level?: string
          id?: string
          is_favorite?: boolean
          mime_type?: string | null
          owner_id: string
          resource_type?: string
          source_prompt?: string
          source_transcript_id?: string | null
          subject?: string
          tags?: string[]
          title: string
          topic_id?: string | null
          updated_at?: string
        }
        Update: {
          ai_generated?: boolean
          content?: Json
          created_at?: string
          description?: string
          difficulty?: string
          embedding?: string | null
          file_path?: string | null
          grade_level?: string
          id?: string
          is_favorite?: boolean
          mime_type?: string | null
          owner_id?: string
          resource_type?: string
          source_prompt?: string
          source_transcript_id?: string | null
          subject?: string
          tags?: string[]
          title?: string
          topic_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "teaching_resources_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id"]
          },
        ]
      }
      topics: {
        Row: {
          color: string
          created_at: string
          id: string
          name: string
          owner_id: string
          parent_id: string | null
          updated_at: string
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          name: string
          owner_id: string
          parent_id?: string | null
          updated_at?: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          name?: string
          owner_id?: string
          parent_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "topics_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          institution_id: string | null
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          institution_id?: string | null
          role: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          institution_id?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
        ]
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
      weekly_lessons: {
        Row: {
          class_id: string
          created_at: string
          created_by: string
          day_key: string
          duration: number
          hour: number
          id: string
          library_item_id: string | null
          notes: string | null
          subject: string | null
          title: string
          updated_at: string
          week_start: string
        }
        Insert: {
          class_id: string
          created_at?: string
          created_by?: string
          day_key: string
          duration?: number
          hour: number
          id?: string
          library_item_id?: string | null
          notes?: string | null
          subject?: string | null
          title: string
          updated_at?: string
          week_start: string
        }
        Update: {
          class_id?: string
          created_at?: string
          created_by?: string
          day_key?: string
          duration?: number
          hour?: number
          id?: string
          library_item_id?: string | null
          notes?: string | null
          subject?: string | null
          title?: string
          updated_at?: string
          week_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "weekly_lessons_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "weekly_lessons_library_item_id_fkey"
            columns: ["library_item_id"]
            isOneToOne: false
            referencedRelation: "teaching_resources"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      export_my_data: { Args: never; Returns: Json }
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
      recalculate_pacing: {
        Args: {
          p_class_id: string
          p_holiday_dates: string[]
          p_year_end_date: string
        }
        Returns: {
          ai_recommendation: string | null
          buffer_percent: number
          class_id: string
          computed_at: string
          days_elapsed: number | null
          days_remaining: number | null
          id: string
          units_ahead_count: number | null
          units_behind_count: number | null
        }
        SetofOptions: {
          from: "*"
          to: "pacing_recalc_log"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      app_role: "admin" | "principal" | "teacher" | "secretary"
      class_event_type:
        | "birthday"
        | "exam"
        | "trip"
        | "holiday"
        | "meeting"
        | "other"
        | "special_exam"
        | "celebration"
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
      app_role: ["admin", "principal", "teacher", "secretary"],
      class_event_type: [
        "birthday",
        "exam",
        "trip",
        "holiday",
        "meeting",
        "other",
        "special_exam",
        "celebration",
      ],
    },
  },
} as const
