"use client";

import React, {
  useEffect, useRef, useState, useCallback,
  forwardRef, useImperativeHandle
} from 'react';
import { Howl, Howler } from 'howler';
import dynamic from 'next/dynamic';
import { parseBlob } from 'music-metadata';
import './AudioPlayer.css';

const SiriWave = dynamic(() => import('./SiriWave'), { ssr: false });

interface Song {
  title: string;
  file: string;   // without extension, e.g. "horizon" -> /audio/horizon.mp3
  howl?: Howl;
}

interface TrackMeta {
  title?: string;
  artist?: string;
  album?: string;
  pictureUrl?: string; // object URL created from embedded artwork
}

interface AudioPlayerProps {
  playlist?: Song[];
  onTrackSelect?: (title: string) => void;
  isWaiting?: boolean;
}

// Methods the parent can call via ref
export type AudioPlayerHandle = {
  playByTitle: (title: string) => void;
};

const defaultPlaylist: Song[] = [];

const AudioPlayer = forwardRef<AudioPlayerHandle, AudioPlayerProps>(
({ playlist = defaultPlaylist, onTrackSelect, isWaiting = false }, ref) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [duration, setDuration] = useState('0:00');
  const [timer, setTimer] = useState('0:00');
  const [progress, setProgress] = useState(0);
  const [volume, setVolume] = useState(1);
  const [showPlaylist, setShowPlaylist] = useState(false);
  const [showVolume, setShowVolume] = useState(false);
  const [showWave, setShowWave] = useState(false);
  const [mounted, setMounted] = useState(false);

  // metadata state (keyed by song.file)
  const [metaByFile, setMetaByFile] = useState<Record<string, TrackMeta>>({});
  const createdObjectUrlsRef = useRef<string[]>([]);

  const waveformRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number>();
  const playlistRef = useRef<Song[]>(playlist);
  const rootRef = useRef<HTMLDivElement>(null);
  const timerIntervalRef = useRef<NodeJS.Timeout>();
  const currentTimeRef = useRef<number>(0);

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => { playlistRef.current = playlist; }, [playlist]);

  const formatTime = (secs: number): string => {
    const minutes = Math.floor(secs / 60) || 0;
    const seconds = Math.floor(secs - minutes * 60) || 0;
    return minutes + ':' + (seconds < 10 ? '0' : '') + seconds;
  };

  const startTimer = useCallback(() => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
    }

    timerIntervalRef.current = setInterval(() => {
      currentTimeRef.current += 1;
      setTimer(formatTime(currentTimeRef.current));

      // Calculate progress based on current time and total duration
      const sound = playlistRef.current[currentIndex]?.howl;
      if (sound && sound.duration()) {
        const progressPercent = (currentTimeRef.current / sound.duration()) * 100;
        setProgress(Math.min(progressPercent, 100));

        // Auto next track when reached end
        if (currentTimeRef.current >= sound.duration()) {
          if (timerIntervalRef.current) {
            clearInterval(timerIntervalRef.current);
            timerIntervalRef.current = undefined;
          }
          // We'll handle auto-next via the onend callback instead
        }
      }
    }, 1000);
  }, [currentIndex]);

  const stopTimer = useCallback(() => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = undefined;
    }
  }, []);

  const resetTimer = useCallback(() => {
    currentTimeRef.current = 0;
    setTimer('0:00');
    setProgress(0);
  }, []);

  // ---- Metadata extraction (incl. cover art) ----
  const extractMetadata = useCallback(async (mp3Url: string): Promise<TrackMeta> => {
    try {
      const res = await fetch(mp3Url);
      const blob = await res.blob();
      const mm = await parseBlob(blob);

      const pic = mm.common.picture?.[0];
      let pictureUrl: string | undefined;
      if (pic?.data) {
        const coverBlob = new Blob([pic.data as BlobPart], { type: pic.format || 'image/jpeg' });
        pictureUrl = URL.createObjectURL(coverBlob);
        createdObjectUrlsRef.current.push(pictureUrl);
      }

      return {
        title: mm.common.title,
        artist: mm.common.artist,
        album: mm.common.album,
        pictureUrl
      };
    } catch (e) {
      console.warn('Metadata parse failed for', mp3Url, e);
      return {};
    }
  }, []);

  // ---- Color helpers for artwork-driven theme ----
  function getDominantColor(url: string): Promise<{ r: number; g: number; b: number }> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) { reject(new Error('Canvas 2D not available')); return; }
        const w = 64, h = 64;
        canvas.width = w; canvas.height = h;
        ctx.drawImage(img, 0, 0, w, h);
        const { data } = ctx.getImageData(0, 0, w, h);
        let r = 0, g = 0, b = 0, count = 0;
        for (let i = 0; i < data.length; i += 16) { // sample every 4th pixel
          r += data[i]; g += data[i + 1]; b += data[i + 2];
          count++;
        }
        resolve({ r: Math.round(r / count), g: Math.round(g / count), b: Math.round(b / count) });
      };
      img.onerror = reject;
      img.src = url;
    });
  }
  function rgbToHsl(r: number, g: number, b: number) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0, l = (max + min) / 2;
    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) { case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        case b: h = (r - g) / d + 4; break; }
      h /= 6;
    }
    return { h, s, l };
  }
  function hslToRgb(h: number, s: number, l: number) {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1; if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };
    let r: number, g: number, b: number;
    if (s === 0) { r = g = b = l; }
    else {
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      r = hue2rgb(p, q, h + 1/3); g = hue2rgb(p, q, h); b = hue2rgb(p, q, h - 1/3);
    }
    return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255) };
  }
  function withLuminosity(rgb: {r:number;g:number;b:number}, deltaL: number) {
    const { h, s, l } = rgbToHsl(rgb.r, rgb.g, rgb.b);
    const l2 = Math.max(0, Math.min(1, l + deltaL));
    return hslToRgb(h, s, l2);
  }
  const rgbString = (c: {r:number;g:number;b:number}) => `rgb(${c.r}, ${c.g}, ${c.b})`;

  // ---- Load metadata for playlist ----
  useEffect(() => {
    let cancelled = false;

    // revoke previously created artwork URLs (prevents leaks when playlist changes)
    createdObjectUrlsRef.current.forEach(u => URL.revokeObjectURL(u));
    createdObjectUrlsRef.current = [];

    (async () => {
      const entries: Record<string, TrackMeta> = {};
      for (const s of playlistRef.current) {
        const url = `/audio/${s.file}.mp3`;
        const m = await extractMetadata(url);
        if (cancelled) return;
        entries[s.file] = m;
      }
      if (!cancelled) setMetaByFile(entries);
    })();

    return () => { cancelled = true; };
  }, [playlist, extractMetadata]);

  // ---- Play controls ----
  const play = useCallback((index?: number) => {
    const playIndex = typeof index === 'number' ? index : currentIndex;
    const data = playlistRef.current[playIndex];
    if (!data) return;

    let sound = data.howl;

    if (!sound) {
      setIsLoading(true);
      sound = data.howl = new Howl({
        src: [`/audio/${data.file}.mp3`],
        onplay: () => {
          setDuration(formatTime(Math.round(sound!.duration())));
          setIsPlaying(true);
          setIsLoading(false);
          setShowWave(true);
          startTimer();
        },
        onload: () => {
          setIsLoading(false);
          setShowWave(true);
          setDuration(formatTime(Math.round(sound!.duration())));
        },
        onend: () => {
          setIsPlaying(false);
          setShowWave(false);
          stopTimer();
          resetTimer();
          skip('next');
        },
        onstop: () => {
          setIsPlaying(false);
          setShowWave(false);
          stopTimer();
          resetTimer();
        }
      });
    }

    // Jukebox mode: only play, no pause
    if (!sound.playing()) {
      sound.play();
      // startTimer() sera appelé par le callback onplay
    }

    // Update duration for already loaded sounds
    if (sound.state() === 'loaded') {
      setDuration(formatTime(Math.round(sound.duration())));
    }

    setCurrentIndex(playIndex);
  }, [currentIndex]);


  const skip = useCallback((direction: 'next' | 'prev') => {
    let index = direction === 'prev' ? currentIndex - 1 : currentIndex + 1;
    if (index < 0) index = playlistRef.current.length - 1;
    if (index >= playlistRef.current.length) index = 0;
    skipTo(index);
  }, [currentIndex]);

  const skipTo = useCallback((index: number) => {
    const currentSound = playlistRef.current[currentIndex]?.howl;
    if (currentSound) currentSound.stop();
    stopTimer();
    resetTimer();
    setProgress(0);
    play(index);
  }, [currentIndex, play, stopTimer, resetTimer]);


  const handleVolumeChange = useCallback((vol: number) => {
    setVolume(vol);
    if (typeof Howler !== 'undefined') Howler.volume(vol);
  }, []);

  const togglePlaylist = () => setShowPlaylist(!showPlaylist);
  const toggleVolume   = () => setShowVolume(!showVolume);


  const handleVolumeClick = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    let percentage = (e.clientX - rect.left) / rect.width;

    // Snap to 0 if very close to the left edge (within 5% of the bar)
    if (percentage < 0.05) percentage = 0;
    // Snap to 1 if very close to the right edge (within 5% of the bar)
    if (percentage > 0.95) percentage = 1;

    handleVolumeChange(Math.min(1, Math.max(0, percentage)));
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      playlistRef.current.forEach(s => s.howl?.unload());
      createdObjectUrlsRef.current.forEach(u => URL.revokeObjectURL(u));
      createdObjectUrlsRef.current = [];
    };
  }, []);

  // ---- playByTitle (exposed to parent) ----
  const playByTitle = useCallback((title: string) => {
    const index = playlistRef.current.findIndex(
      s => s.title.toLowerCase() === title.toLowerCase()
    );
    if (index !== -1) {
      skipTo(index);
    } else {
      console.warn(`Track with title "${title}" not found in playlist`);
    }
  }, [skipTo]);

  useImperativeHandle(ref, () => ({ playByTitle }), [playByTitle]);

  const currentSong = playlistRef.current[currentIndex];
  const currentMeta: TrackMeta | undefined = currentSong ? metaByFile[currentSong.file] : undefined;
  const displayTitle = currentMeta?.title || currentSong?.title || '';
  const displayArtist = currentMeta?.artist;

  // ---- Recolor UI from artwork ----
  useEffect(() => {
    const artwork = currentMeta?.pictureUrl;
    const el = rootRef.current;
    if (!artwork || !el) return;
    (async () => {
      try {
        const base = await getDominantColor(artwork);
        const lighter = withLuminosity(base, +0.20);
        const darker  = withLuminosity(base, -0.20);
        el.style.setProperty('--bg1', rgbString(lighter));
        el.style.setProperty('--bg2', rgbString(darker));

        const perceived = 0.299*base.r + 0.587*base.g + 0.114*base.b;
        if (perceived > 200) {
          el.style.setProperty('--text', 'rgb(20,20,20)');
          el.style.setProperty('--text-dim', 'rgba(20,20,20,0.7)');
          el.style.setProperty('--bar', 'rgba(0,0,0,0.85)');
          el.style.setProperty('--progress', 'rgba(0,0,0,0.18)');
          el.style.setProperty('--overlay', 'rgba(0,0,0,0.35)');
          el.style.setProperty('--knob', 'rgba(0,0,0,0.75)');
        } else {
          el.style.setProperty('--text', '#ffffff');
          el.style.setProperty('--text-dim', 'rgba(255,255,255,0.7)');
          el.style.setProperty('--bar', 'rgba(255,255,255,0.9)');
          el.style.setProperty('--progress', 'rgba(0,0,0,0.12)');
          el.style.setProperty('--overlay', 'rgba(0,0,0,0.5)');
          el.style.setProperty('--knob', 'rgba(255,255,255,0.8)');
        }
      } catch {
        /* keep defaults */
      }
    })();
  }, [currentMeta?.pictureUrl]);

  // ====== CHAIN POLLING: reload every 5000ms and switch track if it changed ======

  // Replace this with your actual chain query.
  // Return a stable key to identify the track, ideally the `file` slug; title as fallback.
