// =============================================================================
// La La Sweett Sales System — Supabase Database Types
// Auto-generated type definitions matching the PostgreSQL schema
// =============================================================================

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type OrderState =
  | 'Inquiry'
  | 'Quoted'
  | 'Deposit_Received'
  | 'Confirmed'
  | 'In_Production'
  | 'Ready'
  | 'Delivered'
  | 'Picked_Up'
  | 'Cancelled';

export type Channel = 'whatsapp' | 'instagram' | 'chat_widget';

export type ConversationStatus = 'active' | 'resolved' | 'escalated';

export type MessageRole = 'customer' | 'assistant';

export type EscalationStatus = 'pending' | 'in_progress' | 'resolved' | 'dismissed';

export type DeliveryPreference = 'delivery' | 'pickup';

export type RecipientType = 'owner' | 'customer';

export type NotificationStatus = 'pending' | 'delivered' | 'failed' | 'queued';

export interface Database {
  public: {
    Tables: {
      customers: {
        Row: {
          id: string;
          name: string;
          email: string;
          phone: string;
          delivery_address: string | null;
          marketing_consent: boolean;
          consent_timestamp: string | null;
          consent_channel: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          email: string;
          phone: string;
          delivery_address?: string | null;
          marketing_consent?: boolean;
          consent_timestamp?: string | null;
          consent_channel?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          email?: string;
          phone?: string;
          delivery_address?: string | null;
          marketing_consent?: boolean;
          consent_timestamp?: string | null;
          consent_channel?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      categories: {
        Row: {
          id: string;
          name: string;
          slug: string;
          description: string;
          sort_order: number;
          active: boolean;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          description?: string;
          sort_order?: number;
          active?: boolean;
        };
        Update: {
          id?: string;
          name?: string;
          slug?: string;
          description?: string;
          sort_order?: number;
          active?: boolean;
        };
      };
      products: {
        Row: {
          id: string;
          category_id: string;
          name: string;
          description_short: string;
          price_min: number;
          price_max: number;
          min_servings: number;
          max_servings: number;
          lead_time_days: number;
          image_url: string;
          allergen_tags: Json;
          structured_data: Json;
          active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          category_id: string;
          name: string;
          description_short?: string;
          price_min: number;
          price_max: number;
          min_servings: number;
          max_servings: number;
          lead_time_days: number;
          image_url?: string;
          allergen_tags?: Json;
          structured_data?: Json;
          active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          category_id?: string;
          name?: string;
          description_short?: string;
          price_min?: number;
          price_max?: number;
          min_servings?: number;
          max_servings?: number;
          lead_time_days?: number;
          image_url?: string;
          allergen_tags?: Json;
          structured_data?: Json;
          active?: boolean;
          created_at?: string;
        };
      };
      product_flavors: {
        Row: {
          id: string;
          product_id: string;
          flavor_name: string;
          available: boolean;
        };
        Insert: {
          id?: string;
          product_id: string;
          flavor_name: string;
          available?: boolean;
        };
        Update: {
          id?: string;
          product_id?: string;
          flavor_name?: string;
          available?: boolean;
        };
      };
      orders: {
        Row: {
          id: string;
          customer_id: string;
          state: OrderState;
          event_date: string;
          servings: number;
          flavor_preference: string;
          design_description: string;
          budget_range: string;
          quoted_price: number | null;
          deposit_amount: number | null;
          delivery_preference: DeliveryPreference | null;
          delivery_address: string | null;
          originating_channel: Channel;
          cancellation_reason: string | null;
          refund_flagged: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          customer_id: string;
          state?: OrderState;
          event_date: string;
          servings: number;
          flavor_preference?: string;
          design_description?: string;
          budget_range?: string;
          quoted_price?: number | null;
          deposit_amount?: number | null;
          delivery_preference?: DeliveryPreference | null;
          delivery_address?: string | null;
          originating_channel: Channel;
          cancellation_reason?: string | null;
          refund_flagged?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          customer_id?: string;
          state?: OrderState;
          event_date?: string;
          servings?: number;
          flavor_preference?: string;
          design_description?: string;
          budget_range?: string;
          quoted_price?: number | null;
          deposit_amount?: number | null;
          delivery_preference?: DeliveryPreference | null;
          delivery_address?: string | null;
          originating_channel?: Channel;
          cancellation_reason?: string | null;
          refund_flagged?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      order_state_transitions: {
        Row: {
          id: string;
          order_id: string;
          from_state: string;
          to_state: string;
          triggered_by: string;
          metadata: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          order_id: string;
          from_state: string;
          to_state: string;
          triggered_by: string;
          metadata?: Json | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          order_id?: string;
          from_state?: string;
          to_state?: string;
          triggered_by?: string;
          metadata?: Json | null;
          created_at?: string;
        };
      };
      conversations: {
        Row: {
          id: string;
          customer_id: string;
          channel: Channel;
          session_id: string;
          intent_tags: string[];
          status: ConversationStatus;
          started_at: string;
          last_activity_at: string;
        };
        Insert: {
          id?: string;
          customer_id: string;
          channel: Channel;
          session_id: string;
          intent_tags?: string[];
          status?: ConversationStatus;
          started_at?: string;
          last_activity_at?: string;
        };
        Update: {
          id?: string;
          customer_id?: string;
          channel?: Channel;
          session_id?: string;
          intent_tags?: string[];
          status?: ConversationStatus;
          started_at?: string;
          last_activity_at?: string;
        };
      };
      messages: {
        Row: {
          id: string;
          conversation_id: string;
          role: MessageRole;
          content: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          conversation_id: string;
          role: MessageRole;
          content: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          conversation_id?: string;
          role?: MessageRole;
          content?: string;
          created_at?: string;
        };
      };
      escalations: {
        Row: {
          id: string;
          conversation_id: string;
          reason: string;
          context_summary: string;
          originating_channel: Channel;
          status: EscalationStatus;
          created_at: string;
          resolved_at: string | null;
        };
        Insert: {
          id?: string;
          conversation_id: string;
          reason: string;
          context_summary: string;
          originating_channel: Channel;
          status?: EscalationStatus;
          created_at?: string;
          resolved_at?: string | null;
        };
        Update: {
          id?: string;
          conversation_id?: string;
          reason?: string;
          context_summary?: string;
          originating_channel?: Channel;
          status?: EscalationStatus;
          created_at?: string;
          resolved_at?: string | null;
        };
      };
      consent_records: {
        Row: {
          id: string;
          customer_id: string;
          consent_type: string;
          granted: boolean;
          channel: string;
          recorded_at: string;
        };
        Insert: {
          id?: string;
          customer_id: string;
          consent_type: string;
          granted: boolean;
          channel: string;
          recorded_at?: string;
        };
        Update: {
          id?: string;
          customer_id?: string;
          consent_type?: string;
          granted?: boolean;
          channel?: string;
          recorded_at?: string;
        };
      };
      marketing_channels: {
        Row: {
          id: string;
          name: string;
          monthly_budget: number;
          channel_type: string;
        };
        Insert: {
          id?: string;
          name: string;
          monthly_budget?: number;
          channel_type: string;
        };
        Update: {
          id?: string;
          name?: string;
          monthly_budget?: number;
          channel_type?: string;
        };
      };
      marketing_attributions: {
        Row: {
          id: string;
          customer_id: string;
          channel_id: string;
          referral_source: string;
          first_interaction: string;
          attributed_at: string;
        };
        Insert: {
          id?: string;
          customer_id: string;
          channel_id: string;
          referral_source?: string;
          first_interaction?: string;
          attributed_at?: string;
        };
        Update: {
          id?: string;
          customer_id?: string;
          channel_id?: string;
          referral_source?: string;
          first_interaction?: string;
          attributed_at?: string;
        };
      };
      notifications: {
        Row: {
          id: string;
          type: string;
          recipient_type: RecipientType;
          recipient_id: string;
          content: string;
          actions: Json | null;
          status: NotificationStatus;
          retry_count: number;
          created_at: string;
          delivered_at: string | null;
        };
        Insert: {
          id?: string;
          type: string;
          recipient_type: RecipientType;
          recipient_id: string;
          content: string;
          actions?: Json | null;
          status?: NotificationStatus;
          retry_count?: number;
          created_at?: string;
          delivered_at?: string | null;
        };
        Update: {
          id?: string;
          type?: string;
          recipient_type?: RecipientType;
          recipient_id?: string;
          content?: string;
          actions?: Json | null;
          status?: NotificationStatus;
          retry_count?: number;
          created_at?: string;
          delivered_at?: string | null;
        };
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}
