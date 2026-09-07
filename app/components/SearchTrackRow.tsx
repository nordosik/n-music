'use client'
import { Play, Music, Heart } from 'lucide-react'
import { usePlayer } from '../lib/usePlayer'
import { motion } from 'framer-motion'
import { useState, useEffect, useRef, memo } from 'react'
import { locales } from '../lib/locales'

interface Track {
  id: string | number
  title: string
  audio_url: string
  cover_url?: string
  cover?: string
  image_url?: string
  duration: number
  lyrics?: string
  is_ecosystem?: boolean
  is_hot?: boolean
  collaborators?: string
  track_collaborators?: { artist_name?: string; name?: string }[]
  release?: any
  releases?: any
  release_tracks?: any
}

interface SearchTrackRowProps {
  track: Track
  allTracks: Track[]
}

const getArtistsList = (target: any): string[] => {
  const mainArtist = 'NORDOSIK'
  if (!target) return [mainArtist]
  if (typeof target.collaborators === 'string' && target.collaborators.trim().length > 0) {
    const list = target.collaborators.split(',').map((c: string) => c.trim()).filter(Boolean)
    return [mainArtist, ...list]
  }
  if (Array.isArray(target.track_collaborators) && target.track_collaborators.length > 0) {
    const list = target.track_collaborators.map((item: any) => item.artist_name || item.name).filter(Boolean)
    return [mainArtist, ...list]
  }
  return [mainArtist]
}

