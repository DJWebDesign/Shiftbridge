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
      agencies: {
        Row: {
          address: string | null
          bio: string | null
          city: string | null
          contact_email: string | null
          created_at: string
          display_name: string | null
          house_for_facility_id: string | null
          id: string
          logo_url: string | null
          name: string
          phone: string | null
          require_claim_approval: boolean
          state: string | null
          status: string
          updated_at: string
          zip: string | null
        }
        Insert: {
          address?: string | null
          bio?: string | null
          city?: string | null
          contact_email?: string | null
          created_at?: string
          display_name?: string | null
          house_for_facility_id?: string | null
          id?: string
          logo_url?: string | null
          name: string
          phone?: string | null
          require_claim_approval?: boolean
          state?: string | null
          status?: string
          updated_at?: string
          zip?: string | null
        }
        Update: {
          address?: string | null
          bio?: string | null
          city?: string | null
          contact_email?: string | null
          created_at?: string
          display_name?: string | null
          house_for_facility_id?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          phone?: string | null
          require_claim_approval?: boolean
          state?: string | null
          status?: string
          updated_at?: string
          zip?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agencies_house_for_facility_id_fkey"
            columns: ["house_for_facility_id"]
            isOneToOne: true
            referencedRelation: "facilities"
            referencedColumns: ["id"]
          },
        ]
      }
      agency_admins: {
        Row: {
          agency_id: string
          created_at: string
          id: string
          profile_id: string
        }
        Insert: {
          agency_id: string
          created_at?: string
          id?: string
          profile_id: string
        }
        Update: {
          agency_id?: string
          created_at?: string
          id?: string
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agency_admins_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agency_admins_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      agency_facility_connections: {
        Row: {
          accepted_at: string | null
          agency_id: string
          bill_rate: number | null
          created_at: string
          facility_id: string
          id: string
          requested_at: string | null
          requested_by: string | null
          status: string
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          agency_id: string
          bill_rate?: number | null
          created_at?: string
          facility_id: string
          id?: string
          requested_at?: string | null
          requested_by?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          agency_id?: string
          bill_rate?: number | null
          created_at?: string
          facility_id?: string
          id?: string
          requested_at?: string | null
          requested_by?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agency_facility_connections_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agency_facility_connections_facility_id_fkey"
            columns: ["facility_id"]
            isOneToOne: false
            referencedRelation: "facilities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agency_facility_connections_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      agency_nurse_relationships: {
        Row: {
          agency_id: string
          base_pay_rate: number | null
          created_at: string
          id: string
          notes: string | null
          nurse_profile_id: string
          status: string
          updated_at: string
        }
        Insert: {
          agency_id: string
          base_pay_rate?: number | null
          created_at?: string
          id?: string
          notes?: string | null
          nurse_profile_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          agency_id?: string
          base_pay_rate?: number | null
          created_at?: string
          id?: string
          notes?: string | null
          nurse_profile_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agency_nurse_relationships_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agency_nurse_relationships_nurse_profile_id_fkey"
            columns: ["nurse_profile_id"]
            isOneToOne: false
            referencedRelation: "nurse_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agency_nurse_relationships_nurse_profile_id_fkey"
            columns: ["nurse_profile_id"]
            isOneToOne: false
            referencedRelation: "nurse_profiles_facility_view"
            referencedColumns: ["id"]
          },
        ]
      }
      analytics_events: {
        Row: {
          created_at: string
          demo_session_id: string | null
          event_data: Json | null
          event_type: string
          id: string
          profile_id: string | null
        }
        Insert: {
          created_at?: string
          demo_session_id?: string | null
          event_data?: Json | null
          event_type: string
          id?: string
          profile_id?: string | null
        }
        Update: {
          created_at?: string
          demo_session_id?: string | null
          event_data?: Json | null
          event_type?: string
          id?: string
          profile_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "analytics_events_demo_session_id_fkey"
            columns: ["demo_session_id"]
            isOneToOne: false
            referencedRelation: "demo_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "analytics_events_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      connection_requests: {
        Row: {
          agency_id: string
          facility_id: string
          id: string
          initiated_by_role: string
          message: string | null
          placeholder_id: string
          requested_at: string
          requested_by: string | null
          responded_at: string | null
          responded_by: string | null
          status: string
        }
        Insert: {
          agency_id: string
          facility_id: string
          id?: string
          initiated_by_role?: string
          message?: string | null
          placeholder_id: string
          requested_at?: string
          requested_by?: string | null
          responded_at?: string | null
          responded_by?: string | null
          status?: string
        }
        Update: {
          agency_id?: string
          facility_id?: string
          id?: string
          initiated_by_role?: string
          message?: string | null
          placeholder_id?: string
          requested_at?: string
          requested_by?: string | null
          responded_at?: string | null
          responded_by?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "connection_requests_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "connection_requests_facility_id_fkey"
            columns: ["facility_id"]
            isOneToOne: false
            referencedRelation: "facilities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "connection_requests_placeholder_id_fkey"
            columns: ["placeholder_id"]
            isOneToOne: false
            referencedRelation: "placeholder_facilities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "connection_requests_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "connection_requests_responded_by_fkey"
            columns: ["responded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      cta_events: {
        Row: {
          created_at: string | null
          event_type: string
          facility_id: string | null
          id: string
          token_id: string | null
        }
        Insert: {
          created_at?: string | null
          event_type: string
          facility_id?: string | null
          id?: string
          token_id?: string | null
        }
        Update: {
          created_at?: string | null
          event_type?: string
          facility_id?: string | null
          id?: string
          token_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cta_events_facility_id_fkey"
            columns: ["facility_id"]
            isOneToOne: false
            referencedRelation: "facilities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cta_events_token_id_fkey"
            columns: ["token_id"]
            isOneToOne: false
            referencedRelation: "placeholder_confirm_tokens"
            referencedColumns: ["id"]
          },
        ]
      }
      demo_sessions: {
        Row: {
          agency_id: string | null
          auth_user_id: string
          created_at: string | null
          expires_at: string
          facility_id: string | null
          id: string
          nurse_profile_ids: string[] | null
        }
        Insert: {
          agency_id?: string | null
          auth_user_id: string
          created_at?: string | null
          expires_at: string
          facility_id?: string | null
          id?: string
          nurse_profile_ids?: string[] | null
        }
        Update: {
          agency_id?: string | null
          auth_user_id?: string
          created_at?: string | null
          expires_at?: string
          facility_id?: string | null
          id?: string
          nurse_profile_ids?: string[] | null
        }
        Relationships: []
      }
      dnr_records: {
        Row: {
          agency_id: string
          created_at: string
          created_by: string
          facility_id: string
          id: string
          nurse_profile_id: string
        }
        Insert: {
          agency_id: string
          created_at?: string
          created_by: string
          facility_id: string
          id?: string
          nurse_profile_id: string
        }
        Update: {
          agency_id?: string
          created_at?: string
          created_by?: string
          facility_id?: string
          id?: string
          nurse_profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dnr_records_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dnr_records_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dnr_records_facility_id_fkey"
            columns: ["facility_id"]
            isOneToOne: false
            referencedRelation: "facilities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dnr_records_nurse_profile_id_fkey"
            columns: ["nurse_profile_id"]
            isOneToOne: false
            referencedRelation: "nurse_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dnr_records_nurse_profile_id_fkey"
            columns: ["nurse_profile_id"]
            isOneToOne: false
            referencedRelation: "nurse_profiles_facility_view"
            referencedColumns: ["id"]
          },
        ]
      }
      facilities: {
        Row: {
          address_line1: string
          address_line2: string | null
          address_normalized: string
          city: string
          created_at: string
          facility_notes: string | null
          facility_type: string
          id: string
          lat: number | null
          lng: number | null
          name: string
          state: string
          status: string
          updated_at: string
          zip: string
        }
        Insert: {
          address_line1: string
          address_line2?: string | null
          address_normalized: string
          city: string
          created_at?: string
          facility_notes?: string | null
          facility_type: string
          id?: string
          lat?: number | null
          lng?: number | null
          name: string
          state: string
          status?: string
          updated_at?: string
          zip: string
        }
        Update: {
          address_line1?: string
          address_line2?: string | null
          address_normalized?: string
          city?: string
          created_at?: string
          facility_notes?: string | null
          facility_type?: string
          id?: string
          lat?: number | null
          lng?: number | null
          name?: string
          state?: string
          status?: string
          updated_at?: string
          zip?: string
        }
        Relationships: []
      }
      facility_admins: {
        Row: {
          created_at: string
          facility_id: string
          id: string
          profile_id: string
        }
        Insert: {
          created_at?: string
          facility_id: string
          id?: string
          profile_id: string
        }
        Update: {
          created_at?: string
          facility_id?: string
          id?: string
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "facility_admins_facility_id_fkey"
            columns: ["facility_id"]
            isOneToOne: false
            referencedRelation: "facilities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facility_admins_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      facility_outreach_contacts: {
        Row: {
          created_at: string | null
          email: string
          facility_id: string
          id: string
          label: string | null
          last_used_at: string | null
          platform_outreach_sent_at: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          facility_id: string
          id?: string
          label?: string | null
          last_used_at?: string | null
          platform_outreach_sent_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          facility_id?: string
          id?: string
          label?: string | null
          last_used_at?: string | null
          platform_outreach_sent_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "facility_outreach_contacts_facility_id_fkey"
            columns: ["facility_id"]
            isOneToOne: false
            referencedRelation: "facilities"
            referencedColumns: ["id"]
          },
        ]
      }
      facility_shift_configs: {
        Row: {
          created_at: string
          credential_type: string
          end_time: string
          facility_id: string
          id: string
          shift_name: string
          start_time: string
        }
        Insert: {
          created_at?: string
          credential_type: string
          end_time: string
          facility_id: string
          id?: string
          shift_name: string
          start_time: string
        }
        Update: {
          created_at?: string
          credential_type?: string
          end_time?: string
          facility_id?: string
          id?: string
          shift_name?: string
          start_time?: string
        }
        Relationships: [
          {
            foreignKeyName: "facility_shift_configs_facility_id_fkey"
            columns: ["facility_id"]
            isOneToOne: false
            referencedRelation: "facilities"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          channel: string
          created_at: string
          event_type: string
          id: string
          message: string
          payload: Json | null
          profile_id: string | null
          read_at: string | null
          recipient_email: string | null
          recipient_phone: string | null
          sent_at: string | null
          status: string
        }
        Insert: {
          channel: string
          created_at?: string
          event_type: string
          id?: string
          message: string
          payload?: Json | null
          profile_id?: string | null
          read_at?: string | null
          recipient_email?: string | null
          recipient_phone?: string | null
          sent_at?: string | null
          status?: string
        }
        Update: {
          channel?: string
          created_at?: string
          event_type?: string
          id?: string
          message?: string
          payload?: Json | null
          profile_id?: string | null
          read_at?: string | null
          recipient_email?: string | null
          recipient_phone?: string | null
          sent_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      nurse_drive_times: {
        Row: {
          calculated_at: string
          facility_id: string
          minutes: number | null
          nurse_profile_id: string
        }
        Insert: {
          calculated_at?: string
          facility_id: string
          minutes?: number | null
          nurse_profile_id: string
        }
        Update: {
          calculated_at?: string
          facility_id?: string
          minutes?: number | null
          nurse_profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "nurse_drive_times_facility_id_fkey"
            columns: ["facility_id"]
            isOneToOne: false
            referencedRelation: "facilities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nurse_drive_times_nurse_profile_id_fkey"
            columns: ["nurse_profile_id"]
            isOneToOne: false
            referencedRelation: "nurse_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      nurse_profiles: {
        Row: {
          covid_vaccinated: boolean
          cpr_expiration: string | null
          created_at: string
          credential_type: string
          home_address: string | null
          home_address_lat: number | null
          home_address_lng: number | null
          id: string
          iv_cert_source: string | null
          iv_certified: boolean
          license_expiration: string | null
          license_number: string
          license_state: string
          license_status: string
          nursys_last_checked: string | null
          phone: string | null
          profile_id: string
          profile_photo_url: string | null
          tb_test_date: string | null
          updated_at: string
        }
        Insert: {
          covid_vaccinated?: boolean
          cpr_expiration?: string | null
          created_at?: string
          credential_type: string
          home_address?: string | null
          home_address_lat?: number | null
          home_address_lng?: number | null
          id?: string
          iv_cert_source?: string | null
          iv_certified?: boolean
          license_expiration?: string | null
          license_number: string
          license_state: string
          license_status?: string
          nursys_last_checked?: string | null
          phone?: string | null
          profile_id: string
          profile_photo_url?: string | null
          tb_test_date?: string | null
          updated_at?: string
        }
        Update: {
          covid_vaccinated?: boolean
          cpr_expiration?: string | null
          created_at?: string
          credential_type?: string
          home_address?: string | null
          home_address_lat?: number | null
          home_address_lng?: number | null
          id?: string
          iv_cert_source?: string | null
          iv_certified?: boolean
          license_expiration?: string | null
          license_number?: string
          license_state?: string
          license_status?: string
          nursys_last_checked?: string | null
          phone?: string | null
          profile_id?: string
          profile_photo_url?: string | null
          tb_test_date?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "nurse_profiles_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      pay_tier_configs: {
        Row: {
          agency_id: string
          bonus_amount: number
          bonus_type: string
          created_at: string
          custom_label: string
          id: string
          tier_number: number
          updated_at: string
        }
        Insert: {
          agency_id: string
          bonus_amount?: number
          bonus_type?: string
          created_at?: string
          custom_label?: string
          id?: string
          tier_number: number
          updated_at?: string
        }
        Update: {
          agency_id?: string
          bonus_amount?: number
          bonus_type?: string
          created_at?: string
          custom_label?: string
          id?: string
          tier_number?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pay_tier_configs_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
        ]
      }
      placeholder_confirm_tokens: {
        Row: {
          created_at: string
          email: string
          expires_at: string
          id: string
          shift_id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          shift_id: string
          token?: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          shift_id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "placeholder_confirm_tokens_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "shifts"
            referencedColumns: ["id"]
          },
        ]
      }
      placeholder_facilities: {
        Row: {
          address_line1: string
          address_line2: string | null
          address_normalized: string
          agency_id: string
          city: string
          connection_status: string
          coordinator_email: string | null
          created_at: string
          facility_notes: string | null
          facility_type: string
          id: string
          lat: number | null
          lng: number | null
          matched_facility_id: string | null
          name: string
          state: string
          updated_at: string
          zip: string
        }
        Insert: {
          address_line1: string
          address_line2?: string | null
          address_normalized: string
          agency_id: string
          city: string
          connection_status?: string
          coordinator_email?: string | null
          created_at?: string
          facility_notes?: string | null
          facility_type: string
          id?: string
          lat?: number | null
          lng?: number | null
          matched_facility_id?: string | null
          name: string
          state: string
          updated_at?: string
          zip: string
        }
        Update: {
          address_line1?: string
          address_line2?: string | null
          address_normalized?: string
          agency_id?: string
          city?: string
          connection_status?: string
          coordinator_email?: string | null
          created_at?: string
          facility_notes?: string | null
          facility_type?: string
          id?: string
          lat?: number | null
          lng?: number | null
          matched_facility_id?: string | null
          name?: string
          state?: string
          updated_at?: string
          zip?: string
        }
        Relationships: [
          {
            foreignKeyName: "placeholder_facilities_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "placeholder_facilities_matched_facility_id_fkey"
            columns: ["matched_facility_id"]
            isOneToOne: false
            referencedRelation: "facilities"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          full_name: string
          id: string
          is_active: boolean
          phone: string | null
          role: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          full_name: string
          id: string
          is_active?: boolean
          phone?: string | null
          role: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          is_active?: boolean
          phone?: string | null
          role?: string
          updated_at?: string
        }
        Relationships: []
      }
      shift_claims: {
        Row: {
          agency_approved_at: string | null
          agency_approved_by: string | null
          agency_id: string
          claimed_at: string
          confirmed_at: string | null
          confirmed_by: string | null
          created_at: string
          id: string
          nurse_profile_id: string
          shift_id: string
          status: string
          updated_at: string
        }
        Insert: {
          agency_approved_at?: string | null
          agency_approved_by?: string | null
          agency_id: string
          claimed_at?: string
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          id?: string
          nurse_profile_id: string
          shift_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          agency_approved_at?: string | null
          agency_approved_by?: string | null
          agency_id?: string
          claimed_at?: string
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          id?: string
          nurse_profile_id?: string
          shift_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shift_claims_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_claims_confirmed_by_fkey"
            columns: ["confirmed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_claims_nurse_profile_id_fkey"
            columns: ["nurse_profile_id"]
            isOneToOne: false
            referencedRelation: "nurse_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_claims_nurse_profile_id_fkey"
            columns: ["nurse_profile_id"]
            isOneToOne: false
            referencedRelation: "nurse_profiles_facility_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_claims_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "shifts"
            referencedColumns: ["id"]
          },
        ]
      }
      shifts: {
        Row: {
          agency_id: string | null
          cancel_reason: string | null
          canceled_at: string | null
          canceled_by: string | null
          created_at: string
          credential_required: string
          end_time: string
          facility_id: string | null
          id: string
          is_late_cancel: boolean | null
          is_placeholder: boolean
          notes: string | null
          placeholder_facility_id: string | null
          posted_by: string
          priority_tier: number
          shift_date: string
          start_time: string
          status: string
          updated_at: string
        }
        Insert: {
          agency_id?: string | null
          cancel_reason?: string | null
          canceled_at?: string | null
          canceled_by?: string | null
          created_at?: string
          credential_required: string
          end_time: string
          facility_id?: string | null
          id?: string
          is_late_cancel?: boolean | null
          is_placeholder?: boolean
          notes?: string | null
          placeholder_facility_id?: string | null
          posted_by: string
          priority_tier?: number
          shift_date: string
          start_time: string
          status?: string
          updated_at?: string
        }
        Update: {
          agency_id?: string | null
          cancel_reason?: string | null
          canceled_at?: string | null
          canceled_by?: string | null
          created_at?: string
          credential_required?: string
          end_time?: string
          facility_id?: string | null
          id?: string
          is_late_cancel?: boolean | null
          is_placeholder?: boolean
          notes?: string | null
          placeholder_facility_id?: string | null
          posted_by?: string
          priority_tier?: number
          shift_date?: string
          start_time?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shifts_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shifts_canceled_by_fkey"
            columns: ["canceled_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shifts_facility_id_fkey"
            columns: ["facility_id"]
            isOneToOne: false
            referencedRelation: "facilities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shifts_placeholder_facility_id_fkey"
            columns: ["placeholder_facility_id"]
            isOneToOne: false
            referencedRelation: "placeholder_facilities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shifts_posted_by_fkey"
            columns: ["posted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          created_at: string
          id: string
          preferences: Record<string, Record<string, boolean>>
          profile_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          preferences?: Record<string, Record<string, boolean>>
          profile_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          preferences?: Record<string, Record<string, boolean>>
          profile_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_preferences_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      nurse_profiles_facility_view: {
        Row: {
          covid_vaccinated: boolean | null
          cpr_expiration: string | null
          created_at: string | null
          credential_type: string | null
          id: string | null
          iv_certified: boolean | null
          license_expiration: string | null
          license_number: string | null
          license_state: string | null
          license_status: string | null
          phone: string | null
          profile_id: string | null
          profile_photo_url: string | null
          tb_test_date: string | null
          updated_at: string | null
        }
        Insert: {
          covid_vaccinated?: boolean | null
          cpr_expiration?: string | null
          created_at?: string | null
          credential_type?: string | null
          id?: string | null
          iv_certified?: boolean | null
          license_expiration?: string | null
          license_number?: string | null
          license_state?: string | null
          license_status?: string | null
          phone?: string | null
          profile_id?: string | null
          profile_photo_url?: string | null
          tb_test_date?: string | null
          updated_at?: string | null
        }
        Update: {
          covid_vaccinated?: boolean | null
          cpr_expiration?: string | null
          created_at?: string | null
          credential_type?: string | null
          id?: string | null
          iv_certified?: boolean | null
          license_expiration?: string | null
          license_number?: string | null
          license_state?: string | null
          license_status?: string | null
          phone?: string | null
          profile_id?: string | null
          profile_photo_url?: string | null
          tb_test_date?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "nurse_profiles_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      get_my_agency_id: { Args: never; Returns: string }
      get_my_facility_id: { Args: never; Returns: string }
      get_my_nurse_profile_id: { Args: never; Returns: string }
      get_my_role: { Args: never; Returns: string }
      get_visible_credentials: {
        Args: { p_nurse_id: string }
        Returns: string[]
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
