import { createAPIFileRoute } from "@tanstack/react-start/api";
import ytdl from "@distube/ytdl-core";

export const APIRoute = createAPIFileRoute("/api/download")({
  GET: async ({ request }) => {
    const url = new URL(request.url);
    const id = url.searchParams.get("id");
    
    if (!id) {
      return new Response("Missing YouTube ID", { status: 400 });
    }

    try {
      // Stream directly from youtube
      const stream = ytdl(`https://youtube.com/watch?v=${id}`, {
        filter: "audioonly",
        quality: "highestaudio",
      });

      // Provide it as an mp4 audio attachment
      return new Response(stream as any, {
        headers: {
          "Content-Type": "audio/mp4",
          "Content-Disposition": `attachment; filename="track-${id}.mp4"`,
        },
      });
    } catch (error: any) {
      console.error("[Download API] Error:", error.message);
      return new Response("Failed to download audio", { status: 500 });
    }
  },
});
