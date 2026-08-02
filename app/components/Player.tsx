'use client'
import { usePlayer } from '../lib/usePlayer'
import { locales } from '../lib/locales'
import { supabase } from '../lib/supabase'
import {
  Play, Pause, Volume2, Volume1, VolumeX, Music, Disc, SkipBack,
  SkipForward, Quote, Shuffle, Repeat, Repeat1
} from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import React, { useRef, useEffect, useState } from 'react'

export default function Player() {
  const activeTrack = usePlayer(state => state.activeTrack);
  const isPlaying = usePlayer(state => state.isPlaying);
  const setIsPlaying = usePlayer(state => state.setIsPlaying);
  const playNext = usePlayer(state => state.playNext);
  const playPrevious = usePlayer(state => state.playPrevious);
  const queue = usePlayer(state => state.queue);
  const currentIndex = usePlayer(state => state.currentIndex);
  
  const isLyricsOpen = usePlayer(state => state.isLyricsOpen);
  const setIsLyricsOpen = usePlayer(state => state.setIsLyricsOpen);
  const isShuffle = usePlayer(state => state.isShuffle);
  const toggleShuffle = usePlayer(state => state.toggleShuffle);
  const repeatMode = usePlayer(state => state.repeatMode);
  const toggleRepeat = usePlayer(state => state.toggleRepeat);
  const volume = usePlayer(state => state.volume);
  const setVolume = usePlayer(state => state.setVolume);
  const toggleMute = usePlayer(state => state.toggleMute);
  const language = usePlayer(state => state.language);
  const setLanguage = usePlayer(state => state.setLanguage);
  
  const setGlobalCurrentTime = usePlayer(state => state.setCurrentTime);
  const audioRef = useRef<HTMLAudioElement>(null)
  
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [detectedGlow, setDetectedGlow] = useState('rgba(255,255,255,0.12)')

  // Вычисляем следующий трек для preload
  const nextTrack = queue[(currentIndex + 1) % queue.length];

  const getAverageColor = (imgElement: HTMLImageElement): string => {
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return 'rgba(255,255,255,0.12)';
      canvas.width = 1;
      canvas.height = 1;
      ctx.drawImage(imgElement, 0, 0, 1, 1);
      const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
      return `rgba(${r}, ${g}, ${b}, 0.45)`;
    } catch (e) {
      return 'rgba(255,255,255,0.12)';
    }
  };

  const getArtistsList = (track: any): string[] => {
    const defaultArtist = 'NORDOSIK';
    if (!track || !track.collaborators) return [defaultArtist];
    if (Array.isArray(track.collaborators)) {
      return [defaultArtist, ...track.collaborators.filter(Boolean)];
    }
    if (typeof track.collaborators === 'string') {
      const rawList = track.collaborators
        .split(',')
        .map((c: string) => c.trim())
        .filter((c: string) => c.length > 0);
      return [defaultArtist, ...rawList];
    }
    return [defaultArtist];
  };

  useEffect(() => {
    setDetectedGlow('rgba(255,255,255,0.12)')
  }, [activeTrack?.id])

  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => {
    setIsMounted(true);
  }, []);

  const t = locales[language as 'ru' | 'en'] || locales.en;

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedLang = localStorage.getItem('n-musics-lang') as 'ru' | 'en';
      if (savedLang && (savedLang === 'ru' || savedLang === 'en')) {
        setLanguage(savedLang);
      } else {
        localStorage.setItem('n-musics-lang', 'ru');
        setLanguage('ru');
      }
    }
  }, [setLanguage]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedVolume = localStorage.getItem('player_volume');
      if (savedVolume !== null) {
        setVolume(Number(savedVolume));
      }
    }
  }, [setVolume]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.loop = (repeatMode === 'one');
    }
  }, [repeatMode]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      switch (e.code) {
        case 'Space':
          e.preventDefault();
          setIsPlaying(!isPlaying);
          break;
        case 'ArrowRight':
          if (audioRef.current) audioRef.current.currentTime += 5;
          break;
        case 'ArrowLeft':
          if (audioRef.current) audioRef.current.currentTime -= 5;
          break;
        case 'ArrowUp':
          e.preventDefault();
          setVolume(Math.min(1, volume + 0.1));
          break;
        case 'ArrowDown':
          e.preventDefault();
          setVolume(Math.max(0, volume - 0.1));
          break;
        case 'KeyM':
          e.preventDefault();
          toggleMute();
          break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying, setIsPlaying, volume, setVolume, toggleMute]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
      localStorage.setItem('player_volume', volume.toString());
    }
  }, [volume]);

  useEffect(() => {
    if (isPlaying) {
      audioRef.current?.play().catch(() => {
        setIsPlaying(false);
      });
    } else {
      audioRef.current?.pause();
    }
  }, [isPlaying, activeTrack, setIsPlaying]);

  const onTimeUpdate = () => {
    if (audioRef.current) {
      const time = audioRef.current.currentTime;
      const realDuration = audioRef.current.duration;

      setCurrentTime(time);
      if (realDuration && !isNaN(realDuration)) {
        setDuration(realDuration);
      }
      setGlobalCurrentTime(time);

      // БЕСШОВНЫЙ ПЕРЕХОД: если до конца осталось меньше 0.15 сек и режим не "повтор 1 трека"
      if (realDuration > 0 && realDuration - time <= 0.15 && repeatMode !== 'one' && isPlaying) {
        playNext(true);
      }
    }
  }

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = parseFloat(e.target.value);
    setVolume(v);
    if (v > 0) {
      usePlayer.setState({ prevVolume: v });
    }
  };

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!audioRef.current || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const clickedPercent = x / rect.width;
    const newTime = clickedPercent * duration;
    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
    setGlobalCurrentTime(newTime);
  };

  const [isForcedHidden, setIsForcedHidden] = useState(false);
  useEffect(() => {
    const handleToggle = (e: any) => setIsForcedHidden(e.detail);
    window.addEventListener('toggle-player', handleToggle);
    return () => window.removeEventListener('toggle-player', handleToggle);
  }, []);

  const isMultiTrack = activeTrack?.release_type === 'album' || activeTrack?.release_type === 'ep';

  if (!isMounted) return null;

  const isEcosystem = activeTrack?.is_ecosystem;
  const isHot = activeTrack?.is_hot;

  // Рассчитываем итоговую длительность (предпочтение отдаем реально считанной)
  const displayDuration = duration || activeTrack?.duration || 0;

  return (
    <div className={`fixed bottom-0 left-0 right-0 h-24 px-6 flex items-center justify-between z-40 transition-all duration-500 ease-in-out overflow-visible bg-zinc-950/80 backdrop-blur-2xl backdrop-saturate-150 border-t border-white/10 shadow-[0_-15px_40px_rgba(0,0,0,0.6)] ${isForcedHidden ? 'translate-y-full opacity-0 pointer-events-none' : 'translate-y-0 opacity-100'}`}>
      
      {/* Скрытый тег для моментальной предзагрузки следующей песни */}
      {nextTrack?.audio_url && (
        <audio src={nextTrack.audio_url} preload="auto" className="hidden" />
      )}

      <audio
        key={activeTrack?.id}
        ref={audioRef}
        src={activeTrack?.audio_url}
        preload="auto"
        onTimeUpdate={onTimeUpdate}
        onLoadedMetadata={onTimeUpdate}
        onCanPlay={(e) => e.currentTarget.volume = volume}
        onEnded={() => {
          if (repeatMode !== 'one') playNext(true);
        }}
        autoPlay={isPlaying}
        loop={repeatMode === 'one'}
      />

      {/* 1. ИНФО */}
      <div className="flex items-center gap-4 w-1/3">
        <div
          style={{ boxShadow: isPlaying ? `0 0 20px ${detectedGlow}` : 'none' }}
          className="w-14 h-14 bg-zinc-800 rounded overflow-hidden flex items-center justify-center flex-shrink-0 transition-all duration-700"
        >
          {activeTrack?.cover_url ? (
            <img
              src={activeTrack.cover_url}
              crossOrigin="anonymous"
              className="w-full h-full object-cover"
              alt={activeTrack.title}
              onLoad={(e) => {
                const color = getAverageColor(e.currentTarget);
                setDetectedGlow(color);
              }}
            />
          ) : (
            <>
              {isMultiTrack ? (
                <Disc className={`text-zinc-600 w-6 h-6 ${isPlaying ? 'animate-[spin_8s_linear_infinite]' : ''}`} />
              ) : (
                <Music className="text-zinc-600 w-6 h-6" />
              )}
            </>
          )}
        </div>
        <div className="truncate flex-1 min-w-0 flex flex-col justify-center">
          <div className="flex items-center gap-2 truncate">
            <span className="text-sm font-bold text-white truncate">{activeTrack?.title}</span>
            {activeTrack?.is_ecosystem && (
              <span className="flex-shrink-0 w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_10px_#34d399,0_0_4px_#34d399]" />
            )}
            {activeTrack?.is_hot && (
              <span className="flex-shrink-0 px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-widest bg-red-500/20 text-red-400 border border-red-500/30 shadow-[0_0_8px_rgba(239,68,68,0.4)]">
                HOT
              </span>
            )}
          </div>
          <div className="text-[10px] text-zinc-500 mt-0.5 flex flex-wrap items-center font-bold select-none truncate">
            {getArtistsList(activeTrack).map((artist: string, idx: number, arr: string[]) => (
              <span key={`player-artist-${artist}-${idx}`} className="inline-flex items-center">
                <motion.span
                  whileHover={{ color: "#ffffff" }}
                  whileTap={{ scale: 0.96 }}
                  onClick={(e) => {
                    e.stopPropagation();
                    usePlayer.getState().openArtistModal(artist);
                  }}
                  className="cursor-pointer transition-colors text-zinc-400 hover:text-white tracking-wider"
                >
                  {artist}
                </motion.span>
                {idx < arr.length - 1 && (
                  <span className="text-zinc-400 mr-1.5 font-normal tracking-normal">,</span>
                )}
              </span>
            ))}
            <span className="text-zinc-600 mx-2 font-normal select-none">·</span>
            <span className="text-zinc-600 tracking-wider select-none uppercase">N.MUSICS</span>
          </div>
        </div>
      </div>

      {/* 2. УПРАВЛЕНИЕ И ПРОГРЕСС */}
      <div className="flex flex-col items-center gap-2 w-1/3">
        <div className="flex items-center gap-6 text-zinc-400">
          <button
            onClick={toggleShuffle}
            className={`transition-all duration-200 hover:scale-105 active:scale-95 ${isShuffle ? 'text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.6)]' : 'text-zinc-500 hover:text-zinc-300'}`}
          >
            <Shuffle size={18} />
          </button>
          <SkipBack
            onClick={() => playPrevious()}
            className="hover:text-white cursor-pointer transition active:scale-95"
            size={22}
          />
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="p-2.5 bg-white text-black rounded-full hover:scale-105 transition active:scale-95 flex items-center justify-center"
          >
            {isPlaying ? <Pause fill="black" size={18} /> : <Play fill="black" size={18} className="ml-0.5" />}
          </button>
          <SkipForward
            onClick={() => playNext(false)}
            className="hover:text-white cursor-pointer transition active:scale-95"
            size={22}
          />
          <button
            onClick={toggleRepeat}
            className="relative transition-all duration-200 hover:scale-105 active:scale-95 flex items-center justify-center w-8 h-8"
          >
            <div className={`transition-colors ${repeatMode !== 'off' ? 'text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.6)]' : 'text-zinc-500 hover:text-zinc-300'}`}>
              {repeatMode === 'one' ? <Repeat1 size={18} /> : <Repeat size={18} />}
            </div>
          </button>
        </div>

        <div className="flex items-center gap-2 w-full text-[11px] text-zinc-400 font-mono mt-1 select-none">
          {/* ТЕКУЩЕЕ ВРЕМЯ (Округлено по полным секундам) */}
          <span>
            {Math.floor(currentTime / 60)}:{(Math.floor(currentTime % 60)).toString().padStart(2, '0')}
          </span>

          <div onClick={handleProgressClick} className="flex-1 h-1 bg-zinc-800 rounded-full relative cursor-pointer group">
            <div
              className="absolute h-full bg-zinc-400 group-hover:bg-white transition-all duration-100 rounded-full"
              style={{ width: `${Math.min(100, (currentTime / (displayDuration || 1)) * 100)}%` }}
            />
            <div
              className="absolute h-2.5 w-2.5 bg-white rounded-full -top-[3px] opacity-0 group-hover:opacity-100 transition-opacity shadow-[0_0_8px_rgba(255,255,255,0.5)]"
              style={{ left: `calc(${Math.min(100, (currentTime / (displayDuration || 1)) * 100)}% - 5px)` }}
            />
          </div>

          {/* ПОЛНАЯ ДЛИТЕЛЬНОСТЬ */}
          <span>
            {(() => {
              const mins = Math.floor(displayDuration / 60);
              const secs = Math.floor(displayDuration % 60).toString().padStart(2, '0');
              return `${mins}:${secs}`;
            })()}
          </span>
        </div>
      </div>

      {/* 3. ГРОМКОСТЬ И ДОП. КНОПКИ */}
      <div className="w-1/3 flex justify-end items-center gap-4">
        <button
          onClick={() => setLanguage(language === 'en' ? 'ru' : 'en')}
          className="mr-0 px-1 py-0.5 text-[11px] font-black tracking-[0.2em] pl-[0.3em] text-zinc-400 hover:text-white transition-all duration-300 ease-in-out active:scale-90 select-none"
        >
          {language === 'en' ? 'RU' : 'EN'}
        </button>
        <button
          onClick={() => setIsLyricsOpen(!isLyricsOpen)}
          className={`p-1 transition-all duration-200 active:scale-95 flex-shrink-0 ${isLyricsOpen ? 'text-white' : 'text-zinc-400 hover:text-white'}`}
        >
          <Quote size={18} className="transform rotate-180 flex-shrink-0" strokeWidth={2.5} />
        </button>
        <button onClick={toggleMute} className="text-zinc-400 hover:text-white transition-colors p-1 active:scale-95 flex-shrink-0">
          {volume === 0 ? <VolumeX size={18} className="text-zinc-500" /> : volume < 0.4 ? <Volume1 size={18} /> : <Volume2 size={18} />}
        </button>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={volume}
          onChange={handleVolumeChange}
          className="w-24 h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-white flex-shrink-0 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white"
        />
      </div>
    </div>
  )
}