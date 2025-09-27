'use client'
import { useCurrentAccount } from "@mysten/dapp-kit";
import { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// Simple MP3 Player component replacing the Counter UI
// - Supports local file uploads (creates temporary Object URLs)
// - Allows adding tracks by URL
// - Basic controls: play/pause, next, prev, seek, volume
// - Minimal playlist view

interface Track {
  title: string;
  src: string; // URL or object URL
}

export default function App() {
  const currentAccount = useCurrentAccount();

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0); // seconds
  const [duration, setDuration] = useState(0); // seconds
  const [volume, setVolume] = useState(1); // 0..1
  const [urlInput, setUrlInput] = useState("");

  // Create a memoized current track
  const currentTrack = useMemo(() => tracks[currentIndex], [tracks, currentIndex]);

  useEffect(() => {
    if (!audioRef.current) return;
    audioRef.current.volume = volume;
  }, [volume]);

  // When the track list or index changes, load the new source
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !currentTrack) return;
    audio.src = currentTrack.src;
    audio.load();
    setProgress(0);
    // Autoplay if previously playing
    if (isPlaying) {
      audio.play().catch(() => setIsPlaying(false));
    }
  }, [currentTrack?.src]);

  const onLoadedMetadata = () => {
    const audio = audioRef.current;
    if (!audio) return;
    setDuration(audio.duration || 0);
  };

  const onTimeUpdate = () => {
    const audio = audioRef.current;
    if (!audio) return;
    setProgress(audio.currentTime || 0);
  };

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio || !currentTrack) return;
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
    }
  };

  const prevTrack = () => {
    if (tracks.length === 0) return;
    setCurrentIndex((i) => (i - 1 + tracks.length) % tracks.length);
  };

  const nextTrack = () => {
    if (tracks.length === 0) return;
    setCurrentIndex((i) => (i + 1) % tracks.length);
  };

  const onEnded = () => {
    nextTrack();
  };

  const onSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current;
    if (!audio) return;
    const value = Number(e.target.value);
    audio.currentTime = value;
    setProgress(value);
  };

  const onVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setVolume(Number(e.target.value));
  };

  const addUrlTrack = () => {
    const trimmed = urlInput.trim();
    if (!trimmed) return;
    const title = trimmed.split("/").pop() || "Track";
    setTracks((t) => [...t, { title, src: trimmed }]);
    setUrlInput("");
    if (tracks.length === 0) setCurrentIndex(0);
  };

  const onFilesSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).filter((f) => f.type === "audio/mpeg" || f.name.endsWith(".mp3"));
    if (files.length === 0) return;
    const newTracks: Track[] = files.map((f) => ({ title: f.name.replace(/\.[^/.]+$/, ""), src: URL.createObjectURL(f) }));
    setTracks((prev) => {
      const updated = [...prev, ...newTracks];
      if (prev.length === 0) setCurrentIndex(0);
      return updated;
    });
    // Reset the input value so the same file can be selected again if desired
    e.currentTarget.value = "";
  };

  // Format seconds as mm:ss
  const fmt = (s: number) => {
    if (!isFinite(s)) return "0:00";
    const m = Math.floor(s / 60);
    const ss = Math.floor(s % 60).toString().padStart(2, "0");
    return `${m}:${ss}`;
  };

  return (
    <div className="container mx-auto p-6 text-gray-900">
      <Card className="min-h-[500px]">
        <CardHeader>
          <CardTitle>Simple MP3 Player</CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          {currentAccount ? (
            <div className="space-y-6">
              {/* Uploader & URL adder */}
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <label className="block">
                  <span className="sr-only">Upload MP3 files</span>
                  <Input type="file" accept="audio/mpeg" multiple onChange={onFilesSelected} />
                </label>
                <div className="flex w-full gap-2">
                  <Input
                    placeholder="Paste an MP3 URL (https://...)"
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                  />
                  <Button onClick={addUrlTrack}>Add</Button>
                </div>
              </div>

              {/* Player */}
              <div className="rounded-2xl border p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm text-gray-500">Now Playing</div>
                    <div className="text-lg font-semibold">
                      {currentTrack ? currentTrack.title : "—"}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" onClick={prevTrack} disabled={tracks.length === 0}>
                      ⏮️ Prev
                    </Button>
                    <Button onClick={togglePlay} disabled={!currentTrack}>
                      {isPlaying ? "⏸️ Pause" : "▶️ Play"}
                    </Button>
                    <Button variant="outline" onClick={nextTrack} disabled={tracks.length === 0}>
                      Next ⏭️
                    </Button>
                  </div>
                </div>

                {/* Progress */}
                <div className="mt-4">
                  <input
                    type="range"
                    min={0}
                    max={Math.max(1, Math.floor(duration))}
                    step={1}
                    value={Math.floor(progress)}
                    onChange={onSeek}
                    className="w-full"
                  />
                  <div className="mt-1 flex items-center justify-between text-xs text-gray-500">
                    <span>{fmt(progress)}</span>
                    <span>{fmt(duration)}</span>
                  </div>
                </div>

                {/* Volume */}
                <div className="mt-4 flex items-center gap-3">
                  <span className="text-sm text-gray-900">Volume</span>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={volume}
                    onChange={onVolumeChange}
                    className="w-48"
                  />
                </div>

                {/* Hidden audio element */}
                <audio
                  ref={audioRef}
                  onLoadedMetadata={onLoadedMetadata}
                  onTimeUpdate={onTimeUpdate}
                  onEnded={onEnded}
                />
              </div>

              {/* Playlist */}
              <div>
                <div className="mb-2 text-sm font-medium text-gray-700">Playlist ({tracks.length})</div>
                {tracks.length === 0 ? (
                  <div className="rounded-md border p-4 text-sm text-gray-500">
                    Add MP3 files or paste a URL to get started.
                  </div>
                ) : (
                  <ul className="divide-y rounded-md border">
                    {tracks.map((t, i) => (
                      <li
                        key={`${t.src}-${i}`}
                        className={`flex cursor-pointer items-center justify-between p-3 hover:bg-gray-50 ${
                          i === currentIndex ? "bg-gray-100" : ""
                        }`}
                        onClick={() => setCurrentIndex(i)}
                      >
                        <span className="truncate pr-4">{t.title}</span>
                        {i === currentIndex && (
                          <span className="text-xs text-gray-900">Currently Selected</span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center py-12">
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Welcome to the MP3 Player</h2>
              <p className="text-gray-900">Please connect your wallet to start playing your tracks.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
