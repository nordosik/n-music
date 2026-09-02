'use client'
import { Play, Music, Disc, Pause } from 'lucide-react'
import { motion } from 'framer-motion'
import { usePlayer } from '../lib/usePlayer'
import { locales } from '../lib/locales'
import { supabase } from '../lib/supabase'

interface TrackItemProps {
  release: any;
  index: number;
  onClick: () => void;
}

export default function TrackItem({ release, index, onClick }: TrackItemProps) {
  const isPlaying = usePlayer(state => state.isPlaying)
  const activeTrack = usePlayer(state => state.activeTrack)
  const setQueue = usePlayer(state => state.setQueue)
  const setIsPlaying = usePlayer(state => state.setIsPlaying)
  const language = usePlayer(state => state.language)
  const t = locales[language as 'ru' | 'en' || 'en']

  // Проверка: играет ли сейчас этот конкретный релиз
  const isCurrentActive = !!(
    isPlaying &&
    activeTrack &&
    (
      // 1. Прямые совпадения ID
      activeTrack.id === release.id ||
      activeTrack.release_id === release.id ||

      // 2. Совпадения по названию релиза (от модалки или плеера)
      activeTrack.release_id === release.title ||
      activeTrack.release_title === release.title ||

      // 3. Проверка: принадлежит ли активный трек списку треков этого релиза
      (Array.isArray(release.tracks) && release.tracks.some((t: any) => t.id === activeTrack.id)) ||

      // 4. Фоллбэк для синглов по названию
      activeTrack.title === release.title
    )
  );

  // Функция для мгновенного запуска первого трека релиза без открытия модалки
  const handleQuickPlay = async (e: React.MouseEvent) => {
    e.stopPropagation();

    // Если этот релиз уже играет — просто переключаем play/pause БЕЗ повторных запросов
    if (isCurrentActive) {
      setIsPlaying(!isPlaying);
      return;
    }

    // 1. Сначала проверяем, есть ли треки уже внутри объекта релиза
    let tracksToPlay = Array.isArray(release.tracks) ? release.tracks : [];

    // 2. Если массив пустой — выкачиваем треки из Supabase по ID релиза
    if (tracksToPlay.length === 0) {
      const { data: fetchedTracks } = await supabase
        .from('tracks')
        .select('*')
        .eq('release_id', release.id)
        .order('position', { ascending: true });

      if (fetchedTracks && fetchedTracks.length > 0) {
        tracksToPlay = fetchedTracks;
      }
    }

    // 3. Формируем корректную очередь из треков (обогащаем данными релиза)
    if (tracksToPlay.length > 0) {
      const formattedTracks = tracksToPlay.map((t: any) => ({
        ...t,
        release_id: release.id,
        release_title: release.title,
        cover_url: t.cover_url || release.cover_url
      }));

      setQueue(formattedTracks, 0);
      setIsPlaying(true);
    } else {
      // Фоллбэк для сингла: создаем объект ТРЕКА на основе релиза
      const singleTrack = {
        id: release.id,
        title: release.title,
        audio_url: release.audio_url,
        cover_url: release.cover_url,
        release_id: release.id,
        release_title: release.title,
        duration: release.duration || 0
      };
      setQueue([singleTrack], 0);
      setIsPlaying(true);
    }
  };

  const variants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 }
  };

  const isEcosystem = release.is_ecosystem
  const isHot = release.is_hot

  return (
    <motion.div
      onClick={onClick}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.01 }}
      variants={variants}
      transition={{ duration: 0.5, ease: "easeOut", delay: index * 0.05 }}
      className={`group cursor-pointer p-4 rounded-md transition-all duration-500 border-2 box-border flex flex-col h-auto ${isCurrentActive
        ? isEcosystem
          ? 'bg-emerald-950/20 border-emerald-400 shadow-[0_0_25px_rgba(52,211,153,0.35),inset_0_0_15px_rgba(52,211,153,0.15)] scale-[1.02]'
          : isHot
            ? 'bg-red-950/20 border-red-500 shadow-[0_0_25px_rgba(239,68,68,0.35),inset_0_0_15px_rgba(239,68,68,0.15)] scale-[1.02]'
            : 'bg-zinc-800/80 border-white shadow-[0_0_25px_rgba(255,255,255,0.2),inset_0_0_15px_rgba(255,255,255,0.05)] scale-[1.02]'
        : isEcosystem
          ? 'bg-zinc-900/40 border-emerald-500/30 shadow-[0_0_12px_rgba(52,211,153,0.05)] hover:border-emerald-400 hover:shadow-[0_0_20px_rgba(52,211,153,0.2)]'
          : isHot
            ? 'bg-zinc-900/40 border-red-500/30 shadow-[0_0_12px_rgba(239,68,68,0.05)] hover:border-red-400 hover:shadow-[0_0_20px_rgba(239,68,68,0.2)]'
            : 'bg-zinc-900/40 border-transparent hover:bg-zinc-800/60'
        }`}
    >
      <motion.div
        whileHover={{ scale: 1.02 }}
        className="aspect-square bg-zinc-800 rounded-md mb-4 flex items-center justify-center relative overflow-hidden shadow-lg"
      >
        {release.cover_url ? (
          <img
            src={release.cover_url}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105 transform-gpu will-change-transform"
            style={{
              imageRendering: 'auto',
              backfaceVisibility: 'hidden',
              WebkitBackfaceVisibility: 'hidden'
            }}
            alt={release.title}
          />
        ) : (
          <div className="w-full h-full bg-zinc-800 flex items-center justify-center">
            {release.release_type === 'album' || release.release_type === 'ep' ? (
              <Disc className="text-zinc-600 w-12 h-12 animate-[spin_8s_linear_infinite]" />
            ) : (
              <Music className="text-zinc-600 w-12 h-12" />
            )}
          </div>
        )}

        <button
          onClick={handleQuickPlay}
          className={`absolute bottom-3 right-3 transition-all duration-300 drop-shadow-2xl z-30 flex items-center justify-center p-3 bg-white text-black rounded-full hover:scale-110 active:scale-95 shadow-[0_8px_24px_rgba(0,0,0,0.5)] ${isCurrentActive ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0'
            }`}
        >
          {isCurrentActive ? <Pause fill="black" size={20} /> : <Play fill="black" size={20} className="ml-0.5" />}
        </button>
      </motion.div>

      {/* Заголовок строго под 2 строки */}
      <h3 className="font-bold text-sm text-white leading-tight break-words line-clamp-2 h-10 flex items-start mt-1">
        {release.title}
      </h3>

      {/* Компактный подвал без гигантского разрыва */}
      <div className="flex flex-wrap items-center gap-2 mt-0">
        <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-medium">
          {release.release_type === 'album' && t.album}
          {release.release_type === 'ep' && t.ep}
          {release.release_type === 'single' && t.single}
          {!release.release_type && t.single} • {new Date(release.created_at || Date.now()).getFullYear()}
        </p>

        {isEcosystem && (
          <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_12px_#34d399,0_0_4px_#34d399]" />
        )}
        {isHot && (
          <span className="text-[8px] font-black px-1.5 py-0.5 bg-red-500/20 text-red-400 border border-red-500/40 rounded-sm tracking-wider shadow-[0_0_10px_rgba(239,68,68,0.2)]">
            HOT
          </span>
        )}
      </div>
    </motion.div>
  )
}