export interface Database {
  public: {
    Tables: {
      tenants: {
        Row: {
          id: string;
          name: string;
          domain: string;
          status: "active" | "pending" | "suspended";
          plan: string;
          region: string;
          avatar_url: string | null;
          features: string[];
          branding: Record<string, any> | null;
          theme_settings: Record<string, any> | null;
          email_settings: Record<string, any> | null;
          custom_css: string | null;
          custom_domains: any[] | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          domain: string;
          status?: "active" | "pending" | "suspended";
          plan: string;
          region: string;
          avatar_url?: string | null;
          features?: string[];
          branding?: Record<string, any> | null;
          theme_settings?: Record<string, any> | null;
          email_settings?: Record<string, any> | null;
          custom_css?: string | null;
          custom_domains?: any[] | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          domain?: string;
          status?: "active" | "pending" | "suspended";
          plan?: string;
          region?: string;
          avatar_url?: string | null;
          features?: string[];
          branding?: Record<string, any> | null;
          theme_settings?: Record<string, any> | null;
          email_settings?: Record<string, any> | null;
          custom_css?: string | null;
          custom_domains?: any[] | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      roles: {
        Row: {
          id: string;
          name: string;
          description: string;
          coverage: string;
          max_seats: number;
          current_seats: number;
          permissions: string[];
          gradient: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description: string;
          coverage: string;
          max_seats: number;
          current_seats?: number;
          permissions: string[];
          gradient: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string;
          coverage?: string;
          max_seats?: number;
          current_seats?: number;
          permissions?: string[];
          gradient?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      users: {
        Row: {
          id: string;
          email: string;
          full_name: string;
          avatar_url: string | null;
          role_id: string | null;
          tenant_id: string | null;
          plan: string;
          status: "active" | "pending" | "suspended";
          last_active_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          email: string;
          full_name: string;
          avatar_url?: string | null;
          role_id?: string | null;
          tenant_id?: string | null;
          plan: string;
          status?: "active" | "pending" | "suspended";
          last_active_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          full_name?: string;
          avatar_url?: string | null;
          role_id?: string | null;
          tenant_id?: string | null;
          plan?: string;
          status?: "active" | "pending" | "suspended";
          last_active_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      workspaces: {
        Row: {
          id: string;
          tenant_id: string;
          name: string;
          slug: string;
          description: string | null;
          avatar_url: string | null;
          settings: Record<string, any>;
          status: "active" | "suspended" | "archived";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          name: string;
          slug: string;
          description?: string | null;
          avatar_url?: string | null;
          settings?: Record<string, any>;
          status?: "active" | "suspended" | "archived";
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          name?: string;
          slug?: string;
          description?: string | null;
          avatar_url?: string | null;
          settings?: Record<string, any>;
          status?: "active" | "suspended" | "archived";
          created_at?: string;
          updated_at?: string;
        };
      };
      workspace_users: {
        Row: {
          id: string;
          workspace_id: string;
          user_id: string;
          role_id: string | null;
          permissions: string[];
          joined_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          user_id: string;
          role_id?: string | null;
          permissions?: string[];
          joined_at?: string;
        };
        Update: {
          id?: string;
          workspace_id?: string;
          user_id?: string;
          role_id?: string | null;
          permissions?: string[];
          joined_at?: string;
        };
      };
      user_tenant_roles: {
        Row: {
          id: string;
          user_id: string;
          tenant_id: string;
          role_id: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          tenant_id: string;
          role_id: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          tenant_id?: string;
          role_id?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      integration_configs: {
        Row: {
          id: string;
          tenant_id: string;
          provider: string;
          category: string;
          credentials: Record<string, unknown>;
          settings: Record<string, unknown> | null;
          status: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          provider: string;
          category: string;
          credentials: Record<string, unknown>;
          settings?: Record<string, unknown> | null;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          provider?: string;
          category?: string;
          credentials?: Record<string, unknown>;
          settings?: Record<string, unknown> | null;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      stripe_customers: {
        Row: {
          id: string;
          tenant_id: string;
          user_id: string | null;
          stripe_customer_id: string;
          email: string;
          name: string | null;
          phone: string | null;
          address: Record<string, any> | null;
          metadata: Record<string, any>;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          user_id?: string | null;
          stripe_customer_id: string;
          email: string;
          name?: string | null;
          phone?: string | null;
          address?: Record<string, any> | null;
          metadata?: Record<string, any>;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          user_id?: string | null;
          stripe_customer_id?: string;
          email?: string;
          name?: string | null;
          phone?: string | null;
          address?: Record<string, any> | null;
          metadata?: Record<string, any>;
          created_at?: string;
          updated_at?: string;
        };
      };
      stripe_subscriptions: {
        Row: {
          id: string;
          tenant_id: string;
          stripe_customer_id: string;
          stripe_subscription_id: string;
          stripe_price_id: string;
          stripe_product_id: string;
          status: "active" | "canceled" | "past_due" | "unpaid" | "trialing" | "incomplete" | "incomplete_expired" | "paused";
          current_period_start: string;
          current_period_end: string;
          cancel_at_period_end: boolean;
          canceled_at: string | null;
          trial_start: string | null;
          trial_end: string | null;
          plan_name: string;
          plan_price: number;
          billing_cycle: "monthly" | "annual";
          currency: string;
          metadata: Record<string, any>;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          stripe_customer_id: string;
          stripe_subscription_id: string;
          stripe_price_id: string;
          stripe_product_id: string;
          status: "active" | "canceled" | "past_due" | "unpaid" | "trialing" | "incomplete" | "incomplete_expired" | "paused";
          current_period_start: string;
          current_period_end: string;
          cancel_at_period_end?: boolean;
          canceled_at?: string | null;
          trial_start?: string | null;
          trial_end?: string | null;
          plan_name: string;
          plan_price: number;
          billing_cycle: "monthly" | "annual";
          currency?: string;
          metadata?: Record<string, any>;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          stripe_customer_id?: string;
          stripe_subscription_id?: string;
          stripe_price_id?: string;
          stripe_product_id?: string;
          status?: "active" | "canceled" | "past_due" | "unpaid" | "trialing" | "incomplete" | "incomplete_expired" | "paused";
          current_period_start?: string;
          current_period_end?: string;
          cancel_at_period_end?: boolean;
          canceled_at?: string | null;
          trial_start?: string | null;
          trial_end?: string | null;
          plan_name?: string;
          plan_price?: number;
          billing_cycle?: "monthly" | "annual";
          currency?: string;
          metadata?: Record<string, any>;
          created_at?: string;
          updated_at?: string;
        };
      };
      stripe_payment_methods: {
        Row: {
          id: string;
          tenant_id: string;
          stripe_customer_id: string;
          stripe_payment_method_id: string;
          type: "card" | "bank_account" | "us_bank_account" | "sepa_debit";
          is_default: boolean;
          card_brand: string | null;
          card_last4: string | null;
          card_exp_month: number | null;
          card_exp_year: number | null;
          billing_details: Record<string, any>;
          metadata: Record<string, any>;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          stripe_customer_id: string;
          stripe_payment_method_id: string;
          type: "card" | "bank_account" | "us_bank_account" | "sepa_debit";
          is_default?: boolean;
          card_brand?: string | null;
          card_last4?: string | null;
          card_exp_month?: number | null;
          card_exp_year?: number | null;
          billing_details?: Record<string, any>;
          metadata?: Record<string, any>;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          stripe_customer_id?: string;
          stripe_payment_method_id?: string;
          type?: "card" | "bank_account" | "us_bank_account" | "sepa_debit";
          is_default?: boolean;
          card_brand?: string | null;
          card_last4?: string | null;
          card_exp_month?: number | null;
          card_exp_year?: number | null;
          billing_details?: Record<string, any>;
          metadata?: Record<string, any>;
          created_at?: string;
          updated_at?: string;
        };
      };
      stripe_invoices: {
        Row: {
          id: string;
          tenant_id: string;
          stripe_customer_id: string;
          stripe_subscription_id: string | null;
          stripe_invoice_id: string;
          invoice_number: string | null;
          status: "draft" | "open" | "paid" | "uncollectible" | "void";
          amount_due: number;
          amount_paid: number;
          subtotal: number;
          total: number;
          tax: number;
          currency: string;
          due_date: string | null;
          paid_at: string | null;
          invoice_pdf: string | null;
          invoice_hosted_url: string | null;
          line_items: any[];
          metadata: Record<string, any>;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          stripe_customer_id: string;
          stripe_subscription_id?: string | null;
          stripe_invoice_id: string;
          invoice_number?: string | null;
          status: "draft" | "open" | "paid" | "uncollectible" | "void";
          amount_due: number;
          amount_paid?: number;
          subtotal: number;
          total: number;
          tax?: number;
          currency?: string;
          due_date?: string | null;
          paid_at?: string | null;
          invoice_pdf?: string | null;
          invoice_hosted_url?: string | null;
          line_items?: any[];
          metadata?: Record<string, any>;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          stripe_customer_id?: string;
          stripe_subscription_id?: string | null;
          stripe_invoice_id?: string;
          invoice_number?: string | null;
          status?: "draft" | "open" | "paid" | "uncollectible" | "void";
          amount_due?: number;
          amount_paid?: number;
          subtotal?: number;
          total?: number;
          tax?: number;
          currency?: string;
          due_date?: string | null;
          paid_at?: string | null;
          invoice_pdf?: string | null;
          invoice_hosted_url?: string | null;
          line_items?: any[];
          metadata?: Record<string, any>;
          created_at?: string;
          updated_at?: string;
        };
      };
      stripe_payment_intents: {
        Row: {
          id: string;
          tenant_id: string;
          stripe_customer_id: string | null;
          stripe_payment_intent_id: string;
          amount: number;
          currency: string;
          status: "requires_payment_method" | "requires_confirmation" | "requires_action" | "processing" | "requires_capture" | "canceled" | "succeeded";
          payment_method_id: string | null;
          metadata: Record<string, any>;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          stripe_customer_id?: string | null;
          stripe_payment_intent_id: string;
          amount: number;
          currency?: string;
          status: "requires_payment_method" | "requires_confirmation" | "requires_action" | "processing" | "requires_capture" | "canceled" | "succeeded";
          payment_method_id?: string | null;
          metadata?: Record<string, any>;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          stripe_customer_id?: string | null;
          stripe_payment_intent_id?: string;
          amount?: number;
          currency?: string;
          status?: "requires_payment_method" | "requires_confirmation" | "requires_action" | "processing" | "requires_capture" | "canceled" | "succeeded";
          payment_method_id?: string | null;
          metadata?: Record<string, any>;
          created_at?: string;
          updated_at?: string;
        };
      };
      stripe_webhook_events: {
        Row: {
          id: string;
          stripe_event_id: string;
          event_type: string;
          livemode: boolean;
          processed: boolean;
          processed_at: string | null;
          event_data: Record<string, any>;
          error_message: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          stripe_event_id: string;
          event_type: string;
          livemode?: boolean;
          processed?: boolean;
          processed_at?: string | null;
          event_data: Record<string, any>;
          error_message?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          stripe_event_id?: string;
          event_type?: string;
          livemode?: boolean;
          processed?: boolean;
          processed_at?: string | null;
          event_data?: Record<string, any>;
          error_message?: string | null;
          created_at?: string;
        };
      };
      stripe_products: {
        Row: {
          id: string;
          stripe_product_id: string;
          name: string;
          description: string | null;
          active: boolean;
          metadata: Record<string, any>;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          stripe_product_id: string;
          name: string;
          description?: string | null;
          active?: boolean;
          metadata?: Record<string, any>;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          stripe_product_id?: string;
          name?: string;
          description?: string | null;
          active?: boolean;
          metadata?: Record<string, any>;
          created_at?: string;
          updated_at?: string;
        };
      };
      stripe_prices: {
        Row: {
          id: string;
          stripe_price_id: string;
          stripe_product_id: string;
          active: boolean;
          currency: string;
          unit_amount: number;
          billing_cycle: "monthly" | "annual";
          interval_count: number;
          metadata: Record<string, any>;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          stripe_price_id: string;
          stripe_product_id: string;
          active?: boolean;
          currency?: string;
          unit_amount: number;
          billing_cycle: "monthly" | "annual";
          interval_count?: number;
          metadata?: Record<string, any>;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          stripe_price_id?: string;
          stripe_product_id?: string;
          active?: boolean;
          currency?: string;
          unit_amount?: number;
          billing_cycle?: "monthly" | "annual";
          interval_count?: number;
          metadata?: Record<string, any>;
          created_at?: string;
          updated_at?: string;
        };
      };
    };
    audit_logs: {
      Row: {
        id: string;
        user_id: string;
        tenant_id: string | null;
        workspace_id: string | null;
        action: string;
        resource: string;
        permission: string;
        allowed: boolean;
        reason: string | null;
        metadata: Record<string, any>;
        ip_address: string | null;
        user_agent: string | null;
        created_at: string;
      };
      Insert: {
        id?: string;
        user_id: string;
        tenant_id?: string | null;
        workspace_id?: string | null;
        action: string;
        resource: string;
        permission: string;
        allowed?: boolean;
        reason?: string | null;
        metadata?: Record<string, any>;
        ip_address?: string | null;
        user_agent?: string | null;
        created_at?: string;
      };
      Update: {
        id?: string;
        user_id?: string;
        tenant_id?: string | null;
        workspace_id?: string | null;
        action?: string;
        resource?: string;
        permission?: string;
        allowed?: boolean;
        reason?: string | null;
        metadata?: Record<string, any>;
        ip_address?: string | null;
        user_agent?: string | null;
        created_at?: string;
      };
      chatbot_conversations: {
        Row: {
          id: string;
          tenant_id: string;
          user_id: string | null;
          title: string | null;
          metadata: Record<string, any>;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          user_id?: string | null;
          title?: string | null;
          metadata?: Record<string, any>;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          user_id?: string | null;
          title?: string | null;
          metadata?: Record<string, any>;
          created_at?: string;
          updated_at?: string;
        };
      };
      chatbot_messages: {
        Row: {
          id: string;
          conversation_id: string;
          tenant_id: string;
          role: 'user' | 'assistant' | 'system';
          content: string;
          metadata: Record<string, any>;
          created_at: string;
        };
        Insert: {
          id?: string;
          conversation_id: string;
          tenant_id: string;
          role: 'user' | 'assistant' | 'system';
          content: string;
          metadata?: Record<string, any>;
          created_at?: string;
        };
        Update: {
          id?: string;
          conversation_id?: string;
          tenant_id?: string;
          role?: 'user' | 'assistant' | 'system';
          content?: string;
          metadata?: Record<string, any>;
          created_at?: string;
        };
      };
      chatbot_knowledge_bases: {
        Row: {
          id: string;
          tenant_id: string;
          name: string;
          description: string | null;
          type: 'platform' | 'tenant' | 'domain';
          domain: 'auth' | 'multi-tenancy' | 'billing' | 'permissions' | 'database' | 'shared' | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          name: string;
          description?: string | null;
          type: 'platform' | 'tenant' | 'domain';
          domain?: 'auth' | 'multi-tenancy' | 'billing' | 'permissions' | 'database' | 'shared' | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          name?: string;
          description?: string | null;
          type?: 'platform' | 'tenant' | 'domain';
          domain?: 'auth' | 'multi-tenancy' | 'billing' | 'permissions' | 'database' | 'shared' | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      chatbot_documents: {
        Row: {
          id: string;
          knowledge_base_id: string;
          tenant_id: string;
          title: string;
          content: string;
          source: string;
          source_type: 'file' | 'url' | 'manual' | 'code';
          metadata: Record<string, any>;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          knowledge_base_id: string;
          tenant_id: string;
          title: string;
          content: string;
          source: string;
          source_type: 'file' | 'url' | 'manual' | 'code';
          metadata?: Record<string, any>;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          knowledge_base_id?: string;
          tenant_id?: string;
          title?: string;
          content?: string;
          source?: string;
          source_type?: 'file' | 'url' | 'manual' | 'code';
          metadata?: Record<string, any>;
          created_at?: string;
          updated_at?: string;
        };
      };
      chatbot_document_chunks: {
        Row: {
          id: string;
          document_id: string;
          tenant_id: string;
          content: string;
          chunk_index: number;
          metadata: Record<string, any>;
          created_at: string;
        };
        Insert: {
          id?: string;
          document_id: string;
          tenant_id: string;
          content: string;
          chunk_index: number;
          metadata?: Record<string, any>;
          created_at?: string;
        };
        Update: {
          id?: string;
          document_id?: string;
          tenant_id?: string;
          content?: string;
          chunk_index?: number;
          metadata?: Record<string, any>;
          created_at?: string;
        };
      };
      chatbot_embeddings: {
        Row: {
          id: string;
          chunk_id: string;
          document_id: string;
          knowledge_base_id: string;
          tenant_id: string;
          embedding: string; // JSON string of vector
          metadata: Record<string, any>;
          created_at: string;
        };
        Insert: {
          id?: string;
          chunk_id: string;
          document_id: string;
          knowledge_base_id: string;
          tenant_id: string;
          embedding: string; // JSON string of vector
          metadata?: Record<string, any>;
          created_at?: string;
        };
        Update: {
          id?: string;
          chunk_id?: string;
          document_id?: string;
          knowledge_base_id?: string;
          tenant_id?: string;
          embedding?: string;
          metadata?: Record<string, any>;
          created_at?: string;
        };
      };
    };
  };
}