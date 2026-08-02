import { create } from 'zustand'
import { supabase } from './supabase' // Импорт инициализированного клиента

export type RepeatMode = 'off' | 'one' | 'all';

interface Track {
  id: string | number;
  title: string;
  audio_url: string;
  cover_url?: string;
  release_type?: 'single' | 'ep' | 'album';
  release_id?: string;
  duration: number;
  lyrics?: string;
  is_ecosystem?: boolean;
  is_hot?: boolean;
  plays_count?: number;
}

interface PlayerStore {
  activeTrack: Track | null
  isPlaying: boolean
  queue: Track[]
  originalQueue: Track[]
  currentIndex: number
  isLyricsOpen: boolean
  repeatMode: RepeatMode
  isShuffle: boolean
  volume: number
  prevVolume: number
  lyricsScrollPositions: Record<string | number, number>
  currentTime: number
  language: 'ru' | 'en'
  listenTimeoutId: NodeJS.Timeout | null

  setIsLyricsOpen: (open: boolean) => void
  setActiveTrack: (track: Track) => void
  setQueue: (tracks: Track[], index?: number) => void
  setIsPlaying: (playing: boolean) => void
  setVolume: (value: number) => void
  setPrevVolume: (value: number) => void
  toggleMute: () => void
  setLyricsScrollPosition: (trackId: string | number, position: number) => void
  playNext: (isAutoEnded?: boolean) => void
  playPrevious: () => void
  setCurrentTime: (time: number) => void
  togglePlay: () => void
  toggleRepeat: () => void
  toggleShuffle: () => void
  toggleLanguage: () => void
  // === Управление глобальной модалкой артистов ===
  isArtistModalOpen: boolean
  activeArtistName: string | null
  openArtistModal: (name: string) => void
  closeArtistModal: () => void
  isTopPanelOpen: boolean
  setIsTopPanelOpen: (open: boolean) => void
  setLanguage: (lang: 'ru' | 'en') => void
  stopListenTimer: () => void
}

const shuffleArray = (array: Track[], excludeTrackId: string | number): Track[] => {
  const filtered = array.filter(t => t.id !== excludeTrackId);
  for (let i = filtered.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [filtered[i], filtered[j]] = [filtered[j], filtered[i]];
  }
  return filtered;
};

// Функция запуска таймера прослушивания на чистом клиенте
const startListenTimer = (set: any, get: any, track: Track) => {
  const currentTimeout = get().listenTimeoutId;
  if (currentTimeout) clearTimeout(currentTimeout);

  // Игнорируем мои стримы, пока я разрабатываю на localhost
  if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    console.log(`[Analytics] Локальный запуск. Стрим трека "${track.title}" проигнорирован.`);
    return;
  }

  // Считаем стрим, если играет дольше 30 сек (или меньше, если трек короткий)
  const threshold = Math.min(30, track.duration || 30) * 1000;

  const timeoutId = setTimeout(async () => {
    try {
      // Передаем ID как есть (в виде строки/UUID)
      const trackId = track.id;

      console.log(`[Analytics] Отправка стрима для UUID: ${trackId}...`);

      const { error } = await supabase.rpc('increment_track_plays', {
        target_track_id: trackId
      });

      if (error) {
        console.error('[Analytics Error] Supabase вернул ошибку:', error.message);
        return;
      }

      console.log(`[Analytics] Стрим успешно засчитан в базе для: ${track.title}`);
    } catch (error: any) {
      console.error('[Analytics Error] Критическая ошибка:', error?.message || error);
    }
  }, threshold);

  set({ listenTimeoutId: timeoutId });
};

