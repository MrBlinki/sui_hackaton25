"use client";

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Howl } from 'howler';
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

const AudioPlayer: React.FC<AudioPlayerProps> = ({ playlist = defaultPlaylist }) => {
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
  
  useEffect(() => {
    setMounted(true);
  }, []);
  
  // Update playlist ref when prop changes
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
          setShowWave(true);
          animationRef.current = requestAnimationFrame(updateProgress);
        },
        onload: () => {
          setIsLoading(false);
          setShowWave(true);
        },
        onend: () => {
          setIsPlaying(false);
          setShowWave(false);
          skip('next');
        },
        onpause: () => {
          setIsPlaying(false);
          setShowWave(false);
        },
        onstop: () => {
          setIsPlaying(false);
          setShowWave(false);
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

  const togglePlaylist = () => {
    setShowPlaylist(!showPlaylist);
  };

  const toggleVolume = () => {
    setShowVolume(!showVolume);
  };

  const handleWaveformClick = (event: React.MouseEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const percentage = (event.clientX - rect.left) / rect.width;
    seek(percentage);
  };

  const handleVolumeClick = (event: React.MouseEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const percentage = (event.clientX - rect.left) / rect.width;
    handleVolumeChange(Math.min(1, Math.max(0, percentage)));
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
    <div className="audio-player">
      {/* Top Info */}
      <div className="audio-player__title">
        <span className="audio-player__track">
          {currentSong ? `${currentIndex + 1}. ${currentSong.title}` : ''}
        </span>
        <div className="audio-player__timer">{timer}</div>
        <div className="audio-player__duration">{duration}</div>
      </div>

      {/* Controls */}
      <div className="audio-player__controls-outer">
        <div className="audio-player__controls-inner">
          {isLoading && <div className="audio-player__loading"></div>}
          
          {!isPlaying && !isLoading && (
            <div 
              className="audio-player__btn audio-player__play-btn"
              onClick={() => play()}
            />
          )}
          
          {isPlaying && (
            <div 
              className="audio-player__btn audio-player__pause-btn"
              onClick={pause}
            />
          )}
          
          <div 
            className="audio-player__btn audio-player__prev-btn"
            onClick={() => skip('prev')}
          />
          
          <div 
            className="audio-player__btn audio-player__next-btn"
            onClick={() => skip('next')}
          />
        </div>
        
        <div 
          className="audio-player__btn audio-player__playlist-btn"
          onClick={togglePlaylist}
        />
        
        <div 
          className="audio-player__btn audio-player__volume-btn"
          onClick={toggleVolume}
        />
      </div>

      {/* Progress */}
      <div 
        className="audio-player__waveform"
        ref={waveformRef}
        onClick={handleWaveformClick}
      >
        {showWave && mounted ? (
          <SiriWave
            width={window.innerWidth}
            height={window.innerHeight * 0.3}
            cover={true}
            speed={0.03}
            amplitude={0.7}
            frequency={2}
            autostart={true}
          />
        ) : (
          <div className="audio-player__bar">
            <div 
              className="audio-player__progress" 
              style={{ width: `${progress}%` }}
            />
          </div>
        )}
      </div>

      {/* Playlist */}
      {showPlaylist && (
        <div className="audio-player__playlist" onClick={togglePlaylist}>
          <div className="audio-player__list">
            {playlistRef.current.map((song, index) => (
              <div
                key={index}
                className="audio-player__list-song"
                onClick={(e) => {
                  e.stopPropagation();
                  skipTo(index);
                  setShowPlaylist(false);
                }}
              >
                {song.title}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Volume */}
      {showVolume && (
        <div className="audio-player__volume" onClick={toggleVolume}>
          <div 
            className="audio-player__volume-bar-empty"
            onClick={handleVolumeClick}
          >
            <div 
              className="audio-player__volume-bar-full"
              style={{ width: `${volume * 100}%` }}
            />
            <div 
              className="audio-player__volume-slider"
              style={{ left: `${volume * 100}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default AudioPlayer;