// Fetch current track from SUI blockchain via Next.js API
  async function fetchCurrentTrackFromChain(): Promise<{ file?: string; title?: string } | null> {
    try {
      const res = await fetch("/api/chain/current-track", {
        cache: "no-store",
        headers: { 'Cache-Control': 'no-cache' }
      });

      if (!res.ok) {
        console.warn('Chain API response not ok:', res.status);
        return null;
      }

      const data = await res.json();

      if (data.error) {
        console.warn('Chain API error:', data.error);
        return null;
      }

      // Return the track data from blockchain
      return {
        title: data.current_track || data.title,
        file: data.file
      };
    } catch (error) {
      console.warn('fetchCurrentTrackFromChain failed:', error);
      return null;
    }
  }

  // Keep last seen on-chain choice to detect changes.
  const lastChainTrackRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const tick = async () => {
      try {
        const now = await fetchCurrentTrackFromChain();
        if (cancelled || !now) return;

        const key = now.file || now.title;
        if (!key) return;

        if (key !== lastChainTrackRef.current) {
          lastChainTrackRef.current = key;

          // Try match by file first
          const byFileIdx = playlistRef.current.findIndex(s => s.file === key);
          if (byFileIdx !== -1) {
            skipTo(byFileIdx);
            return;
          }

          // Fallback: match by title (case-insensitive)
          const byTitleIdx = playlistRef.current.findIndex(
            s => s.title.toLowerCase() === key.toLowerCase()
          );
          if (byTitleIdx !== -1) {
            skipTo(byTitleIdx);
            return;
          }

          // Optional: if not found locally, refresh playlist from server here.
        }
      } catch (e) {
        console.warn("Chain poll failed:", e);
      }
    };

    // Run immediately, then every 5 seconds
    tick();
    const id = setInterval(tick, 5000);

    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [playlist, skipTo]);

  // ====== /CHAIN POLLING ======

  // Si la playlist est vide, afficher un message
  if (playlistRef.current.length === 0) {
    return (
      <div className="audio-player" ref={rootRef}>
        <div className="audio-player__empty">
          <div className="audio-player__empty-message">
            <h3>Playlist vide</h3>
            <p>Ajoutez des pistes avec le bouton "+ Add New Track" pour commencer à écouter de la musique.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="audio-player" ref={rootRef}>
      {/* Artwork */}
      {currentMeta?.pictureUrl && (
        <img
          className="audio-player__artwork"
          src={currentMeta.pictureUrl}
          alt={`${displayTitle} cover`}
        />
      )}

      {/* Top info */}
      <div className="audio-player__title">
        <span className="audio-player__track">
          {currentSong ? `${currentIndex + 1}. ${displayTitle}` : ''}
        </span>
        {displayArtist && (
          <span className="audio-player__artist"> — {displayArtist}</span>
        )}
        <div className="audio-player__timer">{timer}</div>
        <div className="audio-player__duration">{duration}</div>
      </div>

      {/* Controls */}
      <div className="audio-player__controls-outer">
        <div className="audio-player__controls-inner">
          {isLoading && <div className="audio-player__loading" />}
          {!isPlaying && !isLoading && (
            <div className="audio-player__btn audio-player__play-btn" onClick={() => play()} />
          )}
          {/* No pause button in jukebox mode - music plays until the end */}
        </div>
        <div className="audio-player__btn audio-player__playlist-btn" onClick={togglePlaylist} />
        <div className="audio-player__btn audio-player__volume-btn"   onClick={toggleVolume} />
      </div>

      {/* Progress / Wave */}
      <div className="audio-player__waveform" ref={waveformRef}>
        {showWave && mounted ? (
          <SiriWave
            width={typeof window !== 'undefined' ? window.innerWidth : 0}
            height={typeof window !== 'undefined' ? window.innerHeight * 0.3 : 0}
            cover
            speed={0.03}
            amplitude={0.7}
            frequency={2}
            autostart
          />
        ) : (
          <div className="audio-player__bar">
            <div className="audio-player__progress" style={{ width: `${progress}%` }} />
          </div>
        )}
      </div>

      {/* Playlist */}
      {showPlaylist && (
        <div className="audio-player__playlist" onClick={togglePlaylist}>
          <div className="audio-player__list">
            {playlistRef.current.map((song, i) => (
              <div
                key={i}
                className={`audio-player__list-song ${isWaiting ? 'waiting' : ''}`}
                onClick={(e) => {
                  e.stopPropagation();
                  if (onTrackSelect && !isWaiting) {
                    // Lancer la transaction blockchain pour changer de track
                    onTrackSelect(song.title);
                  } else if (!onTrackSelect) {
                    // Mode local uniquement (fallback)
                    skipTo(i);
                  }
                  setShowPlaylist(false);
                }}
                style={{
                  opacity: isWaiting ? 0.5 : 1,
                  cursor: isWaiting ? 'not-allowed' : 'pointer'
                }}
              >
                {metaByFile[song.file]?.title || song.title}
                {isWaiting && i === currentIndex && <span> (⏳ Transaction en cours...)</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Volume */}
      {showVolume && (
        <div className="audio-player__volume" onClick={toggleVolume}>
          <div className="audio-player__volume-controls" onClick={(e) => e.stopPropagation()}>
            <div className="audio-player__volume-bar-empty" onClick={handleVolumeClick}>
              <div className="audio-player__volume-bar-full" style={{ width: `${volume * 100}%` }} />
              <div className="audio-player__volume-slider" style={{ left: `${volume * 100}%` }} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

AudioPlayer.displayName = "AudioPlayer";
export default AudioPlayer;