export const usePlayer = create<PlayerStore>((set, get) => ({
  activeTrack: null,
  isPlaying: false,
  queue: [],
  originalQueue: [],
  currentIndex: 0,
  isLyricsOpen: false,
  repeatMode: 'off',
  isShuffle: false,
  volume: 1,
  prevVolume: 1,
  lyricsScrollPositions: {},
  currentTime: 0,
  language: 'ru',
  listenTimeoutId: null,

  setIsLyricsOpen: (open) => set({ isLyricsOpen: open }),
  setCurrentTime: (time) => set({ currentTime: time }),

  setActiveTrack: (track: Track) => {
    set({
      activeTrack: track,
      isPlaying: true,
      queue: [track],
      originalQueue: [track],
      currentIndex: 0
    });
    startListenTimer(set, get, track);
  },

  setVolume: (value) => set({ volume: value }),
  setPrevVolume: (value) => set({ prevVolume: value }),
  toggleMute: () => {
    const { volume, prevVolume, setVolume } = get();
    if (volume > 0) {
      set({ prevVolume: volume });
      setVolume(0);
    } else {
      setVolume(prevVolume > 0 ? prevVolume : 1);
    }
  },

  setLyricsScrollPosition: (trackId, position) => set((state) => ({
    lyricsScrollPositions: {
      ...state.lyricsScrollPositions,
      [trackId]: position
    }
  })),

  setQueue: (tracks: Track[], index = 0) => {
    const { isShuffle } = get();
    const selectedTrack = tracks[index];

    if (isShuffle && tracks.length > 1) {
      const shuffledRemaining = shuffleArray(tracks, selectedTrack.id);
      set({
        originalQueue: tracks,
        queue: [selectedTrack, ...shuffledRemaining],
        currentIndex: 0,
        activeTrack: selectedTrack,
        isPlaying: true
      });
    } else {
      set({
        originalQueue: tracks,
        queue: tracks,
        currentIndex: index,
        activeTrack: tracks[index],
        isPlaying: true
      });
    }
    startListenTimer(set, get, selectedTrack);
  },

  playNext: (isAutoEnded = false) => {
    const { queue, originalQueue, activeTrack, currentIndex, repeatMode, isShuffle, stopListenTimer } = get();

    stopListenTimer();

    if (isAutoEnded && repeatMode === 'one') {
      return;
    }
    if (!isAutoEnded && repeatMode === 'one' && queue.length === 1) {
      const current = activeTrack;
      set({ activeTrack: null, isPlaying: false });
      setTimeout(() => {
        set({ activeTrack: current, isPlaying: true });
        if (current) startListenTimer(set, get, current);
      }, 30);
      return;
    }
    const isLastTrack = currentIndex === queue.length - 1;
    if (!isLastTrack) {
      const nextIndex = currentIndex + 1;
      const nextTrack = queue[nextIndex];
      set({
        currentIndex: nextIndex,
        activeTrack: nextTrack,
        isPlaying: true
      });
      startListenTimer(set, get, nextTrack);
    } else {
      if (repeatMode === 'all') {
        if (queue.length === 1) {
          const current = activeTrack;
          set({ activeTrack: null, isPlaying: false });
          setTimeout(() => {
            set({ activeTrack: current, isPlaying: true });
            if (current) startListenTimer(set, get, current);
          }, 30);
        } else if (isShuffle) {
          const currentTrack = queue[currentIndex];
          if (!currentTrack) {
            set({ isPlaying: false });
            return;
          }
          const freshlyShuffled = shuffleArray(originalQueue, currentTrack.id);
          const newQueue = [currentTrack, ...freshlyShuffled];
          set({
            queue: newQueue,
            currentIndex: 1,
            activeTrack: newQueue[1],
            isPlaying: true
          });
          startListenTimer(set, get, newQueue[1]);
        } else {
          set({
            currentIndex: 0,
            activeTrack: queue[0],
            isPlaying: true
          });
          if (queue[0]) startListenTimer(set, get, queue[0]);
        }
      } else {
        set({ isPlaying: false });
      }
    }
  },

  playPrevious: () => {
    const { queue, currentIndex, stopListenTimer } = get();

    stopListenTimer();

    if (currentIndex > 0) {
      const nextIndex = currentIndex - 1;
      const prevTrack = queue[nextIndex];
      set({
        currentIndex: nextIndex,
        activeTrack: prevTrack,
        isPlaying: true
      });
      startListenTimer(set, get, prevTrack);
    } else {
      const current = queue[0];
      set({ activeTrack: null, isPlaying: false });
      setTimeout(() => {
        set({ activeTrack: current, isPlaying: true });
        if (current) startListenTimer(set, get, current);
      }, 30);
    }
  },

  stopListenTimer: () => {
    const { listenTimeoutId } = get();
    if (listenTimeoutId) {
      clearTimeout(listenTimeoutId);
      set({ listenTimeoutId: null });
    }
  },

  setIsPlaying: (playing) => {
    if (!playing) {
      get().stopListenTimer();
    } else {
      const { activeTrack } = get();
      if (activeTrack) startListenTimer(set, get, activeTrack);
    }
    set({ isPlaying: playing });
  },

  togglePlay: () => set((state) => {
    const nextPlaying = !state.isPlaying;
    if (!nextPlaying) {
      get().stopListenTimer();
    } else {
      if (state.activeTrack) startListenTimer(set, get, state.activeTrack);
    }
    return { isPlaying: nextPlaying };
  }),

  toggleRepeat: () => set((state) => {
    const nextModes: Record<RepeatMode, RepeatMode> = { off: 'one', one: 'all', all: 'off' };
    const nextMode = nextModes[state.repeatMode];
    if (nextMode === 'one' && state.isShuffle) {
      const currentTrack = state.activeTrack;
      const originalIdx = state.originalQueue.findIndex(t => t.id === currentTrack?.id);
      return {
        repeatMode: nextMode,
        isShuffle: false,
        queue: state.originalQueue.length ? state.originalQueue : state.queue,
        currentIndex: originalIdx !== -1 ? originalIdx : 0
      };
    }
    return { repeatMode: nextMode };
  }),

  toggleShuffle: () => set((state) => {
    if (state.repeatMode === 'one') {
      return {};
    }
    const nextShuffle = !state.isShuffle;
    if (nextShuffle) {
      if (!state.activeTrack || state.queue.length <= 1) {
        return { isShuffle: nextShuffle };
      }
      const currentTrack = state.activeTrack;
      const baseTracks = state.originalQueue.length ? state.originalQueue : state.queue;
      const shuffledRemaining = shuffleArray(baseTracks, currentTrack.id);
      return {
        isShuffle: nextShuffle,
        originalQueue: baseTracks,
        queue: [currentTrack, ...shuffledRemaining],
        currentIndex: 0
      };
    } else {
      if (!state.activeTrack || !state.originalQueue.length) {
        return { isShuffle: nextShuffle };
      }
      const currentTrack = state.activeTrack;
      const originalIdx = state.originalQueue.findIndex(t => t.id === currentTrack.id);
      return {
        isShuffle: nextShuffle,
        queue: state.originalQueue,
        currentIndex: originalIdx !== -1 ? originalIdx : 0
      };
    }
  }),

  toggleLanguage: () => set((state) => {
    const nextLang = state.language === 'en' ? 'ru' : 'en';
    if (typeof window !== 'undefined') {
      localStorage.setItem('n-musics-lang', nextLang);
    }
    return { language: nextLang };
  }),

  setLanguage: (lang) => set({ language: lang }),

  // НОВАЯ ЛОГИКА ВЕРХНЕЙ ПАНЕЛИ
  isTopPanelOpen: false,
  setIsTopPanelOpen: (open) => set({ isTopPanelOpen: open }),

  // === Реализация глобального стора для модалки ===
  isArtistModalOpen: false,
  activeArtistName: null,
  openArtistModal: (name: string) => set({ isArtistModalOpen: true, activeArtistName: name }),
  closeArtistModal: () => set({ isArtistModalOpen: false, activeArtistName: null }),
}))