function SearchArtistsTooltip({
  artists,
  isSelectedTrack,
  t,
}: {
  artists: string[]
  isSelectedTrack: boolean
  t: any
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [isTruncated, setIsTruncated] = useState(false)
  const textRef = useRef<HTMLDivElement>(null)
  const closeTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    const checkOverflow = () => {
      if (textRef.current) {
        setIsTruncated(textRef.current.scrollWidth > textRef.current.clientWidth)
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
    closeTimeoutRef.current = setTimeout(() => setIsOpen(false), 200)
  }

  return (
    <div
      className="relative inline-block max-w-full min-w-0"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={(e) => e.stopPropagation()}
    >
      <div ref={textRef} className="w-full truncate overflow-hidden whitespace-nowrap block cursor-pointer">
        {artists.map((artist, idx) => (
          <span key={idx} className="inline">
            <motion.span
              whileHover={{ color: '#ffffff' }}
              whileTap={{ scale: 0.96 }}
              onClick={(e) => {
                e.stopPropagation()
                usePlayer.getState().openArtistModal(artist)
              }}
              className={`cursor-pointer transition-colors tracking-wider ${isSelectedTrack ? 'text-zinc-400 hover:text-white' : 'text-zinc-500 hover:text-white'
                }`}
            >
              {artist}
            </motion.span>
            {idx < artists.length - 1 && <span className="text-zinc-500 font-normal tracking-normal">, </span>}
          </span>
        ))}
      </div>

      {isTruncated && isOpen && (
        <div className="absolute left-0 top-full pt-1.5 z-50 pointer-events-auto">
          <div className="flex flex-col bg-zinc-900/95 backdrop-blur-md border border-white/10 p-2.5 rounded-xl shadow-2xl animate-in fade-in duration-150 w-max max-w-[260px]">
            <span className="text-[9px] font-black tracking-widest text-zinc-500 uppercase mb-1 px-1">
              {t?.artistsTooltip || t?.artists || 'Исполнители:'}
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
                  className="text-xs font-bold text-zinc-200 hover:text-white cursor-pointer bg-white/5 hover:bg-white/10 px-2 py-1 rounded-md transition-colors"
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

function SearchTrackRow({ track, allTracks }: SearchTrackRowProps) {
  const activeTrack = usePlayer((state) => state.activeTrack)
  const isPlaying = usePlayer((state) => state.isPlaying)
  const setQueue = usePlayer((state) => state.setQueue)
  const setIsPlaying = usePlayer((state) => state.setIsPlaying)
  const language = usePlayer((state) => state.language)
  const t = locales[language as 'ru' | 'en'] || locales.ru

  const [isMounted, setIsMounted] = useState(false)
  useEffect(() => {
    setIsMounted(true)
  }, [])

  const isCurrentTrackPlaying = activeTrack?.id === track.id && isPlaying
  const isSelectedTrack = activeTrack?.id === track.id

  const handlePlayClick = () => {
    if (isSelectedTrack) {
      setIsPlaying(!isPlaying)
    } else {
      const idx = allTracks.findIndex((t) => t.id === track.id)
      setQueue(allTracks, idx !== -1 ? idx : 0)
    }
  }

  const formatDuration = (s: number) => {
    if (!s) return '0:00'
    const sec = Math.round(s)
    return `${Math.floor(sec / 60)}:${(sec % 60).toString().padStart(2, '0')}`
  }

  const isEcosystem = track.is_ecosystem
  const isHot = track.is_hot

  console.log('Данные трека в поиске:', track.title, track)

  // БРОНЕБОЙНЫЙ РЕЗОЛВ ОБЛОЖКИ (с учетом массивов из JOIN в Supabase)
  const getCoverUrl = (obj: any) => obj?.cover_url || obj?.cover || obj?.image_url || null

  const trackCover =
    getCoverUrl(track) ||
    getCoverUrl(track.release) ||
    (Array.isArray(track.releases) ? getCoverUrl(track.releases[0]) : getCoverUrl(track.releases)) ||
    (Array.isArray(track.release_tracks) && track.release_tracks[0]?.releases
      ? Array.isArray(track.release_tracks[0].releases)
        ? getCoverUrl(track.release_tracks[0].releases[0])
        : getCoverUrl(track.release_tracks[0].releases)
      : null)

  return (
    <div
      onClick={handlePlayClick}
      className={`w-full h-14 rounded-lg px-4 flex items-center justify-between cursor-pointer group border transition-all duration-300 relative ${isCurrentTrackPlaying
          ? isEcosystem
            ? 'bg-emerald-950/20 border-emerald-400 shadow-[0_0_20px_rgba(52,211,153,0.35)] scale-[1.01]'
            : isHot
              ? 'bg-red-950/20 border-red-500 shadow-[0_0_20px_rgba(239,68,68,0.35)] scale-[1.01]'
              : 'bg-zinc-800/40 border-zinc-700 shadow-md scale-[1.01]'
          : isEcosystem
            ? 'bg-zinc-900/40 border-emerald-500/20 hover:border-emerald-500/40'
            : isHot
              ? 'bg-zinc-900/40 border-red-500/20 hover:border-red-500/40'
              : 'bg-zinc-900/40 border-zinc-800/60 hover:bg-zinc-800/40 hover:border-zinc-700'
        }`}
    >
      {/* ЛЕВАЯ ЧАСТЬ */}
      <div className="flex items-center gap-x-3 truncate flex-1 mr-4 min-w-0">
        <div className="w-5 h-5 flex items-center justify-center text-zinc-500 group-hover:text-white transition-colors flex-shrink-0">
          {isMounted &&
            (isCurrentTrackPlaying ? (
              <MiniEqualizer />
            ) : isSelectedTrack && !isPlaying ? (
              <Play size={12} className="text-zinc-400 fill-current" />
            ) : (
              <Play size={12} className="opacity-0 group-hover:opacity-100 fill-current text-zinc-400 transition-opacity" />
            ))}
        </div>

        {/* ОБЛОЖКА */}
        <div className="w-8 h-8 bg-zinc-800 rounded overflow-hidden flex-shrink-0 flex items-center justify-center shadow-md">
          {track.cover_url ? (
            <img src={track.cover_url} alt={track.title} className="w-full h-full object-cover" loading="lazy" />
          ) : (
            <Music className="text-zinc-600" size={14} />
          )}
        </div>

        {/* МЕТАДАННЫЕ ТРЕКА */}
        <div className="truncate flex-1 min-w-0">
          <h4 className={`text-xs font-black tracking-wide truncate transition-colors duration-300 ${isCurrentTrackPlaying ? 'text-white' : 'text-zinc-400 group-hover:text-white'
            }`}>
            {track.title}
          </h4>
          <div className="flex items-center mt-0.5 text-[9px] font-bold select-none min-w-0">
            <SearchArtistsTooltip artists={getArtistsList(track)} isSelectedTrack={isSelectedTrack} t={t} />
            {isEcosystem && (
              <>
                <span className="text-zinc-600 mx-1 font-normal flex-shrink-0">•</span>
                <span className="text-[9px] font-black tracking-widest text-emerald-500/80 flex-shrink-0">
                  {isMounted ? t.singleReleaseNotice || 'Single' : 'Single'}
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ПРАВАЯ ЧАСТЬ */}
      <div onClick={(e) => e.stopPropagation()} className="flex items-center gap-4 flex-shrink-0 relative z-20">
        {isEcosystem && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_10px_#34d399]" />}
        {isHot && (
          <span className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-widest bg-red-500/20 text-red-400 border border-red-500/40">
            HOT
          </span>
        )}

        {/* ЛАЙК */}
        <motion.button
          onClick={() => console.log('Лайк из поиска для трека:', track.title)}
          whileHover={{ scale: 1.12 }}
          whileTap={{ scale: 0.85 }}
          className="text-zinc-500 hover:text-white transition-colors p-1 flex items-center justify-center"
        >
          <Heart size={20} strokeWidth={2.8} />
        </motion.button>

        {/* ДЛИТЕЛЬНОСТЬ */}
        <div className="text-[11px] font-mono font-normal text-zinc-400 group-hover:text-zinc-200 transition-colors duration-300 w-11 text-right select-none tracking-tight">
          {formatDuration(track.duration)}
        </div>
      </div>
    </div>
  )
}

const MiniEqualizer = memo(() => (
  <div className="flex items-end gap-[2px] h-3 pointer-events-none isolate transform-gpu">
    <motion.div animate={{ height: [4, 12, 4] }} transition={{ repeat: Infinity, duration: 0.6 }} className="w-[2px] bg-white" />
    <motion.div animate={{ height: [2, 12, 2] }} transition={{ repeat: Infinity, duration: 0.8 }} className="w-[2px] bg-white" />
    <motion.div animate={{ height: [6, 12, 6] }} transition={{ repeat: Infinity, duration: 0.7 }} className="w-[2px] bg-white" />
  </div>
))
MiniEqualizer.displayName = 'MiniEqualizer'

export default memo(SearchTrackRow)