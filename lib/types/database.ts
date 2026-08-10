// Reações com emoji: emoji -> lista de participantIds que reagiram
export type Reactions = Record<string, string[]>

// Snapshot data interfaces for board_snapshots JSONB
export interface SnapshotCard {
  id: string
  column_type: "good" | "bad" | "ideas"
  text: string
  author: string
  author_id: string
  votes: number
  voters: string[]
  group_id?: string | null
  group_label?: string | null
  reactions?: Reactions
  created_at: string
}

export interface SnapshotActionCard {
  id: string
  text: string
  responsible: string | null
  author: string
  author_id: string
  created_at: string
}

export interface SnapshotData {
  cards: SnapshotCard[]
  actionCards: SnapshotActionCard[]
}

export type Database = {
  public: {
    Tables: {
      sessions: {
        Row: {
          token: string
          created_at: string
          updated_at: string
          timer_status: 'configuring' | 'running' | 'paused' | 'finished'
          timer_minutes: number
          timer_ends_at: string | null
          timer_remaining_seconds: number | null
          cards_revealed: boolean
        }
        Insert: {
          token: string
          created_at?: string
          updated_at?: string
          timer_status?: 'configuring' | 'running' | 'paused' | 'finished'
          timer_minutes?: number
          timer_ends_at?: string | null
          timer_remaining_seconds?: number | null
          cards_revealed?: boolean
        }
        Update: {
          token?: string
          created_at?: string
          updated_at?: string
          timer_status?: 'configuring' | 'running' | 'paused' | 'finished'
          timer_minutes?: number
          timer_ends_at?: string | null
          timer_remaining_seconds?: number | null
          cards_revealed?: boolean
        }
      }
      cards: {
        Row: {
          id: string
          session_token: string
          column_type: 'good' | 'bad' | 'ideas'
          text: string
          author: string
          author_id: string
          votes: number
          voters: string[]
          group_id: string | null
          group_label: string | null
          reactions: Reactions
          created_at: string
        }
        Insert: {
          id?: string
          session_token: string
          column_type: 'good' | 'bad' | 'ideas'
          text: string
          author: string
          author_id: string
          votes?: number
          voters?: string[]
          group_id?: string | null
          group_label?: string | null
          reactions?: Reactions
          created_at?: string
        }
        Update: {
          id?: string
          session_token?: string
          column_type?: 'good' | 'bad' | 'ideas'
          text?: string
          author?: string
          author_id?: string
          votes?: number
          voters?: string[]
          group_id?: string | null
          group_label?: string | null
          reactions?: Reactions
          created_at?: string
        }
      }
      action_cards: {
        Row: {
          id: string
          session_token: string
          text: string
          responsible: string | null
          author: string
          author_id: string
          created_at: string
        }
        Insert: {
          id?: string
          session_token: string
          text: string
          responsible?: string | null
          author: string
          author_id: string
          created_at?: string
        }
        Update: {
          id?: string
          session_token?: string
          text?: string
          responsible?: string | null
          author?: string
          author_id?: string
          created_at?: string
        }
      }
      suggestions: {
        Row: {
          id: string
          session_token: string
          text: string
          responsible: string | null
          status: 'pending' | 'approved' | 'rejected'
          created_at: string
        }
        Insert: {
          id?: string
          session_token: string
          text: string
          responsible?: string | null
          status?: 'pending' | 'approved' | 'rejected'
          created_at?: string
        }
        Update: {
          id?: string
          session_token?: string
          text?: string
          responsible?: string | null
          status?: 'pending' | 'approved' | 'rejected'
          created_at?: string
        }
      }
      prev_actions: {
        Row: {
          id: string
          session_token: string
          text: string
          responsible: string | null
          done: boolean
          created_at: string
        }
        Insert: {
          id?: string
          session_token: string
          text: string
          responsible?: string | null
          done?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          session_token?: string
          text?: string
          responsible?: string | null
          done?: boolean
          created_at?: string
        }
      }
      board_snapshots: {
        Row: {
          id: string
          session_token: string
          reference_date: string
          snapshot_data: SnapshotData
          created_at: string
        }
        Insert: {
          id?: string
          session_token: string
          reference_date: string
          snapshot_data: SnapshotData
          created_at?: string
        }
        Update: {
          id?: string
          session_token?: string
          reference_date?: string
          snapshot_data?: SnapshotData
          created_at?: string
        }
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
  }
}

// Convenience types
export type Session = Database['public']['Tables']['sessions']['Row']
export type Card = Database['public']['Tables']['cards']['Row']
export type ActionCard = Database['public']['Tables']['action_cards']['Row']
export type Suggestion = Database['public']['Tables']['suggestions']['Row']
export type PrevAction = Database['public']['Tables']['prev_actions']['Row']
export type BoardSnapshot = Database['public']['Tables']['board_snapshots']['Row']

export type ColumnType = 'good' | 'bad' | 'ideas' | 'actions'
export type TimerStatus = 'configuring' | 'running' | 'paused' | 'finished'

// Participant type for presence
export type Participant = {
  id: string
  name: string
  online_at: string
}

// Realtime event types
export type RealtimeEvent = 
  | { type: 'card_added'; payload: Card }
  | { type: 'card_updated'; payload: Card }
  | { type: 'cards_updated'; payload: Card[] }
  | { type: 'card_deleted'; payload: { id: string } }
  | { type: 'action_added'; payload: ActionCard }
  | { type: 'action_updated'; payload: ActionCard }
  | { type: 'action_deleted'; payload: { id: string } }
  | { type: 'timer_update'; payload: Partial<Session> }
  | { type: 'suggestion_added'; payload: Suggestion }
  | { type: 'suggestion_updated'; payload: Suggestion }
  | { type: 'prev_action_updated'; payload: PrevAction }
  | { type: 'retro_closed'; payload: { prevActions: PrevAction[] } }
