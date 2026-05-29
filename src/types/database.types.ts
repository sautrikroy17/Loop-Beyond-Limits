export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      user_profiles: {
        Row: {
          id: string;
          username: string | null;
          avatar_url: string | null;
          bio: string | null;
          listening_status: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          username?: string | null;
          avatar_url?: string | null;
          bio?: string | null;
          listening_status?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          username?: string | null;
          avatar_url?: string | null;
          bio?: string | null;
          listening_status?: string | null;
          created_at?: string;
        };
      };
      playlists: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          description: string | null;
          cover_url: string | null;
          is_collaborative: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          description?: string | null;
          cover_url?: string | null;
          is_collaborative?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          title?: string;
          description?: string | null;
          cover_url?: string | null;
          is_collaborative?: boolean;
          created_at?: string;
        };
      };
      playlist_tracks: {
        Row: {
          id: string;
          playlist_id: string;
          spotify_id: string;
          youtube_id: string | null;
          added_at: string;
        };
        Insert: {
          id?: string;
          playlist_id: string;
          spotify_id: string;
          youtube_id?: string | null;
          added_at?: string;
        };
        Update: {
          id?: string;
          playlist_id?: string;
          spotify_id?: string;
          youtube_id?: string | null;
          added_at?: string;
        };
      };
      liked_songs: {
        Row: {
          user_id: string;
          spotify_id: string;
          youtube_id: string | null;
          added_at: string;
        };
        Insert: {
          user_id: string;
          spotify_id: string;
          youtube_id?: string | null;
          added_at?: string;
        };
        Update: {
          user_id?: string;
          spotify_id?: string;
          youtube_id?: string | null;
          added_at?: string;
        };
      };
      recently_played: {
        Row: {
          id: string;
          user_id: string;
          spotify_id: string;
          youtube_id: string | null;
          played_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          spotify_id: string;
          youtube_id?: string | null;
          played_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          spotify_id?: string;
          youtube_id?: string | null;
          played_at?: string;
        };
      };
    };
  };
}
