"use client";

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Howl } from 'howler';
import './SimpleAudioPlayer.css';

interface Song {
  title: string;
  file: string;
  howl?: Howl;
}

interface SimpleAudioPlayerProps {
  playlist?: Song[];
}

const defaultPlaylist: Song[] = [
  {
    title: 'Rave Digger',
    file: 'rave_digger'
  },
  {
    title: '80s Vibe', 
    file: '80s_vibe'
  },
  {
    title: 'Running Out',
    file: 'running_out'
  }
];

const SimpleAudioPlayer: React.FC<SimpleAudioPlayerProps> = ({ playlist = defaultPlaylist }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [duration, setDuration] = useState('0:00');
  const [timer, setTimer] = useState('0:00');
  const [progress, setProgress] = useState(0);
  const [volume, setVolume] = useState(1);
  const [showPlaylist, setShowPlaylist] = useState(false);
  const [showVolume, setShowVolume] = useState(false);
  
  const animationRef = useRef<number>();
  const playlistRef = useRef<Song[]>(playlist);
  
  useEffect(() => {
    playlistRef.current = playlist;
  }, [playlist]);

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
          animationRef.current = requestAnimationFrame(updateProgress);
        },
        onload: () => {
          setIsLoading(false);
        },
        onend: () => {
          setIsPlaying(false);
          skip('next');
        },
        onpause: () => {
          setIsPlaying(false);
        },
        onstop: () => {
          setIsPlaying(false);
        },
        onseek: () => {
          animationRef.current = requestAnimationFrame(updateProgress);
        }
      });
    }

    sound.play();
    setCurrentIndex(playIndex);
  }, [currentIndex, updateProgress]);

  const pause = useCallback(() => {
    const sound = playlistRef.current[currentIndex]?.howl;
    if (sound) {
      sound.pause();
      setIsPlaying(false);
    }
  }, [currentIndex]);

  const skip = useCallback((direction: 'next' | 'prev') => {
    let index = 0;
    if (direction === 'prev') {
      index = currentIndex - 1;
      if (index < 0) {
        index = playlistRef.current.length - 1;
      }
    } else {
      index = currentIndex + 1;
      if (index >= playlistRef.current.length) {
        index = 0;
      }
    }
    skipTo(index);
  }, [currentIndex]);

  const skipTo = useCallback((index: number) => {
    const currentSound = playlistRef.current[currentIndex]?.howl;
    if (currentSound) {
      currentSound.stop();
    }
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
    if (typeof Howler !== 'undefined') {
      Howler.volume(vol);
    }
  }, []);

  const handleProgressClick = (event: React.MouseEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const percentage = (event.clientX - rect.left) / rect.width;
    seek(percentage);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      playlistRef.current.forEach(song => {
        if (song.howl) {
          song.howl.unload();
        }
      });
    };
  }, []);

  const currentSong = playlistRef.current[currentIndex];

  return (
    <div className="simple-audio-player">
      {/* Header */}
      <div className="simple-audio-player__header">
        <h1 className="simple-audio-player__title">🎵 Lecteur Audio</h1>
        <div className="simple-audio-player__track-info">
          <div className="simple-audio-player__track-name">
            {currentSong ? `${currentIndex + 1}. ${currentSong.title}` : 'Aucune piste'}
          </div>
          <div className="simple-audio-player__time-info">
            <span className="simple-audio-player__timer">{timer}</span>
            <span className="simple-audio-player__separator"> / </span>
            <span className="simple-audio-player__duration">{duration}</span>
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="simple-audio-player__progress-container" onClick={handleProgressClick}>
        <div className="simple-audio-player__progress-bar">
          <div 
            className="simple-audio-player__progress-fill" 
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Controls */}
      <div className="simple-audio-player__controls">
        <button 
          className="simple-audio-player__btn simple-audio-player__btn--prev"
          onClick={() => skip('prev')}
          title="Piste précédente"
        >
          ⏮
        </button>
        
        {isLoading ? (
          <div className="simple-audio-player__loading">⏳</div>
        ) : !isPlaying ? (
          <button 
            className="simple-audio-player__btn simple-audio-player__btn--play"
            onClick={() => play()}
            title="Jouer"
          >
            ▶️
          </button>
        ) : (
          <button 
            className="simple-audio-player__btn simple-audio-player__btn--pause"
            onClick={pause}
            title="Pause"
          >
            ⏸️
          </button>
        )}
        
        <button 
          className="simple-audio-player__btn simple-audio-player__btn--next"
          onClick={() => skip('next')}
          title="Piste suivante"
        >
          ⏭
        </button>
        
        <button 
          className="simple-audio-player__btn simple-audio-player__btn--playlist"
          onClick={() => setShowPlaylist(!showPlaylist)}
          title="Playlist"
        >
          📋
        </button>
        
        <button 
          className="simple-audio-player__btn simple-audio-player__btn--volume"
          onClick={() => setShowVolume(!showVolume)}
          title="Volume"
        >
          🔊
        </button>
      </div>

      {/* Playlist */}
      {showPlaylist && (
        <div className="simple-audio-player__playlist">
          <h3>Playlist</h3>
          <div className="simple-audio-player__playlist-items">
            {playlistRef.current.map((song, index) => (
              <div
                key={index}
                className={`simple-audio-player__playlist-item ${index === currentIndex ? 'active' : ''}`}
                onClick={() => {
                  skipTo(index);
                  setShowPlaylist(false);
                }}
              >
                <span className="simple-audio-player__playlist-number">{index + 1}.</span>
                <span className="simple-audio-player__playlist-title">{song.title}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Volume */}
      {showVolume && (
        <div className="simple-audio-player__volume">
          <h3>Volume</h3>
          <div className="simple-audio-player__volume-slider">
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={volume}
              onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
            />
            <span>{Math.round(volume * 100)}%</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default SimpleAudioPlayer;