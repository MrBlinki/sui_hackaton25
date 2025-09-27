"use client";

import React, {
  useEffect, useRef, useState, useCallback,
  forwardRef, useImperativeHandle
} from 'react';
import { Howl, Howler } from 'howler';
import dynamic from 'next/dynamic';
import './AudioPlayer.css';

const SiriWave = dynamic(() => import('./SiriWave'), { ssr: false });

interface Song {
  title: string;
  file: string;
  howl?: Howl;
}

interface AudioPlayerProps {
  playlist?: Song[];
}

// 👇 This is the type of methods the parent can call via ref
export type AudioPlayerHandle = {
  playByTitle: (title: string) => void;
};

const defaultPlaylist: Song[] = [
  { title: 'Horizon', file: 'horizon' },
  { title: 'skelet',  file: 'inside_out' }
];

const AudioPlayer = forwardRef<AudioPlayerHandle, AudioPlayerProps>(
({ playlist = defaultPlaylist }, ref) => {
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

  const waveformRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number>();
  const playlistRef = useRef<Song[]>(playlist);

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => { playlistRef.current = playlist; }, [playlist]);

  const formatTime = (secs: number): string => {
    const minutes = Math.floor(secs / 60) || 0;
    const seconds = Math.floor(secs - minutes * 60) || 0;
    return minutes + ':' + (seconds < 10 ? '0' : '') + seconds;
  };

  const updateProgress = useCallback(() => {
    const sound = playlistRef.current[currentIndex]?.howl;
    if (sound && sound.playing()) {
      const seek = sound.seek() || 0;
      setTimer(formatTime(Math.round(seek)));
      setProgress(((seek / sound.duration()) * 100) || 0);
      animationRef.current = requestAnimationFrame(updateProgress);
    }
  }, [currentIndex]);

  const play = useCallback((index?: number) => {
    const playIndex = typeof index === 'number' ? index : currentIndex;
    const data = playlistRef.current[playIndex];
    if (!data) return;

    let sound = data.howl;

    if (!sound) {
      setIsLoading(true);
      sound = data.howl = new Howl({
        src: [`/audio/${data.file}.mp3`],
        html5: true,
        onplay: () => {
          setDuration(formatTime(Math.round(sound!.duration())));
          setIsPlaying(true);
          setIsLoading(false);
          setShowWave(true);
          animationRef.current = requestAnimationFrame(updateProgress);
        },
        onload: () => { setIsLoading(false); setShowWave(true); },
        onend: () => { setIsPlaying(false); setShowWave(false); skip('next'); },
        onpause: () => { setIsPlaying(false); setShowWave(false); },
        onstop:  () => { setIsPlaying(false); setShowWave(false); },
        onseek:  () => { animationRef.current = requestAnimationFrame(updateProgress); }
      });
    }

    sound.play();
    setCurrentIndex(playIndex);
  }, [currentIndex, updateProgress]);

  const pause = useCallback(() => {
    const sound = playlistRef.current[currentIndex]?.howl;
    if (sound) { sound.pause(); setIsPlaying(false); }
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
    setProgress(0);
    play(index);
  }, [currentIndex, play]);

  const seek = useCallback((percentage: number) => {
    const sound = playlistRef.current[currentIndex]?.howl;
    if (sound && sound.playing()) {
      sound.seek(sound.duration() * percentage);
    }
  }, [currentIndex]);

  const handleVolumeChange = useCallback((vol: number) => {
    setVolume(vol);
    if (typeof Howler !== 'undefined') Howler.volume(vol);
  }, []);

  const togglePlaylist = () => setShowPlaylist(!showPlaylist);
  const toggleVolume   = () => setShowVolume(!showVolume);

  const handleWaveformClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const percentage = (e.clientX - rect.left) / rect.width;
    seek(percentage);
  };

  const handleVolumeClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const percentage = (e.clientX - rect.left) / rect.width;
    handleVolumeChange(Math.min(1, Math.max(0, percentage)));
  };

  useEffect(() => {
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      playlistRef.current.forEach(s => s.howl?.unload());
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

  // 🔴 Expose methods to parent via ref
  useImperativeHandle(ref, () => ({
    playByTitle,
  }), [playByTitle]);

  const currentSong = playlistRef.current[currentIndex];

  return (
    <div className="audio-player">
      <div className="audio-player__title">
        <span className="audio-player__track">
          {currentSong ? `${currentIndex + 1}. ${currentSong.title}` : ''}
        </span>
        <div className="audio-player__timer">{timer}</div>
        <div className="audio-player__duration">{duration}</div>
      </div>

      <div className="audio-player__controls-outer">
        <div className="audio-player__controls-inner">
          {isLoading && <div className="audio-player__loading" />}

          {!isPlaying && !isLoading && (
            <div className="audio-player__btn audio-player__play-btn" onClick={() => play()} />
          )}
          {isPlaying && (
            <div className="audio-player__btn audio-player__pause-btn" onClick={pause} />
          )}
        </div>

        <div className="audio-player__btn audio-player__playlist-btn" onClick={togglePlaylist} />
        <div className="audio-player__btn audio-player__volume-btn"   onClick={toggleVolume} />
      </div>

      <div className="audio-player__waveform" ref={waveformRef} onClick={handleWaveformClick}>
        {showWave && mounted ? (
          <SiriWave
            width={window.innerWidth}
            height={window.innerHeight * 0.3}
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

      {showPlaylist && (
        <div className="audio-player__playlist" onClick={togglePlaylist}>
          <div className="audio-player__list">
            {playlistRef.current.map((song, i) => (
              <div
                key={i}
                className="audio-player__list-song"
                onClick={(e) => { e.stopPropagation(); skipTo(i); setShowPlaylist(false); }}
              >
                {song.title}
              </div>
            ))}
          </div>
        </div>
      )}

      {showVolume && (
        <div className="audio-player__volume" onClick={toggleVolume}>
          <div className="audio-player__volume-bar-empty" onClick={handleVolumeClick}>
            <div className="audio-player__volume-bar-full" style={{ width: `${volume * 100}%` }} />
            <div className="audio-player__volume-slider" style={{ left: `${volume * 100}%` }} />
          </div>
        </div>
      )}
    </div>
  );
});

AudioPlayer.displayName = "AudioPlayer";
export default AudioPlayer;
