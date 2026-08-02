'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { usePlayer } from '../lib/usePlayer'
import { supabase } from '../lib/supabase'
import { locales } from '../lib/locales'

export default function ArtistModal() {
  // Вытаскиваю стейты из нашего глобального Zustand-стора
  const { isArtistModalOpen, activeArtistName, closeArtistModal, language } = usePlayer()

  // Подтягиваю нужный словарь локализации (RU/EN)
  const t = locales[language as 'ru' | 'en'] || locales.ru

  const [links, setLinks] = useState<{ vk?: string; tg?: string; spotify?: string } | null>(null)
  const [loading, setLoading] = useState(false)

  // 1. БЛОКИРОВКА СКРОЛЛА ГЛАВНОЙ СТРАНИЦЫ
  useEffect(() => {
    if (isArtistModalOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => { document.body.style.overflow = 'unset' }
  }, [isArtistModalOpen])

  // 2. УМНЫЙ ЗАПРОС К БАЗЕ ДАННЫХ
  useEffect(() => {
    if (!isArtistModalOpen || !activeArtistName) return

    const fetchArtistLinks = async () => {
      setLoading(true)
      setLinks(null)

      const cleanName = activeArtistName.trim();
      console.log("УЛЬТИМАТИВНЫЙ ПОИСК ПО БАЗЕ ДАННЫХ ДЛЯ ->", `"${cleanName}"`);

      // Пуленепробиваемый поиск через .ilike без чувствительности к регистру и мелким опечаткам
      const { data, error } = await supabase
        .from('artists')
        .select('vk_url, tg_url, spotify_url')
        .ilike('name', `%${cleanName}%`) // Проценты спасают от скрытых символов и разности раскладок
        .maybeSingle()

      if (error) {
        console.error("ОШИБКА БАЗЫ ДАННЫХ SUPABASE:", error)
      }

      console.log("РЕАЛЬНЫЙ ОТВЕТ ОТ ТАБЛИЦЫ ARTISTS:", data);

      if (data) {
        setLinks({
          vk: data.vk_url || undefined,
          tg: data.tg_url || undefined,
          spotify: data.spotify_url || undefined
        })
      } else {
        setLinks({ vk: undefined, tg: undefined, spotify: undefined })
      }
      setLoading(false)
    }

    fetchArtistLinks()
  }, [isArtistModalOpen, activeArtistName])

  return (
    <AnimatePresence>
      {isArtistModalOpen && activeArtistName && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
          {/* Задний фон с глубоким заблюриванием сайта */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeArtistModal}
            className="absolute inset-0 bg-black/80 backdrop-blur-xl cursor-pointer"
          />

          {/* КАРТОЧКА МОДАЛКИ: Добавил упругий, сочный влет (Spring) */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 30 }}
            transition={{
              type: "spring",
              stiffness: 260,
              damping: 25,
              mass: 0.8
            }}
            className="relative w-full max-w-md bg-zinc-950 border border-white/10 p-8 rounded-2xl shadow-2xl flex flex-col justify-between overflow-hidden z-10 font-mono"
          >
            {/* Кнопка закрытия крестиком: При наведении плавно поворачивается на 90 градусов и увеличивается, при клике сжимается */}
            <motion.button
              onClick={closeArtistModal}
              whileHover={{ scale: 1.2, rotate: 90, color: "#ef4444" }}
              whileTap={{ scale: 0.85 }}
              transition={{ duration: 0.25, ease: "easeInOut" }}
              className="absolute top-6 right-6 text-zinc-500 transition-colors text-2xl font-mono select-none"
            >
              ×
            </motion.button>

            {/* Жирный брутальный заголовок с ником */}
            <h2 className="text-xl font-black tracking-tighter text-white mb-6 text-center select-none">
              {activeArtistName}
            </h2>

            {/* Контентная зона с увеличенными шрифтами */}
            <div className="flex flex-col gap-4 min-h-[140px] justify-center w-full">
              {loading ? (
                <div className="text-center text-[11px] font-black tracking-[0.2em] text-zinc-500 animate-pulse uppercase">
                  {t.artistModalLoading || "ЗАГРУЗКА СВЯЗЕЙ..."}
                </div>
              ) : (!links?.vk && !links?.tg && !links?.spotify) ? (
                <div className="text-center text-[11px] font-black tracking-[0.2em] text-zinc-600 uppercase select-none">
                  {t.artistModalNoLinks || "СОЦСЕТИ НЕ ДОБАВЛЕНЫ"}
                </div>
              ) : (
                <div className="flex flex-col gap-3 w-full">

                  {/* TELEGRAM — ГОЛУБОЙ НЕОН ИЛИ ПЕРЕЧЕРКНУТЫЙ БРУТАЛИЗМ */}
                  <motion.a
                    href={links?.tg || undefined}
                    target="_blank"
                    rel="noreferrer"
                    animate={links?.tg
                      ? { backgroundColor: "rgba(24, 24, 27, 0.2)", borderColor: "rgba(63, 63, 70, 0.4)", color: "#a1a1aa", boxShadow: "0 0 0px rgba(0,0,0,0)" }
                      : { backgroundColor: "rgba(9, 9, 11, 0.4)", borderColor: "rgba(39, 39, 42, 0.2)", color: "#3f3f46" }
                    }
                    whileHover={links?.tg ? {
                      scale: 1.02,
                      backgroundColor: '#0088cc',
                      borderColor: '#0088cc',
                      color: '#ffffff',
                      boxShadow: '0 0 20px rgba(0, 136, 204, 0.5)'
                    } : {}}
                    whileTap={links?.tg ? { scale: 0.95 } : {}}
                    transition={{ type: "spring", stiffness: 400, damping: 15, duration: 0.2 }}
                    className={`h-12 flex items-center justify-between px-5 border rounded-xl text-xs font-black tracking-widest uppercase relative overflow-hidden ${links?.tg ? 'cursor-pointer' : 'cursor-not-allowed pointer-events-none'
                      }`}
                  >
                    <span className={!links?.tg ? 'line-through decoration-zinc-700 decoration-2' : ''}>TELEGRAM</span>
                    <span className="text-xs opacity-50">{links?.tg ? '→' : '×'}</span>

                    {/* Моя брутальная жирная линия перечеркивания по диагонали всей кнопки */}
                    {!links?.tg && (
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="w-[110%] h-[2px] bg-zinc-800/60 rotate-[4deg]" />
                      </div>
                    )}
                  </motion.a>

                  {/* SPOTIFY — ЗЕЛЕНЫЙ НЕОН ИЛИ ПЕРЕЧЕРКНУТЫЙ БРУТАЛИЗМ */}
                  <motion.a
                    href={links?.spotify || undefined}
                    target="_blank"
                    rel="noreferrer"
                    animate={links?.spotify
                      ? { backgroundColor: "rgba(24, 24, 27, 0.2)", borderColor: "rgba(63, 63, 70, 0.4)", color: "#a1a1aa", boxShadow: "0 0 0px rgba(0,0,0,0)" }
                      : { backgroundColor: "rgba(9, 9, 11, 0.4)", borderColor: "rgba(39, 39, 42, 0.2)", color: "#3f3f46" }
                    }
                    whileHover={links?.spotify ? {
                      scale: 1.02,
                      backgroundColor: '#1db954',
                      borderColor: '#1db954',
                      color: '#ffffff',
                      boxShadow: '0 0 20px rgba(29, 185, 84, 0.5)'
                    } : {}}
                    whileTap={links?.spotify ? { scale: 0.95 } : {}}
                    transition={{ type: "spring", stiffness: 400, damping: 15, duration: 0.2 }}
                    className={`h-12 flex items-center justify-between px-5 border rounded-xl text-xs font-black tracking-widest uppercase relative overflow-hidden ${links?.spotify ? 'cursor-pointer' : 'cursor-not-allowed pointer-events-none'
                      }`}
                  >
                    <span className={!links?.spotify ? 'line-through decoration-zinc-700 decoration-2' : ''}>SPOTIFY</span>
                    <span className="text-xs opacity-50">{links?.spotify ? '→' : '×'}</span>

                    {!links?.spotify && (
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="w-[110%] h-[2px] bg-zinc-800/60 rotate-[4deg]" />
                      </div>
                    )}
                  </motion.a>

                  {/* VK — СИНИЙ НЕОН ИЛИ ПЕРЕЧЕРКНУТЫЙ БРУТАЛИЗМ */}
                  <motion.a
                    href={links?.vk || undefined}
                    target="_blank"
                    rel="noreferrer"
                    animate={links?.vk
                      ? { backgroundColor: "rgba(24, 24, 27, 0.2)", borderColor: "rgba(63, 63, 70, 0.4)", color: "#a1a1aa", boxShadow: "0 0 0px rgba(0,0,0,0)" }
                      : { backgroundColor: "rgba(9, 9, 11, 0.4)", borderColor: "rgba(39, 39, 42, 0.2)", color: "#3f3f46" }
                    }
                    whileHover={links?.vk ? {
                      scale: 1.02,
                      backgroundColor: '#0077ff',
                      borderColor: '#0077ff',
                      color: '#ffffff',
                      boxShadow: '0 0 20px rgba(0, 119, 255, 0.5)'
                    } : {}}
                    whileTap={links?.vk ? { scale: 0.95 } : {}}
                    transition={{ type: "spring", stiffness: 400, damping: 15, duration: 0.2 }}
                    className={`h-12 flex items-center justify-between px-5 border rounded-xl text-xs font-black tracking-widest uppercase relative overflow-hidden ${links?.vk ? 'cursor-pointer' : 'cursor-not-allowed pointer-events-none'
                      }`}
                  >
                    <span className={!links?.vk ? 'line-through decoration-zinc-700 decoration-2' : ''}>VKONTAKTE</span>
                    <span className="text-xs opacity-50">{links?.vk ? '→' : '×'}</span>

                    {!links?.vk && (
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="w-[110%] h-[2px] bg-zinc-800/60 rotate-[4deg]" />
                      </div>
                    )}
                  </motion.a>

                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}