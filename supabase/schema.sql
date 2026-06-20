-- ============================================================
-- Loop Music App — Supabase Cloud Sync Schema
-- Run this in your Supabase dashboard → SQL Editor
-- ============================================================

-- ── Liked Songs ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.liked_songs (
  id           uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  track_id     text        NOT NULL,
  track_data   jsonb       NOT NULL,
  created_at   timestamptz DEFAULT now(),
  CONSTRAINT liked_songs_unique UNIQUE (user_id, track_id)
);

-- ── Saved Albums ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.saved_albums (
  id           uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  album_id     text        NOT NULL,
  album_data   jsonb       NOT NULL,
  saved_at     timestamptz DEFAULT now(),
  CONSTRAINT saved_albums_unique UNIQUE (user_id, album_id)
);

-- ── Playlists ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.playlists (
  id           text        PRIMARY KEY,
  user_id      uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name         text        NOT NULL,
  description  text        DEFAULT '',
  cover_art    text,
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now()
);

-- ── Playlist Tracks ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.playlist_tracks (
  id           uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  playlist_id  text        NOT NULL REFERENCES public.playlists(id) ON DELETE CASCADE,
  track_id     text        NOT NULL,
  track_data   jsonb       NOT NULL,
  position     integer     NOT NULL DEFAULT 0,
  added_at     timestamptz DEFAULT now(),
  CONSTRAINT playlist_tracks_unique UNIQUE (playlist_id, track_id)
);

-- ── User Profiles (custom avatar, display name) ────────────────
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id             uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  avatar_url     text,
  display_name   text,
  top_artists    jsonb,
  top_genres     jsonb,
  mood_history   text,
  daily_mix      jsonb,
  daily_mix_date text,
  artist_weights jsonb,
  genre_weights  jsonb,
  events         jsonb,
  updated_at     timestamptz DEFAULT now()
);

-- ── Recently Played ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.recently_played (
  id           uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  track_id     text        NOT NULL,
  track_data   jsonb       NOT NULL,
  played_at    timestamptz DEFAULT now()
);

-- Keep only the 50 most recent plays per user (auto-cleanup trigger)
CREATE OR REPLACE FUNCTION public.trim_recently_played()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  DELETE FROM public.recently_played
  WHERE user_id = NEW.user_id
    AND id NOT IN (
      SELECT id FROM public.recently_played
      WHERE user_id = NEW.user_id
      ORDER BY played_at DESC
      LIMIT 50
    );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trim_recently_played_trigger ON public.recently_played;
CREATE TRIGGER trim_recently_played_trigger
  AFTER INSERT ON public.recently_played
  FOR EACH ROW EXECUTE FUNCTION public.trim_recently_played();

ALTER TABLE public.liked_songs       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_albums      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.playlists         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.playlist_tracks   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recently_played   ENABLE ROW LEVEL SECURITY;

-- Drop old policies if re-running
DROP POLICY IF EXISTS "own_liked"             ON public.liked_songs;
DROP POLICY IF EXISTS "own_saved_albums"      ON public.saved_albums;
DROP POLICY IF EXISTS "own_playlists"         ON public.playlists;
DROP POLICY IF EXISTS "own_playlist_tracks"   ON public.playlist_tracks;
DROP POLICY IF EXISTS "own_profile"           ON public.user_profiles;
DROP POLICY IF EXISTS "own_recently_played"   ON public.recently_played;

-- Users can only access their own rows
CREATE POLICY "own_liked" ON public.liked_songs
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "own_saved_albums" ON public.saved_albums
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "own_playlists" ON public.playlists
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "own_playlist_tracks" ON public.playlist_tracks
  FOR ALL
  USING   (playlist_id IN (SELECT id FROM public.playlists WHERE user_id = auth.uid()))
  WITH CHECK (playlist_id IN (SELECT id FROM public.playlists WHERE user_id = auth.uid()));

CREATE POLICY "own_profile" ON public.user_profiles
  FOR ALL USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE POLICY "own_recently_played" ON public.recently_played
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ── Storage Bucket for Avatars ────────────────────────────────
-- (Run separately if needed)
-- INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true)
-- ON CONFLICT DO NOTHING;

-- CREATE POLICY "avatar_upload" ON storage.objects
--   FOR INSERT WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

-- CREATE POLICY "avatar_read" ON storage.objects
--   FOR SELECT USING (bucket_id = 'avatars');

-- ── Supabase Realtime — REQUIRED for instant cross-device sync ────────
-- Run these in Supabase Dashboard → SQL Editor to enable real-time
-- postgres_changes on these tables (including DELETE events).
--
-- REPLICA IDENTITY FULL is required so DELETE events include the full
-- old row (otherwise you only get the PK, which we need for filtering).

ALTER TABLE public.liked_songs       REPLICA IDENTITY FULL;
ALTER TABLE public.playlists         REPLICA IDENTITY FULL;
ALTER TABLE public.playlist_tracks   REPLICA IDENTITY FULL;
ALTER TABLE public.saved_albums      REPLICA IDENTITY FULL;

-- Add tables to the Supabase Realtime publication
-- (supabase_realtime is the default publication Supabase uses)
ALTER PUBLICATION supabase_realtime ADD TABLE
  public.liked_songs,
  public.playlists,
  public.playlist_tracks,
  public.saved_albums;
