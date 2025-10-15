export interface Database {
  public: {
    Tables: {
      events: {
        Row: {
          id: string;
          name: string;
          description: string;
          sheet_id: string | null;
          max_team_size: number;
          is_active: boolean;
          registration_deadline: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string;
          sheet_id?: string | null;
          max_team_size?: number;
          is_active?: boolean;
          registration_deadline?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string;
          sheet_id?: string | null;
          max_team_size?: number;
          is_active?: boolean;
          registration_deadline?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      problem_statements: {
        Row: {
          id: string;
          title: string;
          description: string;
          event_id: string;
          sheet_tab_name: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          description?: string;
          event_id: string;
          sheet_tab_name?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          description?: string;
          event_id?: string;
          sheet_tab_name?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      registrations: {
        Row: {
          id: string;
          event_id: string;
          problem_statement_id: string;
          data: Record<string, any>;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          event_id: string;
          problem_statement_id: string;
          data?: Record<string, any>;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          event_id?: string;
          problem_statement_id?: string;
          data?: Record<string, any>;
          created_at?: string;
          updated_at?: string;
        };
      };
    };
  };
}