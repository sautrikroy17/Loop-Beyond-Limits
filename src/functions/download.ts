import { createServerFn } from "@tanstack/react-start";
import ytdl from "@distube/ytdl-core";

export const downloadAudioFn = createServerFn({ method: "GET" })
  .validator((data: { id: string }) => data)
  .handler(async ({ data }) => {
    try {
      const stream = ytdl(`https://youtube.com/watch?v=${data.id}`, {
        filter: "audioonly",
        quality: "highestaudio",
      });

      const chunks: Buffer[] = [];
      for await (const chunk of stream) {
        chunks.push(Buffer.from(chunk));
      }
      
      const buffer = Buffer.concat(chunks);
      return buffer.toString("base64");
    } catch (e: any) {
      console.error("[Download API] Error:", e.message);
      throw new Error("Failed to download audio");
    }
  });
