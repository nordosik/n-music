'use client'
import { useParams, useRouter } from 'next/navigation'
import { useEffect, useState, memo, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { usePlayer } from '../../lib/usePlayer'
import { Share2, Clock, Play, Pause, Music, X, Heart } from 'lucide-react'
import { locales } from '../../lib/locales'

function TruncatedArtists({
  collaboratorsStr,
  openArtistModal,
  $t
}: {
  collaboratorsStr?: string;
  openArtistModal: (name: string) => void;
  $t: any;
}) {
  const [isTruncated, setIsTruncated] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const closeTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const artists = ['NORDOSIK']
  if (collaboratorsStr) {
    const extra = collaboratorsStr
      .split(',')
      .flatMap(a => a.split('x'))
      .map(a => a.trim())
      .filter(Boolean)
    artists.push(...extra)
  }

  useEffect(() => {
    const checkOverflow = () => {
      if (containerRef.current) {
        const hasOverflow = containerRef.current.scrollWidth > containerRef.current.clientWidth
        setIsTruncated(hasOverflow)
      }
    }
    checkOverflow()
    window.addEventListener('resize', checkOverflow)
    return () => window.removeEventListener('resize', checkOverflow)
  }, [collaboratorsStr])

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
      className="relative inline-block min-w-0 w-full"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div
        ref={containerRef}
        className="w-full truncate text-[10px] tracking-widest text-zinc-500 overflow-hidden whitespace-nowrap block cursor-pointer"
      >
        {artists.map((artist, index) => (
          <span key={index} className="inline">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                openArtistModal(artist)
              }}
              className="text-zinc-400 hover:text-white transition-colors cursor-pointer font-bold no-underline inline"
            >
              {artist}
            </button>
            {index < artists.length - 1 && <span className="mr-1 text-zinc-500 font-bold">, </span>}
          </span>
        ))}
      </div>

      {isTruncated && isOpen && (
        <div className="absolute left-0 top-full pt-1.5 z-50 pointer-events-auto before:content-[''] before:absolute before:-top-3 before:left-0 before:right-0 before:h-4">
          <div className="flex flex-col bg-zinc-900/95 backdrop-blur-md border border-white/10 p-2.5 rounded-xl shadow-2xl transition-all animate-in fade-in slide-in-from-top-1 duration-150 w-max max-w-[260px]">
            <span className="text-[9px] font-black tracking-widest text-zinc-500 uppercase mb-1 px-1">
              {$t.artistsTooltip || 'ARTISTS:'}
            </span>
            <div className="flex items-center flex-wrap gap-1">
              {artists.map((artist, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    openArtistModal(artist)
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

export default function ReleasePage() {
  const { id } = useParams()
  const router = useRouter()
  const [release, setRelease] = useState<any>(null)
  const [tracks, setTracks] = useState<any[]>([])

  const activeTrack = usePlayer(state => state.activeTrack)
  const isPlaying = usePlayer(state => state.isPlaying)
  const setIsPlaying = usePlayer(state => state.setIsPlaying)
  const setQueue = usePlayer(state => state.setQueue)
  const isLyricsOpen = usePlayer(state => state.isLyricsOpen)
  const language = usePlayer(state => state.language)
  const openArtistModal = usePlayer(state => state.openArtistModal)
  const $t = locales[language as 'ru' | 'en'] || locales.en

  const [isMounted, setIsMounted] = useState(false)
  useEffect(() => {
    setIsMounted(true)
  }, [])

  const [copied, setCopied] = useState(false)
  const [playerHidden, setPlayerHidden] = useState(false)

  const togglePlayer = () => {
    const newState = !playerHidden
    setPlayerHidden(newState)
    window.dispatchEvent(new CustomEvent('toggle-player', { detail: newState }))
  }

  const TrackListEqualizer = memo(() => {
    return (
      <div className="flex items-end gap-[2px] h-3 pointer-events-none isolate transform-gpu">
        <span className="w-[2px] h-3 bg-white block animate-[pulse_0.6s_infinite_alternate]" />
        <span className="w-[2px] h-2 bg-white block animate-[pulse_0.8s_infinite_alternate]" />
        <span className="w-[2px] h-3 bg-white block animate-[pulse_0.7s_infinite_alternate]" />
      </div>
    )
  })
  TrackListEqualizer.displayName = 'TrackListEqualizer'

  useEffect(() => {
    const fetchReleaseData = async () => {
      if (!id) return

      // 1. Получаем сам релиз
      const { data: relData } = await supabase
        .from('releases')
        .select('*')
        .eq('id', id)
        .single()

      if (relData) {
        setRelease(relData)

        // 2. Получаем треки через связующую таблицу release_tracks
        const { data: relTracksData } = await supabase
          .from('release_tracks')
          .select('track_number, tracks(*)')
          .eq('release_id', relData.id)
          .order('track_number', { ascending: true })

        if (relTracksData && relTracksData.length > 0) {
          const formattedTracks = relTracksData
            .filter((item: any) => item.tracks)
            .map((item: any) => ({
              ...item.tracks,
              cover_url: relData.cover_url,
              release_title: relData.title
            }))
          setTracks(formattedTracks)
        } else {
          // Запасной фоллбек на случай сингла без записей в release_tracks
          setTracks([{
            ...relData,
            id: relData.id + '_tr',
            duration: relData.duration || 0,
            audio_url: relData.audio_url,
            plays_count: relData.plays_count || 0
          }])
        }
      }
    }
    fetchReleaseData()
  }, [id])

  useEffect(() => {
    let timeoutId: NodeJS.Timeout
    if (copied) {
      timeoutId = setTimeout(() => setCopied(false), 2000)
    }
    return () => {
      if (timeoutId) clearTimeout(timeoutId)
    }
  }, [copied])

  if (!release) return null

  const isCurrentPlaying = activeTrack && isPlaying && tracks.some(t =>
    t.id === activeTrack.id ||
    t.title === activeTrack.title ||
    (t.release_id && activeTrack.id === t.release_id)
  );

  const renderArtistLinks = (collaboratorsStr?: string, className: string = '') => {
    const artists = ['NORDOSIK']
    if (collaboratorsStr) {
      const extra = collaboratorsStr.split(',').flatMap(a => a.split('x')).map(a => a.trim()).filter(Boolean)
      artists.push(...extra)
    }
    return (
      <div className={`flex items-center flex-wrap gap-1 ${className}`}>
        {artists.map((artist, index) => (
          <span key={index} className="inline-flex items-center">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                openArtistModal(artist)
              }}
              className="text-zinc-400 hover:text-white transition-colors cursor-pointer font-bold no-underline"
            >
              {artist}
            </button>
            {index < artists.length - 1 && <span className="mr-1 text-zinc-500 font-bold">, </span>}
          </span>
        ))}
      </div>
    )
  }

  return (
    <main className="min-h-screen bg-[#0c0c0e] text-white p-8 md:p-24 overflow-y-auto relative">
      {!isLyricsOpen && (
        <button
          onClick={() => router.push('/')}
          className="fixed top-8 right-8 z-50 p-2 text-zinc-700 hover:text-white transition-colors"
        >
          <X size={32} strokeWidth={1.5} />
        </button>
      )}

      <div className="flex flex-col lg:flex-row min-h-screen w-full relative">
        {/* ЛЕВАЯ КОЛОНКА */}
        <div className="w-full lg:w-[400px] lg:fixed lg:top-0 lg:left-0 lg:bottom-0 p-12 flex flex-col justify-start z-20 bg-[#050505] md:bg-transparent">
          <div className="relative w-64 h-64 mb-8 shrink-0 mt-4 group">
            <div
              className="absolute -inset-1 bg-cover bg-center blur-xl opacity-0 group-hover:opacity-35 transition-all duration-500 transform-gpu pointer-events-none rounded-2xl brightness-75 contrast-125"
              style={{ backgroundImage: `url(${release.cover_url})` }}
            />
            <div className="relative z-10 w-full h-full rounded-2xl overflow-hidden transform-gpu transition-all duration-500 ease-out group-hover:-translate-y-2 group-hover:scale-[1.01] shadow-[0_10px_30px_rgba(0,0,0,0.8)]">
              <img src={release.cover_url} className="w-full h-full object-cover" alt={release.title} />
            </div>
          </div>

          <div className="w-full text-center md:text-left">
            <span className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-500 mb-2 block">
              {release.release_type === 'album' && $t.album}
              {release.release_type === 'ep' && $t.ep}
              {release.release_type === 'single' && $t.single}
              {!release.release_type && $t.single}
            </span>
            <h1 className="text-4xl font-black tracking-tighter uppercase leading-none mb-2">
              {release.title}
            </h1>
            <div className="text-sm font-bold tracking-wide mb-4">
              {renderArtistLinks(release.collaborators)}
            </div>

            <div className="flex items-center justify-center md:justify-start gap-6 mt-4">
              <button
                onClick={() => {
                  if (isCurrentPlaying) setIsPlaying(false)
                  else {
                    setQueue(tracks, 0)
                    setIsPlaying(true)
                  }
                }}
                className="w-14 h-14 bg-white text-black rounded-full flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-xl"
              >
                {isCurrentPlaying ? <Pause size={24} fill="black" /> : <Play size={24} fill="black" className="ml-1" />}
              </button>

              <button
                onClick={togglePlayer}
                className={`p-3 rounded-full border transition-all ${playerHidden
                  ? 'bg-white text-black border-white'
                  : 'bg-transparent text-zinc-500 border-white/10 hover:text-white'
                  }`}
                title={isMounted ? (playerHidden ? $t.showPlayer : $t.hidePlayer) : (playerHidden ? 'Show Player' : 'Hide Player')}
              >
                {playerHidden ? <Music size={18} /> : <X size={18} />}
              </button>

              <button
                onClick={() => {
                  navigator.clipboard.writeText(window.location.href)
                  setCopied(true)
                }}
                className="text-zinc-500 hover:text-white transition-colors"
              >
                {copied ? <div className="text-[10px] font-bold text-white">{$t.copiedUpper}</div> : <Share2 size={24} />}
              </button>
            </div>
          </div>
        </div>

        {/* ПРАВАЯ КОЛОНКА: ТРЕКЛИСТ */}
        <div className="flex-1 lg:ml-[400px] min-h-screen flex flex-col p-6 pt-12 md:p-12 md:pt-12">
          <div className="w-full flex items-center justify-between px-2 py-3 border-b border-white/10 mb-6 shrink-0">
            <span className="text-[11px] font-black uppercase tracking-[0.4em] text-zinc-500">
              {isMounted ? $t.tracklist : 'TRACKLIST'}
            </span>
            <Clock size={14} className="text-zinc-500" />
          </div>

          <div className="flex-1 overflow-y-auto px-3 pr-2 custom-scrollbar overscroll-contain">
            <div className="flex flex-col">
              {tracks.map((track, i) => {
                const isCurrent = !!(
                  activeTrack && (
                    // 1. Прямое совпадение по ID трека
                    activeTrack.id === track.id ||
                    // 2. Если у трека есть release_id, а activeTrack.id — это ID релиза
                    (track.release_id && activeTrack.id === track.release_id) ||
                    // 3. Совпадение по названию трека
                    activeTrack.title === track.title
                  )
                );
                const isCurrentTrackPlaying = isCurrent && isPlaying;
                const isEcosystemTrack = track.is_ecosystem
                const isHotNew = track.is_hot

                return (
                  <div
                    key={track.id}
                    onClick={() => {
                      setQueue(tracks, i)
                      setIsPlaying(true)
                    }}
                    className={`group flex items-center justify-between p-4 rounded-lg my-2 mx-0.5 cursor-pointer transition-all duration-300 relative border ${isCurrentTrackPlaying
                      ? isEcosystemTrack
                        ? 'bg-emerald-950/20 border-emerald-400 shadow-[0_0_20px_rgba(52,211,153,0.35),inset_0_0_12px_rgba(52,211,153,0.15)] scale-[1.01]'
                        : isHotNew
                          ? 'bg-red-950/20 border-red-500 shadow-[0_0_20px_rgba(239,68,68,0.35),inset_0_0_12px_rgba(239,68,68,0.15)] scale-[1.01]'
                          : 'bg-white/5 border-white/20 shadow-[0_0_20px_rgba(255,255,255,0.05)] scale-[1.01]'
                      : isEcosystemTrack
                        ? 'bg-zinc-900/10 border-emerald-500/10 hover:border-emerald-500/30'
                        : isHotNew
                          ? 'bg-zinc-900/10 border-red-500/10 hover:border-red-500/30'
                          : 'bg-transparent border-transparent hover:bg-white/[0.02]'
                      }`}
                  >
                    <div className="flex items-center gap-6 min-w-0 flex-1 pr-4">
                      <span className="w-6 flex items-center justify-center text-[12px] font-mono flex-shrink-0">
                        {isCurrentTrackPlaying ? (
                          <TrackListEqualizer />
                        ) : (
                          <span className={isCurrent ? 'text-white font-bold' : 'text-zinc-600 group-hover:text-zinc-400 transition-colors'}>
                            {i + 1}
                          </span>
                        )}
                      </span>

                      <div className="flex flex-col min-w-0 flex-1 justify-center">
                        <span className={`text-sm font-black uppercase tracking-wide break-words whitespace-normal transition-colors duration-300 ${isCurrent ? 'text-white' : 'text-zinc-400 group-hover:text-white'
                          }`}>
                          {track.title}
                        </span>

                        <div className="flex items-center gap-1.5 mt-0.5 min-w-0 w-full">
                          <TruncatedArtists
                            collaboratorsStr={track.collaborators}
                            openArtistModal={openArtistModal}
                            $t={$t}
                          />
                          {isEcosystemTrack && (
                            <span className="text-[9px] uppercase font-black tracking-widest text-emerald-500/80 truncate shrink-0">
                              {$t.singleReleaseNotice}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* ПРОСЛУШИВАНИЯ */}
                    <div className="flex items-center justify-center flex-1 px-4">
                      {track.plays_count && track.plays_count > 0 ? (
                        <span className={`text-sm md:text-base font-mono font-normal tracking-tighter relative z-20 ${isCurrent ? 'text-white' : 'text-zinc-500'
                          }`}>
                          {track.plays_count.toLocaleString('en-US')}
                        </span>
                      ) : (
                        <div className="w-1" />
                      )}
                    </div>

                    <div className="flex items-center gap-6 flex-shrink-0 pl-4">
                      <div onClick={(e) => e.stopPropagation()} className="flex items-center gap-4">
                        {isEcosystemTrack && (
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_10px_#34d399,0_0_4px_#34d399]" />
                        )}
                        {isHotNew && (
                          <span className="text-[8px] font-black px-1.5 py-0.5 bg-red-500/20 text-red-400 border border-red-500/40 rounded-sm tracking-widest">
                            HOT
                          </span>
                        )}

                        <button
                          onClick={() => {
                            console.log('Лайк со страницы релиза для трека:', track.title)
                          }}
                          className="text-zinc-500 hover:text-white transition-colors p-1 flex items-center justify-center"
                        >
                          <Heart
                            size={20}
                            strokeWidth={2.8}
                            className="drop-shadow-[0_0_8px_rgba(255,255,255,0.1)]"
                          />
                        </button>
                      </div>

                      <span className={`text-[11px] font-mono w-11 text-right transition-colors ${isCurrent ? 'text-white' : 'text-zinc-600 group-hover:text-zinc-400'
                        }`}>
                        {Math.floor(track.duration / 60)}:{(track.duration % 60).toString().padStart(2, '0')}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}