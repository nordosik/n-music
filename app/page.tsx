'use client'

import { Play, SlidersHorizontal } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import UploadModal from './components/UploadModal';
import ReleaseModal from './components/ReleaseModal';
import { supabase } from './lib/supabase';
import TrackItem from './components/TrackItem';
import Hero from './components/Hero';
import SmartSearch from './components/SmartSearch';
import { useState, useEffect } from 'react';
import { usePlayer } from './lib/usePlayer'; // ИМПОРТ 1: Подключаем стор
import { locales } from './lib/locales';   // ИМПОРТ 2: Подключаем словарь

function HomeContent() {
  const [releases, setReleases] = useState<any[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedRelease, setSelectedRelease] = useState<any>(null);
  const [tracks, setTracks] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const searchParams = useSearchParams();
  const [isAdmin, setIsAdmin] = useState(false)

  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Стейты для Ч/Б системы фильтрации и сортировки
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);
  const [activeType, setActiveType] = useState<string>('all'); // all, album, ep, single
  const [sortBy, setSortBy] = useState<string>('newest'); // newest, oldest, tracks_max, tracks_min, duration_max, duration_min

  // Достаем текущий язык из глобального Zustand-стора
  const language = usePlayer(state => state.language);
  const t = locales[language as 'ru' | 'en' || 'en'];

  // НАШИ НОВЫЕ СТРОЧКИ ДЛЯ ВЕРХНЕЙ ПАНЕЛИ
  const isTopPanelOpen = usePlayer(state => state.isTopPanelOpen);
  const setIsTopPanelOpen = usePlayer(state => state.setIsTopPanelOpen);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const checkAdmin = async () => {
        const secretKey = 'topsecret'
        if (searchParams.get('admin') === secretKey) {
          setIsAdmin(true)
          localStorage.setItem('admin_access', 'true')
          return
        }
        if (localStorage.getItem('admin_access') === 'true') {
          setIsAdmin(true)
          return
        }
        const { data: { user } } = await supabase.auth.getUser()
        const ADMIN_ID = '1537751f-7b84-4530-984d-9a64b6098e51';
        if (user && user.id === ADMIN_ID) {
          setIsAdmin(true)
        }
      }
      checkAdmin()
    }
  }, [searchParams])

  useEffect(() => {
    const fetchReleases = async () => {
      // 1. Запрашиваем релизы и подтягиваем связанную таблицу tracks с правильными колонками
      const { data: releasesData, error } = await supabase
        .from('releases')
        .select(`
    *,
    release_tracks (
      track_number,
      tracks (
        id,
        title,
        duration,
        audio_url,
        plays_count,
        collaborators,
        is_ecosystem,
        is_hot
      )
    )
  `)
        .order('id', { ascending: false })
        .order('track_number', { foreignTable: 'release_tracks', ascending: true }); // <--- Вот эта строчка сортирует треки прямо в БД

      if (error || !releasesData) {
        console.error('Детали ошибки Supabase:', error?.message, error?.details, error?.hint);
        return;
      }

      // 2. Преобразуем структуру: достаем треки из release_tracks и привязываем обложку от релиза
      const enrichedReleases = releasesData.map((release: any) => {
        const sortedTracks = (release.release_tracks || [])
          // Жесткая сортировка по числу track_number
          .sort((a: any, b: any) => (a.track_number || 0) - (b.track_number || 0))
          .map((item: any) => item.tracks)
          .filter(Boolean)
          .map((t: any) => ({
            ...t,
            cover_url: release.cover_url,
            audio_url: t.audio_url,
            collaborators: t.collaborators || ''
          }));

        const trackCollabs = sortedTracks.length > 0 ? (sortedTracks[0].collaborators || '') : '';

        return {
          ...release,
          tracks: sortedTracks,
          collaborators: release.collaborators || trackCollabs
        };
      });

      setReleases(enrichedReleases);
    };

    fetchReleases();
  }, []);

  useEffect(() => {
    document.body.classList.toggle('modal-open', isModalOpen);
  }, [isModalOpen]);

  const handleOpenRelease = (release: any) => {
    if (isModalOpen && selectedRelease?.id === release.id) {
      return;
    }
    setSelectedRelease(release);
    setIsModalOpen(true);

    if (release.tracks && release.tracks.length > 0) {
      setTracks(release.tracks);
    } else {
      // Идеальный сингл-трек, который подхватит collaborators из релиза
      setTracks([{
        ...release,
        id: release.id,
        title: release.title,
        audio_url: release.audio_url,
        cover_url: release.cover_url,
        collaborators: release.collaborators || ''
      }]);
    }
  };

  // === ИДЕАЛЬНАЯ ЧИСТАЯ СОРТИРОВКА ПОД ИСПРАВЛЕННУЮ БД ===
  const filteredReleases = (releases || []).filter(release => {
    if (activeType === 'all') return true;
    return release.release_type?.toLowerCase() === activeType.toLowerCase();
  }).sort((a, b) => {
    // 1. Сортировка по дате добавления (ID)
    if (sortBy === 'newest') return b.id - a.id;
    if (sortBy === 'oldest') return a.id - b.id;

    // 2. Сортировка по КОЛИЧЕСТВУ ТРЕКОВ (строго по столбцу tracks_count из БД)
    if (sortBy === 'tracks_max' || sortBy === 'tracks_min') {
      const countA = Number(a.tracks_count) || 0;
      const countB = Number(b.tracks_count) || 0;

      if (countA === countB) return b.id - a.id; // Если поровну, свежие выше
      return sortBy === 'tracks_max' ? countB - countA : countA - countB;
    }

    // 3. Сортировка по ДЛИТЕЛЬНОСТИ РЕЛИЗА (строго по столбцу duration из БД)
    if (sortBy === 'duration_max' || sortBy === 'duration_min') {
      const durA = Number(a.duration) || 0;
      const durB = Number(b.duration) || 0;

      if (durA === durB) return b.id - a.id;
      return sortBy === 'duration_max' ? durB - durA : durA - durB;
    }

    return 0;
  });

  const isSearching = searchQuery.trim().length > 0;

  return (
    <main className="min-h-screen bg-[#050505] text-zinc-100 pb-32">
      {/* Если внутри Hero.tsx тоже есть английский (например, Personal Discography) — мы передадим туда t позже */}
      <Hero />

      <div className="px-8 mt-12">
        <div className="flex justify-between items-center mb-8">
          <div className="flex items-center gap-6">
            <h2 className="text-2xl font-bold tracking-tight">
              {!isMounted
                ? (isSearching ? "Search Results" : "Recent Releases")
                : (isSearching ? (t.searchResults || "Результаты поиска") : t.recentReleases)
              }
            </h2>

            {/* Брутальная кнопка фильтров с плавным откликом */}
            {isMounted && !isSearching && (
              <motion.button
                whileHover={{ scale: 1.02, backgroundColor: isFilterPanelOpen ? "#27272a" : "#141417" }}
                whileTap={{ scale: 0.98 }}
                transition={{ duration: 0.15 }}
                onClick={() => setIsFilterPanelOpen(!isFilterPanelOpen)}
                className={`flex items-center gap-2 h-10 px-5 border font-mono text-xs font-bold tracking-wider rounded-full ${isFilterPanelOpen
                  ? 'bg-zinc-800 border-zinc-700 text-white'
                  : 'bg-zinc-900/50 text-zinc-400 border-zinc-800 hover:border-zinc-700 hover:text-white'
                  }`}
              >
                <SlidersHorizontal size={14} />
                <span>{isFilterPanelOpen ? (t.close || "ЗАКРЫТЬ") : (t.filters || "ФИЛЬТРЫ")}</span>
              </motion.button>
            )}
          </div>

          <div className="flex items-center gap-4">
            <div className="relative flex items-center" style={{ height: '40px' }}>
              <div className="absolute z-20 flex items-center justify-center pointer-events-none" style={{ left: '14px', top: '50%', transform: 'translateY(-50%)' }}>
                <svg xmlns="http://w3.org" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#71717a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
                </svg>
              </div>

              <input
                type="text"
                /* МЕНЯЕМ ПЛЕЙСХОЛДЕР ПОИСКА */
                placeholder={isMounted ? t.searchPlaceholder : "Search tracks or releases..."}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ paddingLeft: '44px' }}
                className="bg-[#121212] hover:bg-[#1a1a1a] text-white rounded-full pr-4 py-2 text-[14px] font-bold tracking-tight outline-none border border-zinc-800 focus:border-zinc-600 transition-all placeholder:text-zinc-600 w-48 md:w-64"
              />
            </div>

            {isAdmin && <UploadModal />}

            {/* НАША КАСТОМНАЯ КНОПКА-ТРИГГЕР НА ВЕРХНЮЮ ШТОРКУ */}
            <motion.button
              onClick={() => setIsTopPanelOpen(!isTopPanelOpen)}
              whileHover="hover"
              whileTap={{ scale: 0.9 }}
              className="w-10 h-10 flex flex-col items-end justify-center gap-1.5 p-2 text-zinc-500 hover:text-white transition-colors relative z-40 group"
              title={isMounted ? t.openMenu : "Open Menu"}
            >
              {/* Верхняя линия брутализм-меню */}
              <motion.span
                variants={{
                  hover: { width: "24px" }
                }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                className="h-[2px] bg-zinc-500 group-hover:bg-white w-5 block rounded-full transition-colors duration-300"
              />
              {/* Нижняя линия брутализм-меню */}
              <motion.span
                variants={{
                  hover: { width: "16px" }
                }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                className="h-[2px] bg-zinc-500 group-hover:bg-white w-6 block rounded-full transition-colors duration-300"
              />
            </motion.button>
          </div>
        </div>

        {/* Мягкая Ч/Б брутальная панель фильтров с плавной анимацией закрытия */}
        <AnimatePresence mode="wait">
          {isMounted && isFilterPanelOpen && !isSearching && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2, ease: "easeInOut" }}
              className="mb-8 p-5 bg-zinc-900/30 border border-zinc-800/80 rounded-xl font-mono text-xs flex flex-wrap gap-8 items-center justify-between"
            >
              {/* Секция 1: Формат релиза */}
              <div className="flex flex-col gap-2.5">
                <span className="text-zinc-500 font-bold tracking-widest text-[10px] uppercase">
                  {t.filterFormatLabel || "ФОРМАТ"}
                </span>
                <div className="flex gap-2">
                  {[
                    { key: 'all', label: t.filterAll || 'ВСЕ РЕЛИЗЫ' },
                    { key: 'album', label: t.album || 'АЛЬБОМ' },
                    { key: 'ep', label: t.ep || 'EP' },
                    { key: 'single', label: t.single || 'СИНГЛ' }
                  ].map(type => {
                    const isActive = activeType === type.key;
                    return (
                      <motion.button
                        key={type.key}
                        whileHover={{ scale: 1.02, borderColor: isActive ? "#52525b" : "#3f3f46" }}
                        whileTap={{ scale: 0.98 }}
                        transition={{ duration: 0.12 }}
                        onClick={() => setActiveType(type.key)}
                        className={`h-9 px-4 border rounded-lg font-medium uppercase tracking-wider text-[11px] ${isActive
                          ? 'border-zinc-600 text-white bg-zinc-800'
                          : 'border-zinc-800/60 text-zinc-500 bg-transparent'
                          }`}
                      >
                        {type.label}
                      </motion.button>
                    );
                  })}
                </div>
              </div>

              {/* Секция 2: Кастомный мягкий селектор сортировки */}
              <div className="flex flex-col gap-2.5 min-w-[220px]">
                <span className="text-zinc-500 font-bold tracking-widest text-[10px] uppercase">
                  {t.filterSortLabel || "СОРТИРОВКА"}
                </span>
                <div className="relative">
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="w-full h-9 bg-zinc-900/60 text-zinc-300 border border-zinc-800 rounded-lg px-3 pr-8 outline-none font-medium uppercase tracking-wider text-[11px] appearance-none focus:border-zinc-700 cursor-pointer transition-all"
                  >
                    <option value="newest" className="bg-zinc-950">{t.sortNewest || 'СНАЧАЛА СВЕЖИЕ'}</option>
                    <option value="oldest" className="bg-zinc-950">{t.sortOldest || 'СНАЧАЛА СТАРЫЕ'}</option>
                    <option value="tracks_max" className="bg-zinc-950">{t.sortTracksMax || 'ПО УБЫВАНИЮ ТРЕКОВ'}</option>
                    <option value="tracks_min" className="bg-zinc-950">{t.sortTracksMin || 'ПО ВОЗРАСТАНИЮ ТРЕКОВ'}</option>
                    <option value="duration_max" className="bg-zinc-950">{t.sortDurationMax || 'СНАЧАЛА ДЛИННЫЕ'}</option>
                    <option value="duration_min" className="bg-zinc-950">{t.sortDurationMin || 'СНАЧАЛА КОРОТКИЕ'}</option>
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-zinc-500">
                    <svg className="fill-current h-4 w-4" viewBox="0 0 20 20">
                      <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
                    </svg>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {isSearching ? (
          <SmartSearch
            externalQuery={searchQuery}
            onReleaseClick={handleOpenRelease}
          />
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
            {filteredReleases.map((release, index) => (
              <TrackItem
                key={`home-grid-release-item-idx-${index}-${release.id || 'no-id'}`}
                release={release}
                index={index}
                onClick={() => handleOpenRelease(release)}
              />
            ))}
          </div>
        )}
      </div>

      <ReleaseModal
        key={selectedRelease?.id ? `active-release-modal-${selectedRelease.id}` : 'initial-empty-release-modal'}
        release={selectedRelease}
        tracks={tracks}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        isAdmin={isAdmin}
      />
    </main>
  );
}

export default function Home() {
  // Достаем язык и словарь напрямую из Zustand для фоллбэка загрузки
  const language = usePlayer(state => state.language);
  const t = locales[language as 'ru' | 'en' || 'en'];

  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center font-mono select-none isolate">
          {/* Минималистичный текстовый лоадер в верхнем регистре */}
          <div className="text-[11px] text-zinc-500 uppercase tracking-[0.4em] animate-pulse">
            {t.loadingPlatform}
          </div>
          {/* Строгая геометрическая линия загрузки под брутализм */}
          <div className="w-24 h-[1px] bg-zinc-800 mt-4 relative overflow-hidden rounded-full">
            <div className="absolute top-0 bottom-0 left-0 bg-white/40 w-1/2 rounded-full animate-[loading-bar_1s_infinite_linear]" />
          </div>
        </div>
      }
    >
      <HomeContent />
    </Suspense>
  )
}
