'use client'
import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom' // Подключили порталы
import { motion, AnimatePresence } from 'framer-motion'
import { Play, Pause, X, Maximize2, Share2, Download, BookOpen, Save, Heart } from 'lucide-react'
import { usePlayer } from '../lib/usePlayer'
import { supabase } from '../lib/supabase'
import { locales } from '../lib/locales'
import DownloadButton from "./DownloadButton"
import JSZip from 'jszip'
import React, { memo } from 'react'

function TrackArtistsTooltip({
  artists,
  isCurrentTrack,
  $t
}: {
  artists: string[];
  isCurrentTrack: boolean;
  $t?: any;
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [isTruncated, setIsTruncated] = useState(false)
  const textRef = useRef<HTMLDivElement>(null)
  const closeTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Проверяем, обрезается ли текст прямо сейчас
  useEffect(() => {
    const checkOverflow = () => {
      if (textRef.current) {
        const hasOverflow = textRef.current.scrollWidth > textRef.current.clientWidth
        setIsTruncated(hasOverflow)
      }
    }

    checkOverflow()
    window.addEventListener('resize', checkOverflow)
    return () => window.removeEventListener('resize', checkOverflow)
  }, [artists])

  const handleMouseEnter = () => {
    if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current)
    setIsOpen(true)
  }

  const handleMouseLeave = () => {
    closeTimeoutRef.current = setTimeout(() => {
      setIsOpen(false)
    }, 200)
  }

  return (
    <div
      className="relative inline-block max-w-full min-w-0"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Строка с ограничением ширины и троеточием при переполнении */}
      <div
        ref={textRef}
        className="w-full truncate overflow-hidden whitespace-nowrap block cursor-pointer"
      >
        {artists.map((artist, idx) => (
          <span key={idx} className="inline">
            <span
              onClick={(e) => {
                e.stopPropagation()
                usePlayer.getState().openArtistModal(artist)
              }}
              className={`transition-colors ${isCurrentTrack ? 'text-zinc-400 hover:text-white' : 'text-zinc-600 hover:text-white'}`}
            >
              {artist}
            </span>
            {idx < artists.length - 1 && <span className="text-zinc-500 mr-1">, </span>}
          </span>
        ))}
      </div>

      {/* Тултип появится ТОЛЬКО если текст реально обрезан */}
      {isTruncated && isOpen && (
        <div className="absolute left-0 top-full pt-1.5 z-50 pointer-events-auto before:content-[''] before:absolute before:-top-3 before:left-0 before:right-0 before:h-4">
          <div className="flex flex-col bg-zinc-900/95 backdrop-blur-md border border-white/10 p-2.5 rounded-xl shadow-2xl animate-in fade-in slide-in-from-top-1 duration-150 w-max max-w-[260px]">
            <span className="text-[9px] font-black tracking-widest text-zinc-500 uppercase mb-1 px-1">
              {$t?.artistsTooltip || $t?.artists || 'Исполнители:'}
            </span>
            <div className="flex items-center flex-wrap gap-1">
              {artists.map((artist, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    usePlayer.getState().openArtistModal(artist)
                  }}
                  className="text-xs font-bold text-zinc-200 hover:text-white transition-colors cursor-pointer bg-white/5 hover:bg-white/10 px-2 py-1 rounded-md"
                >
                  {artist}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Микро-анализатор обложки: сжимает картинку до 1х1 пикселя в Canvas и вытаскивает средний цвет
const getAverageColor = (imgElement: HTMLImageElement): string => {
  try {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return 'rgba(255,255,255,0.12)';

    canvas.width = 1;
    canvas.height = 1;

    // Рисуем картинку размером 1x1 пиксель, браузер автоматически её усреднит
    ctx.drawImage(imgElement, 0, 0, 1, 1);
    const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;

    // Возвращаем готовый цвет с мягкой прозрачностью для красивого свечения
    return `rgba(${r}, ${g}, ${b}, 0.45)`;
  } catch (e) {
    // Если картинка загрузилась с другого домена без CORS, отдаем красивый дефолт
    return 'rgba(255,255,255,0.12)';
  }
};

// Функция для правильного склонения
function getTrackWord(count: number, lang: string, t: any) {
  if (lang !== 'ru') {
    return count === 1 ? t.track : t.tracks
  }

  const abs = Math.abs(count) % 100
  const lastDigit = abs % 10

  if (abs > 10 && abs < 20) return 'ТРЕКОВ'
  if (lastDigit > 1 && lastDigit < 5) return 'ТРЕКА'
  if (lastDigit === 1) return 'ТРЕК'

  return 'ТРЕКОВ'
}

export default function ReleaseModal({ release, isOpen, onClose, tracks: rawTracks, isAdmin }: any) {
  const { setQueue, activeTrack, isPlaying, togglePlay, setIsPlaying, language } = usePlayer()
  const [copied, setCopied] = useState(false)
  const [isDownloadOpen, setIsDownloadOpen] = useState(false)
  const [isCommentaryOpen, setIsCommentaryOpen] = useState(false)
  const [commentaryText, setCommentaryText] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [isLightboxOpen, setIsLightboxOpen] = useState(false)
  const [detectedGlow, setDetectedGlow] = useState('rgba(255,255,255,0.12)')

  // Безопасный парсинг артистов трека или релиза
  const parseCollaborators = (target: any): string[] => {
    const mainArtist = 'NORDOSIK';
    if (!target) return [mainArtist];

    if (typeof target.collaborators === 'string' && target.collaborators.trim().length > 0) {
      const list = target.collaborators
        .split(',')
        .map((c: string) => c.trim())
        .filter((c: string) => c.length > 0);
      return [mainArtist, ...list];
    }

    if (Array.isArray(target.track_collaborators) && target.track_collaborators.length > 0) {
      const list = target.track_collaborators
        .map((item: any) => item.artist_name || item.name)
        .filter(Boolean);
      return [mainArtist, ...list];
    }

    if (Array.isArray(target.collaborators) && target.collaborators.length > 0) {
      return [mainArtist, ...target.collaborators.filter(Boolean)];
    }

    return [mainArtist];
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsLightboxOpen(false);
    };
    if (isLightboxOpen) window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isLightboxOpen]);

  useEffect(() => {
    if (release) {
      setCommentaryText(release.commentary || '')
    }
  }, [release]);

  useEffect(() => {
    let scrollTimeout: NodeJS.Timeout;
    if (isOpen) {
      window.dispatchEvent(new CustomEvent('toggle-player', { detail: true }));
    } else {
      window.dispatchEvent(new CustomEvent('toggle-player', { detail: false }));
      const savedScroll = parseInt(document.body.getAttribute('data-scroll-y') || '0', 10);
      if (savedScroll > 0) {
        scrollTimeout = setTimeout(() => {
          window.scrollTo({
            top: savedScroll,
            behavior: 'auto'
          });
        }, 0);
      }
    }

    // Находим внешнюю обертку модалки по ID
    const outerModal = document.getElementById('n-musics-modal-scroll-container');
    if (outerModal) {
      // Если открыто окно загрузки или истории — намертво отключаем скролл длинной карточки сзади
      if (isDownloadOpen || isCommentaryOpen) {
        outerModal.style.overflowY = 'hidden';
      } else {
        outerModal.style.overflowY = 'auto';
      }
    }

    return () => {
      window.dispatchEvent(new CustomEvent('toggle-player', { detail: false }));
      document.documentElement.style.overflow = '';
      document.body.style.overflow = '';
      if (scrollTimeout) clearTimeout(scrollTimeout); // Железная зачистка таймера
    };
  }, [isOpen, isDownloadOpen, isCommentaryOpen]);


  if (!release) return null

  // Если треки переданы внутри объекта release_tracks (через новую промежуточную таблицу)
  const tracks = (
    Array.isArray(release.release_tracks) && release.release_tracks.length > 0
      ? release.release_tracks
        .sort((a: any, b: any) => (a.track_number || 0) - (b.track_number || 0))
        .map((item: any) => {
          // Если данные трека внутри объекта item.tracks
          const trackData = item.tracks || item;
          return {
            ...trackData,
            // Если lyrics лежат в самой связи или внутри объекта tracks
            lyrics: trackData.lyrics || item.lyrics || '',
          };
        })
        .filter(Boolean)
      : (rawTracks || [])
  ).map((track: any) => ({
    ...track,
    cover_url: track.cover_url || release.cover_url || release.cover,
    lyrics: track.lyrics || '',
    release_title: release.title
  }));

  const formatDuration = (s: any) => {
    const seconds = Math.floor(Number(s))
    if (isNaN(seconds) || seconds <= 0) return '--:--'
    return `${Math.floor(seconds / 60)}:${(seconds % 60).toString().padStart(2, '0')}`
  }

  const t = locales[language as 'ru' | 'en' || 'en'];

  const formatTotalDuration = (totalSeconds: any) => {
    const seconds = Math.floor(Number(totalSeconds))
    if (isNaN(seconds) || seconds <= 0) return ''

    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const r = seconds % 60

    const hrLabel = h === 1 ? t.hr_single : t.hr_plural
    const minLabel = m === 1 ? t.min_single : t.min_plural
    const secLabel = r === 1 ? t.sec_single : t.sec_plural

    return h > 0
      ? `${h} ${hrLabel} ${m} ${minLabel}`
      : `${m} ${minLabel} ${r} ${secLabel}`
  }

  const formatFullDate = (dStr: string) => {
    if (!dStr) return '--.--.----'
    const d = new Date(dStr)
    return `${d.getDate().toString().padStart(2, '0')}.${(d.getMonth() + 1).toString().padStart(2, '0')}.${d.getFullYear()}`
  }

  const handleShare = () => {
    navigator.clipboard.writeText(`${window.location.origin}/release/${release.id}`)
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }

  const handleSaveCommentary = async () => {
    if (!isAdmin) return
    setIsSaving(true)
    try {
      const { error } = await supabase.from('releases').update({ commentary: commentaryText }).eq('id', release.id)
      if (error) throw error
      release.commentary = commentaryText
      alert(t.saveSuccess)
    } catch (e: any) { alert(`Error saving: ${e.message}`) } finally { setIsSaving(false) }
  }

  const isThisReleasePlaying = isPlaying && tracks.some((t: any) => t.id === activeTrack?.id)
  const isMultiTrack = release.release_type === 'album' || release.release_type === 'ep'

  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => {
    setIsMounted(true);
  }, []);

  return (
    <AnimatePresence mode="wait">
      {isOpen && (
        <div key={`modal-container-${release.id}`} className="fixed inset-0 z-50 flex items-start justify-center p-4 md:p-10 overflow-y-auto custom-scrollbar" id="n-musics-modal-scroll-container">
          <motion.div
            key="modal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/90 backdrop-blur-xl"
          />

          {/* КАРТОЧКА МОДАЛКИ */}
          <motion.div
            key="modal-content-card"
            initial={{ opacity: 0, scale: 0.96, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -40 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="relative w-full max-w-4xl bg-zinc-950/95 backdrop-blur-xl border border-zinc-800/50 rounded-2xl shadow-2xl flex flex-col mb-10 isolate"
          >
            {!isDownloadOpen && !isCommentaryOpen && (
              <div className="absolute top-6 right-6 z-50 flex items-center gap-3">
                {/* Мой упругий брутальный крестик карточки релиза */}
                <motion.button
                  onClick={onClose}
                  whileHover={{ scale: 1.15, rotate: 90, color: "#ef4444" }}
                  whileTap={{ scale: 0.85 }}
                  transition={{ type: "spring", stiffness: 300, damping: 20 }}
                  className="text-zinc-500 transition-colors text-4xl font-mono select-none cursor-pointer"
                >
                  ×
                </motion.button>
              </div>
            )}

            {/* СТАТИЧНАЯ ШАПКА РЕЛИЗА */}
            <div className="flex-shrink-0">
              <div className="p-10 pb-6 flex flex-col sm:flex-row gap-8 items-center sm:items-stretch bg-gradient-to-b from-white/[0.03] to-transparent">

                <div
                  onClick={() => release.cover_url && setIsLightboxOpen(true)}
                  style={{
                    ['--release-glow' as any]: detectedGlow
                  }}
                  className="w-44 h-44 md:w-52 md:h-52 rounded-xl bg-zinc-900 flex-shrink-0 cursor-zoom-in group/cover relative flex items-center justify-center transition-all duration-500 ease-out transform hover:scale-[1.04] hover:-translate-y-1"
                >
                  {/* Умная тень-хамелеон: подстраивается под обложку, плавно разгорается при наведении */}
                  {release.cover_url && (
                    <div
                      className="absolute inset-0 rounded-xl opacity-70 blur-xl group-hover/cover:opacity-95 transition-all duration-500 scale-100 pointer-events-none -z-10 will-change-[opacity]"
                      style={{
                        backgroundColor: 'var(--release-glow)'
                      }}
                    />
                  )}

                  {/* Контейнер обложки БЕЗ серых рамок */}
                  <div className="w-full h-full rounded-xl overflow-hidden shadow-2xl relative z-10 bg-zinc-950">
                    {release.cover_url ? (
                      <img
                        src={release.cover_url}
                        crossOrigin="anonymous" // Позволяет читать цвета, если картинки летят из Supabase Storage
                        className="w-full h-full object-cover transition-transform duration-500 ease-out group-hover/cover:scale-[1.02] transform-gpu will-change-transform"
                        style={{
                          imageRendering: 'auto',
                          backfaceVisibility: 'hidden',
                          WebkitBackfaceVisibility: 'hidden'
                        }}
                        alt={release.title}
                        onLoad={(e) => {
                          const color = getAverageColor(e.currentTarget);
                          setDetectedGlow(color);
                        }}
                      />
                    ) : (
                      <>{isMultiTrack ? (
                        <svg className="text-zinc-600 w-16 h-16 animate-[spin_8s_linear_infinite]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="3"></circle></svg>
                      ) : (
                        <svg className="text-zinc-600 w-16 h-16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg>
                      )}</>
                    )}
                  </div>
                </div>

                <div className="flex flex-col justify-end items-start text-left flex-1 min-w-0 min-h-full isolate will-change-transform">
                  <span className="text-[12px] font-black uppercase tracking-[0.3em] text-zinc-500 mb-1 block">
                    {release.release_type === 'album' && t.album}
                    {release.release_type === 'ep' && t.ep}
                    {release.release_type === 'single' && t.single}
                    {!release.release_type && t.single}
                  </span>

                  <h1 className="font-black tracking-tighter text-white uppercase leading-[0.9] mb-3 break-words w-full" style={{ fontSize: release.title.length > 8 ? `clamp(20px, ${60 - (release.title.length - 8) * 4}px, 60px)` : '60px' }}>
                    {release.title}
                  </h1>

                  <div className="flex flex-wrap items-center text-[12px] font-black mb-5 text-zinc-500 max-w-full gap-y-1.5 select-none">
                    {/* Автоматически собираем всех артистов релиза и его треков */}
                    {(() => {
                      const allCollabs = new Set<string>();
                      allCollabs.add('NORDOSIK');
                      if (release?.collaborators) {
                        parseCollaborators(release).forEach(a => allCollabs.add(a));
                      }
                      if (Array.isArray(tracks)) {
                        tracks.forEach((t: any) => {
                          parseCollaborators(t).forEach(a => allCollabs.add(a));
                        });
                      }
                      const artistsList = Array.from(allCollabs);
                      return artistsList.map((artist: string, idx: number) => (
                        <span key={`release-header-artist-${artist}-${idx}`} className="inline-flex items-center">
                          <motion.span
                            whileHover={{ color: "#ffffff" }}
                            whileTap={{ scale: 0.96 }}
                            onClick={(e) => {
                              e.stopPropagation();
                              usePlayer.getState().openArtistModal(artist);
                            }}
                            className="text-white hover:underline cursor-pointer transition-colors"
                          >
                            {artist}
                          </motion.span>
                          {idx < artistsList.length - 1 && (
                            <span className="text-zinc-600 mx-2 font-normal">•</span>
                          )}
                        </span>
                      ));
                    })()}
                    <span className="mx-1.5 font-normal">•</span>
                    <span className="tracking-tighter">{formatFullDate(release.created_at)}</span>
                    <span className="mx-1.5 font-normal">•</span>
                    {/* Добавили uppercase обратно для количества треков */}
                    <span className="tracking-tighter uppercase">
                      {tracks.length} {getTrackWord(tracks.length, language, t)}
                    </span>
                    {(() => {
                      const totalSec = release.duration > 0
                        ? release.duration
                        : tracks.reduce((sum: number, t: any) => sum + (Number(t.duration) || 0), 0);
                      if (totalSec > 0) return (
                        <>
                          <span className="mx-1.5 font-normal">•</span>
                          <span className="tracking-tighter text-zinc-500">{formatTotalDuration(totalSec)}</span>
                        </>
                      );
                      return null;
                    })()}
                    <span className="mx-1.5 font-normal">•</span>
                    <button
                      onClick={() => setIsCommentaryOpen(true)}
                      className="inline-flex items-center gap-1.5 text-zinc-400 hover:text-white transition-colors bg-white/5 hover:bg-white/10 px-2.5 py-0.5 rounded-md border border-white/5 flex-shrink-0"
                    >
                      <BookOpen size={12} strokeWidth={2.5} />
                      <span className="text-[10px] font-black tracking-widest uppercase">{t.story}</span>
                    </button>
                  </div>

                  <div className="flex items-center gap-3 w-full z-20" style={{ transform: 'translateZ(0)', backfaceVisibility: 'hidden' }}>
                    <ActionButtons
                      handleShare={handleShare}
                      copied={copied}
                      isMultiTrack={isMultiTrack}
                      isDownloadOpen={isDownloadOpen}
                      setIsDownloadOpen={setIsDownloadOpen}
                      audioUrl={release.audio_url}
                      title={release.title}
                      t={t}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* ЗОНА УПРАВЛЕНИЯ И ТРЕКЛИСТА */}
            <div className="flex-1 px-10 pb-10 flex flex-col min-h-0">
              <div className="mb-6 flex-shrink-0">
                <button onClick={() => isThisReleasePlaying ? togglePlay() : setQueue(tracks, 0)} className="w-14 h-14 bg-white hover:scale-105 transition active:scale-95 rounded-full flex items-center justify-center shadow-xl">
                  {isThisReleasePlaying ? <Pause fill="black" className="text-black" size={24} /> : <Play fill="black" className="text-black ml-1" size={24} />}
                </button>
              </div>

              <div className="space-y-1 flex-1">
                {tracks.map((track: any, i: number) => {
                  const isCurrentTrack = !!(
                    activeTrack && (
                      // 1. Стандартное совпадение по ID трека (для альбомов)
                      activeTrack.id === track.id ||
                      // 2. Если играет сингл, запущенный с главной (сверяем ID релиза с release_id трека)
                      activeTrack.id === track.release_id ||
                      // 3. Железный фикс по названию трека (если имена совпадают — это он)
                      activeTrack.title === track.title
                    )
                  );
                  const isNowPlaying = isCurrentTrack && isPlaying
                  const isEcosystemTrack = track.is_ecosystem
                  const isHotNew = track.is_hot

                  return (
                    <div
                      key={`main-track-${track.id || i}`}
                      onClick={() => {
                        setQueue(tracks, i);
                        setIsPlaying(true);
                        window.dispatchEvent(new CustomEvent('toggle-player', { detail: false })); // Исправили CustomeEvent -> CustomEvent
                        onClose();
                      }}
                      className={`flex items-center justify-between gap-4 p-3 group
rounded-lg cursor-pointer transition-all duration-300 relative 
border ${isNowPlaying
                          ? isEcosystemTrack
                            ? 'bg-emerald-950/20 border-emerald-400 shadow-[0_0_25px_rgba(52,211,153,0.3),inset_0_0_15px_rgba(52,211,153,0.1)] scale-[1.01]'
                            : isHotNew
                              ? 'bg-red-950/20 border-red-500 shadow-[0_0_25px_rgba(239,68,68,0.3),inset_0_0_15px_rgba(239,68,68,0.1)] scale-[1.01]'
                              : 'bg-white/5 border-white/20 shadow-[0_0_20px_rgba(255,255,255,0.05)] scale-[1.01]'
                          : isEcosystemTrack
                            ? 'bg-zinc-900/20 border-emerald-500/10 hover:border-emerald-500/30'
                            : isHotNew
                              ? 'bg-zinc-900/20 border-red-500/10 animate-fire-glow hover:border-red-500/30'
                              : 'bg-transparent border-transparent hover:bg-white/5'
                        }`}
                    >

                      <div className="flex items-center gap-4 min-w-0 flex-1">
                        <span className="flex items-center justify-center text-sm font-mono flex-shrink-0 w-[30px]">
                          {isNowPlaying ? (
                            <EqualizerIcon />
                          ) : (
                            <span className={isCurrentTrack ? "text-white font-bold" : "text-zinc-600 group-hover:text-zinc-400 transition-colors"}>
                              {i + 1}
                            </span>
                          )}
                        </span>

                        <div className="flex flex-col min-w-0 justify-center">
                          <span className={`font-black text-sm tracking-wide break-words whitespace-normal transition-colors duration-300 ${isCurrentTrack ? 'text-white' : 'text-zinc-400 group-hover:text-white'
                            }`}>
                            {track.title}
                          </span>

                          {/* Интерактивная цепочка артистов с устойчивым тултипом */}
                          <div className="flex items-center gap-1 mt-0.5 text-[9px] font-black tracking-widest">
                            <TrackArtistsTooltip
                              artists={parseCollaborators(track)}
                              isCurrentTrack={isCurrentTrack}
                            />
                            {isEcosystemTrack && (
                              <span className="text-[9px] uppercase font-black tracking-widest text-emerald-500/80 ml-1.5">
                                {t.singleReleaseNotice}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center justify-end flex-shrink-0 ml-2">
                          {isEcosystemTrack && (
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_10px_#34d399]" />
                          )}
                          {isHotNew && (
                            <span className="text-[8px] font-black px-1.5 py-0.5 bg-red-500/10 text-red-400 border border-red-500/20 rounded-sm tracking-widest">
                              HOT
                            </span>
                          )}
                        </div>
                      </div>

                      {/* ЦЕНТРАЛЬНЫЙ БЛОК: СЧЕТЧИК БЕЗ НУЛЕЙ, ВИДЕН ВСЕГДА */}
                      <div className="flex items-center justify-end shrink-0 px-2 min-w-[70px]">
                        {track.plays_count && track.plays_count > 0 ? (
                          <span className={`text-sm md:text-base font-mono font-normal tracking-tighter ${isCurrentTrack ? 'text-white' : 'text-zinc-500'}`}>
                            {track.plays_count.toLocaleString('en-US')}
                          </span>
                        ) : (
                          <div className="w-1" />
                        )}
                      </div>

                      {/* ПРАВЫЙ БЛОК: СТИЛЬНОЕ ПРУЖИНЯЩЕЕ СЕРДЕЧКО + ДЛИТЕЛЬНОСТЬ */}
                      <div className="flex items-center gap-6 flex-shrink-0 pl-4">

                        {/* КНОПКА ЛАЙКА С АНИМАЦИЕЙ НА FRAMER MOTION */}
                        <motion.button
                          onClick={(e) => {
                            e.stopPropagation(); // Чтобы не запускался сам трек
                            console.log('Клик по сердечку трека:', track.title);
                          }}
                          whileHover={{ scale: 1.12 }}
                          whileTap={{ scale: 0.85 }}
                          transition={{ type: "spring", stiffness: 400, damping: 15 }}
                          className="text-zinc-500 hover:text-white transition-colors p-1.5 flex items-center justify-center"
                        >
                          <Heart
                            size={20}
                            strokeWidth={2.8}
                            className="drop-shadow-[0_0_8px_rgba(255,255,255,0.1)]"
                          />
                        </motion.button>

                        {/* ДЛИТЕЛЬНОСТЬ ТРЕКА */}
                        <span className={`text-xs font-mono w-11 text-right transition-colors ${isCurrentTrack ? 'text-white' : 'text-zinc-600 group-hover:text-zinc-400'}`}>
                          {formatDuration(track.duration)}
                        </span>

                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* МЕНЕДЖЕР ЗАГРУЗОК ЧЕРЕЗ ПОРТАЛ */}
            {isMounted && createPortal(
              <AnimatePresence>
                {isDownloadOpen && isMultiTrack && (
                  <div key="download-manager-wrapper" className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    {/* Задний фон, который теперь железно перекроет вообще всё */}
                    <motion.div
                      key="download-backdrop"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      onClick={() => setIsDownloadOpen(false)}
                      className="absolute inset-0 bg-black/85 backdrop-blur-md cursor-pointer"
                    />
                    {/* Карточка, которая встанет идеально по центру экрана */}
                    <motion.div
                      key="download-modal-card"
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="relative w-full max-w-2xl h-[540px] bg-[#121212] border border-white/10 shadow-[0_0_100px_rgba(0,0,0,1)] flex flex-col rounded-[32px] overflow-hidden z-10"
                    >
                      <div className="flex flex-col items-center justify-center px-6 pt-8 pb-5 border-b border-white/5 bg-[#161616] relative flex-shrink-0">
                        <motion.button
                          onClick={() => setIsDownloadOpen(false)}
                          whileHover={{ scale: 1.2, rotate: 90, color: "#ef4444" }}
                          whileTap={{ scale: 0.85 }}
                          transition={{ type: "spring", stiffness: 300, damping: 20 }}
                          className="absolute top-6 right-6 text-zinc-500 transition-colors text-2xl font-mono select-none z-10"
                        >
                          ×
                        </motion.button>
                        <span className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.5em] mb-2 opacity-50">{t.downloadManager}</span>
                        <h2 className="text-2xl font-black text-white uppercase tracking-tighter text-center leading-none">{release.title}</h2>

                        <button
                          onClick={async () => {
                            const zip = new JSZip();

                            // Создаем внутри архива папку с названием альбома, чтобы всё лежало аккуратно
                            const albumFolder = zip.folder(release.title) || zip;

                            for (let index = 0; index < tracks.length; index++) {
                              const track = tracks[index];
                              try {
                                const fileUrl = track.song_path || track.audio_url;
                                if (!fileUrl) continue;

                                // 1. Выкачиваем аудиофайл в память браузера
                                const response = await fetch(fileUrl);
                                const blob = await response.blob();

                                // Форматируем номер трека (01, 02, 03...10), чтобы папка сохраняла строгий порядок треклиста
                                const trackNumber = String(index + 1).padStart(2, '0');
                                const fileName = `${trackNumber}. ${track.title}.mp3`;

                                // 2. Кладем файл в нашу виртуальную папку архива
                                albumFolder.file(fileName, blob);
                              } catch (err) {
                                console.error(`Ошибка при архивации трека ${track.title}:`, err);
                              }
                            }

                            try {
                              // 3. Упаковываем все файлы в ZIP-архив прямо в памяти браузера
                              const content = await zip.generateAsync({ type: 'blob' });

                              // 4. Скачиваем готовый архив на компьютер пользователя
                              const blobUrl = window.URL.createObjectURL(content);
                              const link = document.createElement('a');
                              link.href = blobUrl;
                              link.download = `${release.title}.zip`; // Название архива — имя альбома
                              document.body.appendChild(link);
                              link.click();

                              // 5. Чистим за собой оперативную память
                              document.body.removeChild(link);
                              window.URL.revokeObjectURL(blobUrl);
                            } catch (err) {
                              console.error('Ошибка при генерации ZIP-архива:', err);
                            }
                          }}
                          className="mt-2.5 flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-black font-black uppercase text-[10px] tracking-widest px-5 py-2.5 rounded-xl transition hover:scale-[1.02] active:scale-98 shadow-[0_0_15px_rgba(52,211,153,0.15)]"
                        >
                          <Download size={14} strokeWidth={3} /> {t.syncBtn ? (language === 'ru' ? 'Скачать весь релиз (Архив)' : 'Download Full Release (ZIP)') : 'DOWNLOAD'}
                        </button>
                      </div>

                      <div className="overflow-y-auto overscroll-contain isolate flex-1 px-3 py-2 bg-[#121212] custom-scrollbar min-h-0">
                        <div className="flex flex-col gap-y-1 pb-4">
                          {tracks.map((track: any, i: number) => (
                            <div key={`release-download-track-index-${i}-${track.id || 'no-id'}`} className="flex items-center justify-between p-4 px-6 rounded-[24px] hover:bg-white/[0.05] transition-all group mx-2">
                              <div className="flex items-center gap-x-6 min-w-0">
                                <span className="text-[12px] font-black text-zinc-700 w-6 text-left group-hover:text-zinc-400">{i + 1}</span>
                                <div className="flex flex-col truncate">
                                  <span className="font-bold text-[15px] text-zinc-200 group-hover:text-white truncate uppercase tracking-tight">
                                    {track.title}
                                  </span>
                                  <span className="text-[9px] font-black text-zinc-600 uppercase tracking-[0.2em] mt-0.5 truncate">
                                    {parseCollaborators(track).join(', ')}
                                  </span>
                                </div>
                              </div>
                              <div className="flex items-center gap-x-5 flex-shrink-0">
                                <span className="text-xs font-mono text-zinc-600 group-hover:text-zinc-400 transition-colors">{formatDuration(track.duration)}</span>
                                <div className="opacity-40 group-hover:opacity-100 group-hover:text-emerald-400 transition-all transform hover:scale-110">
                                  <DownloadButton url={track.song_path || track.audio_url} fileName={`${release.title} - ${track.title}`} isMini />
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="px-7 py-6 bg-[#161616] border-t border-white/5 flex justify-center flex-shrink-0">
                        <span className="text-[10px] font-black text-zinc-800 uppercase tracking-[0.6em]">{t.musicRecords}</span>
                      </div>
                    </motion.div>
                  </div>
                )}
              </AnimatePresence>,
              document.body
            )}

            {/* МЕНЕДЖЕР ИСТОРИЙ ЧЕРЕЗ ПОРТАЛ */}
            {isMounted && createPortal(
              <AnimatePresence>
                {isCommentaryOpen && (
                  <div key="commentary-manager-wrapper" className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <motion.div
                      key="commentary-backdrop"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      onClick={() => setIsCommentaryOpen(false)}
                      className="absolute inset-0 bg-black/85 backdrop-blur-md cursor-pointer"
                    />
                    <motion.div
                      key="commentary-modal-card"
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="relative w-full max-w-2xl h-[540px] bg-[#121212] border border-white/10 shadow-[0_0_100px_rgba(0,0,0,0.8)] flex flex-col rounded-[32px] overflow-hidden z-10"
                    >
                      <div className="flex flex-col items-center justify-center px-6 pt-6 pb-4 border-b border-white/5 bg-[#161616] relative flex-shrink-0">
                        <motion.button
                          onClick={() => setIsCommentaryOpen(false)}
                          whileHover={{ scale: 1.2, rotate: 90, color: "#ef4444" }}
                          whileTap={{ scale: 0.85 }}
                          transition={{ type: "spring", stiffness: 300, damping: 20 }}
                          className="absolute top-6 right-6 text-zinc-500 transition-colors text-2xl font-mono select-none z-10"
                        >
                          ×
                        </motion.button>
                        <span className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.5em] mb-2 opacity-50">{t.releaseBackground}</span>
                        <h2 className="text-xl font-black text-white uppercase tracking-tighter text-center leading-none">{t.story}</h2>
                      </div>
                      <div className="overflow-y-auto flex-1 px-6 md:px-10 py-6 bg-[#121212] custom-scrollbar flex flex-col justify-start min-h-0 text-left items-stretch">
                        {isAdmin ? (
                          <AdminStory text={commentaryText} onChange={setCommentaryText} onSave={handleSaveCommentary} loading={isSaving} t={t} />
                        ) : (
                          <UserStory text={commentaryText} t={t} />
                        )}
                      </div>
                      <div className="px-6 py-3.5 bg-[#161616] border-t border-white/5 flex justify-center flex-shrink-0">
                        <span className="text-[10px] font-black text-zinc-800 uppercase tracking-[0.6em]">{t.musicCommentary}</span>
                      </div>
                    </motion.div>
                  </div>
                )}
              </AnimatePresence>,
              document.body
            )}
          </motion.div>
        </div>
      )}

      {/* ЛАЙТБОКС */}
      <AnimatePresence>
        {isLightboxOpen && (
          <motion.div
            key="fullscreen-lightbox-view"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsLightboxOpen(false)}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-3xl cursor-zoom-out"
          >
            <button
              onClick={() => setIsLightboxOpen(false)}
              className="absolute top-8 right-8 text-zinc-500 hover:text-white transition-colors z-[110]"
            >
            </button>

            <motion.img
              initial={{ scale: 0.95, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 10 }}
              transition={{ type: "spring", duration: 0.4 }}
              src={release.cover_url || '/default.png'}
              alt={release.title}
              className="max-w-[90vw] max-h-[85vh] md:max-w-[70vw] lg:max-w-[50vw] aspect-square object-contain rounded-lg shadow-[0_0_50px_rgba(0,0,0,0.8)] select-none border border-white/5"
              onClick={(e) => e.stopPropagation()}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </AnimatePresence>
  )
}

const AdminStory = ({ text, onChange, onSave, loading, t }: any) => (
  <div className="flex flex-col gap-4 w-full h-full flex-1 min-h-0 text-left items-stretch">
    <textarea
      value={text}
      onChange={(e) => onChange(e.target.value)}
      placeholder={t?.placeholder || "Введи текст..."}
      /* Убедись, что p-5 одинаковый со всех сторон, а text-left выравнивает по левому краю без перекосов */
      className="w-full flex-1 bg-black/40 border border-white/5 p-5 rounded-[24px] text-base font-medium text-zinc-300 outline-none focus:border-white/20 transition resize-none custom-scrollbar tracking-tight min-h-0 text-left"
    />
    <button
      onClick={onSave}
      disabled={loading}
      className="flex items-center justify-center gap-2 bg-white text-black py-3.5 rounded-xl font-black uppercase text-[11px] tracking-widest hover:bg-zinc-200 transition active:scale-98 mt-2 flex-shrink-0"
    >
      <Save size={14} /> {loading ? t?.saving : t?.saveStory}
    </button>
  </div>
)

const UserStory = ({ text, t }: { text: string, t: any }) => (
  <div className="flex-1 w-full h-full min-h-0 bg-black/40 border border-white/5 p-6 rounded-[24px] overflow-y-auto custom-scrollbar flex flex-col justify-start items-start text-left">
    {text && text.trim() ? (
      <p className="text-zinc-200 text-base font-medium tracking-tight leading-relaxed whitespace-pre-wrap text-left w-full block">
        {text}
      </p>
    ) : (
      /* Если истории нет — аккуратно центрируем заглушку по центру серого поля */
      <div className="flex items-center justify-center w-full h-full my-auto py-10">
        <p className="text-zinc-600 text-xs font-black uppercase tracking-widest text-center w-full block">
          {t?.noStory || "Автор еще не добавил историю к этому релизу."}
        </p>
      </div>
    )}
  </div>
)

const ActionButtons = memo(({ handleShare, copied, isMultiTrack, isDownloadOpen, setIsDownloadOpen, audioUrl, title, t }: any) => {
  return (
    <div className="flex items-center justify-center sm:justify-start gap-3 mb-3">
      {/* Вернули чистые, родные классы Tailwind с group-hover — теперь они будут работать идеально */}
      <button
        onClick={handleShare}
        className="group flex items-center gap-2 px-5 py-2 bg-white/5 hover:bg-white/10 text-white rounded-full transition-all border border-white/10 hover:border-white/20 active:scale-95"
      >
        <Share2 size={16} className="text-zinc-400 group-hover:text-white transition-colors" />
        <span className="text-[12px] font-black uppercase tracking-widest">{copied ? t.copied : t.share}</span>
      </button>

      <div className="relative">
        {isMultiTrack ? (
          <button
            onClick={() => setIsDownloadOpen(!isDownloadOpen)}
            className="group flex items-center gap-2 px-5 py-2 bg-white/5 hover:bg-white/10 text-white rounded-full transition-all border border-white/10 hover:border-white/20 active:scale-95"
          >
            <Download size={16} className="text-zinc-400 group-hover:text-white transition-colors" />
            <span className="text-[12px] font-black uppercase tracking-widest">{isDownloadOpen ? t.close : t.getTracks}</span>
          </button>
        ) : (
          <DownloadButton url={audioUrl} fileName={title} />
        )}
      </div>
    </div>
  )
})

const EqualizerIcon = memo(() => {
  return (
    <div className="flex items-end gap-[2.5px] h-3.5 relative overflow-hidden pb-[1px] pointer-events-none isolate">
      <motion.div
        initial={{ scaleY: 0.3 }}
        animate={{ scaleY: [0.3, 1, 0.5, 0.9, 0.3] }}
        transition={{ repeat: Infinity, duration: 1.1, ease: "easeInOut" }}
        style={{ originY: "bottom" }}
        className="w-[2px] h-full bg-white rounded-t-[1px]"
      />
      <motion.div
        initial={{ scaleY: 0.6 }}
        animate={{ scaleY: [0.6, 0.2, 0.9, 0.4, 0.6] }}
        transition={{ repeat: Infinity, duration: 0.9, ease: "easeInOut" }}
        style={{ originY: "bottom" }}
        className="w-[2px] h-full bg-white rounded-t-[1px]"
      />
      <motion.div
        initial={{ scaleY: 0.4 }}
        animate={{ scaleY: [0.4, 0.9, 0.3, 0.7, 0.4] }}
        transition={{ repeat: Infinity, duration: 1.3, ease: "easeInOut" }}
        style={{ originY: "bottom" }}
        className="w-[2px] h-full bg-white rounded-t-[1px]"
      />
      <motion.div
        initial={{ scaleY: 0.2 }}
        animate={{ scaleY: [0.2, 0.7, 0.4, 0.9, 0.2] }}
        transition={{ repeat: Infinity, duration: 0.8, ease: "easeInOut" }}
        style={{ originY: "bottom" }}
        className="w-[2px] h-full bg-white rounded-t-[1px]"
      />
    </div>
  );
});
EqualizerIcon.displayName = 'EqualizerIcon';

ActionButtons.displayName = 'ActionButtons'
