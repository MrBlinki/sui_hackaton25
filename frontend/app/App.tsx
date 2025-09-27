'use client';

import { useEffect, useRef, useState } from "react";
import { SuiClient, getFullnodeUrl } from "@mysten/sui/client";
import { DEVNET_JUKEBOX_OBJECT_ID } from "@/constants";

// 👇 import the player, its handle type, and (optionally) pass a playlist
import AudioPlayer, { AudioPlayerHandle } from "@/components/AudioPlayer";

// Example local playlist the player can use (titles must match on-chain value)
const PLAYLIST = [
  { title: 'Horizon', file: 'horizon' },
  { title: 'skelet',  file: 'inside_out' },
  { title: 'Hello Song', file: 'hello' },
];

const client = new SuiClient({ url: getFullnodeUrl("devnet") });

export default function App() {
  const [currentTrack, setCurrentTrack] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 👇 ref to call methods on the player
  const playerRef = useRef<AudioPlayerHandle>(null);

  useEffect(() => {
    let interval: NodeJS.Timeout;

    const fetchCurrentTrack = async () => {
      try {
        const res = await client.getObject({
          id: DEVNET_JUKEBOX_OBJECT_ID,
          options: { showContent: true },
        });

        if (!res.data || res.data.content?.dataType !== "moveObject") {
          setError("Object not found or not a Move object");
          return;
        }

        const fields = (res.data.content as any).fields;
        setCurrentTrack(fields.current_track as string);
      } catch (e: any) {
        console.error(e);
        setError(e.message);
      }
    };

    // Fetch immediately, then every 5 seconds
    fetchCurrentTrack();
    interval = setInterval(fetchCurrentTrack, 5000);

    // Cleanup on unmount
    return () => clearInterval(interval);
  }, []);


  // Try to auto-play when currentTrack arrives.
  // NOTE: Most browsers block autoplay with sound until a user gesture.
  // If it's blocked, we also render a button below to trigger it manually.
  useEffect(() => {
    if (currentTrack && playerRef.current) {
      playerRef.current.playByTitle(currentTrack);
    }
  }, [currentTrack]);

  return (
    <div className="p-4 bg-white text-black">
      <h1 className="text-xl font-bold">On-Chain Jukebox</h1>

      {error && <p className="text-red-600">Error: {error}</p>}
      {!error && !currentTrack && <p>Loading…</p>}
      {currentTrack && <p>Current Track (from chain): {currentTrack}</p>}

      {/* The audio player; pass the same playlist that contains those titles */}
      <div className="mt-4">
        <AudioPlayer ref={playerRef} playlist={PLAYLIST} />
      </div>

      {/* Fallback play button for browsers that block autoplay */}
      {currentTrack && (
        <button
          className="mt-4 px-4 py-2 rounded bg-black text-white"
          onClick={() => playerRef.current?.playByTitle(currentTrack)}
        >
          ▶ Play on-chain track
        </button>
      )}
    </div>
  );
}
