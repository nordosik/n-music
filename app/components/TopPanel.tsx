'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { User2, Send, Tv, MessageSquare, Mail, Copy, Check, X } from 'lucide-react'
import { usePlayer } from '../lib/usePlayer'
import { locales } from '../lib/locales'

// ИЗОЛИРОВАННАЯ КНОПКА: Смена стейта происходит внутри неё, большая модалка НЕ перерендеривается
const CopyButton = ({ text, label, variant = 'row', children }: { text: string; label: string; variant?: 'row' | 'block'; children: React.ReactNode }) => {
  const [isCopied, setIsCopied] = useState(false)

  const handleAction = (e: React.MouseEvent) => {
    e.stopPropagation()
    navigator.clipboard.writeText(text)
    setIsCopied(true)
    setTimeout(() => setIsCopied(false), 2000)
  }

  if (variant === 'block') {
    return (
      <motion.button
        whileTap={{ scale: 0.99 }}
        onClick={handleAction}
        className={`flex items-center justify-center gap-3 border rounded-xl py-3.5 px-6 text-xs uppercase tracking-widest font-black transition-all duration-300 ease-out w-full ${isCopied
          ? 'bg-emerald-500 border-emerald-400 text-black shadow-[0_0_25px_rgba(52,211,153,0.4)]'
          : 'border-white/5 bg-[#111113] text-zinc-400 hover:bg-[#1a1a1f] hover:text-zinc-200 hover:border-white/10'
          }`}
      >
        {isCopied ? (
          <>
            <Check size={15} strokeWidth={3} className="text-black" />
            <span>СКОПИРОВАНО</span>
          </>
        ) : children}
      </motion.button>
    )
  }

  return (
    <motion.button
      whileTap={{ scale: 0.98 }}
      onClick={handleAction}
      className={`w-full flex items-center justify-between border p-4 rounded-xl font-mono text-left transition-all duration-300 ease-out group/collab ${isCopied
        ? 'bg-emerald-500 border-emerald-400 text-black shadow-[0_0_25px_rgba(52,211,153,0.3)]'
        : 'border-white/5 bg-[#111113] hover:bg-[#1a1a1f] hover:border-white/10'
        }`}
    >
      <div className="flex items-center gap-3">
        {children}
        <div className="flex flex-col">
          <span className={`text-[9px] uppercase tracking-wider transition-colors duration-300 ${isCopied ? 'text-black/60' : 'text-zinc-500'}`}>{label}</span>
          <span className={`text-sm font-bold mt-0.5 transition-colors duration-300 ${isCopied ? 'text-black' : 'text-zinc-400 group-hover/collab:text-zinc-200'}`}>{text}</span>
        </div>
      </div>
      {isCopied ? (
        <Check size={16} strokeWidth={3} className="text-black" />
      ) : (
        <Copy size={14} className="text-zinc-600 group-hover/collab:text-zinc-400 transition-colors" />
      )}
    </motion.button>
  )
}

export default function TopPanel() {
  const isOpen = usePlayer(state => state.isTopPanelOpen)
  const setIsOpen = usePlayer(state => state.setIsTopPanelOpen)
  const language = usePlayer(state => state.language)
  const t = locales[language as 'ru' | 'en' || 'en']

  // Контроль открытых окон
  const [activeModal, setActiveModal] = useState<'about' | 'socials' | 'support' | 'collab' | null>(null)

  // Достаем состояние караоке, чтобы шторка умела вовремя уступать ему место
  const isLyricsOpen = usePlayer(state => state.isLyricsOpen)

  // ИНТЕЛЛЕКТУАЛЬНЫЙ КОНТРОЛЬ СЛОЕВ: Блокировка скролла + уступка места караоке
  useEffect(() => {
    // Если шторка открыта, но челик включил караоке — плавно уводим шторку вверх
    if (isOpen && isLyricsOpen) {
      setIsOpen(false)
      return
    }

    // Управление блокировкой прокрутки фона
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }

    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isOpen, isLyricsOpen, setIsOpen])

  // Общий стабильный компонент модалки
  const InfoModal = ({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) => (
    <div className="fixed inset-0 flex items-center justify-center z-[60] p-4 isolate">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/70 backdrop-blur-md"
      />
      <motion.div
        initial={{ scale: 0.97, opacity: 0, y: 10 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.97, opacity: 0, y: 10 }}
        transition={{ type: "spring", stiffness: 450, damping: 28 }}
        className="bg-[#09090b] border border-white/10 rounded-xl p-8 md:p-10 max-w-xl w-full relative shadow-[0_30px_70px_rgba(0,0,0,0.9)] font-mono text-center z-10"
      >
        <button onClick={onClose} className="absolute top-5 right-5 text-zinc-500 hover:text-white transition-colors">
          <X size={22} strokeWidth={1.5} />
        </button>
        <span className="text-[10px] text-zinc-500 uppercase tracking-[0.4em] mb-4 block">{t.overlaySub}</span>
        <h3 className="text-xl md:text-2xl font-black uppercase text-white tracking-tighter mb-6">{title}</h3>
        <div className="w-full">{children}</div>
      </motion.div>
    </div>
  )

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-[2px] z-40 pointer-events-auto"
            />

            {/* ВЕРХНЯЯ ШТОРКА: ТОНКАЯ, СТЕКЛЯННАЯ, СУЖЕННАЯ СВЕРХУ И СНИЗУ */}
            <motion.div
              initial={{ y: '-100%' }}
              animate={{ y: 0 }}
              exit={{ y: '-100%' }}
              transition={{ type: 'spring', stiffness: 340, damping: 30 }}
              className="fixed top-0 left-0 right-0 bg-[#070708]/75 backdrop-blur-xl border-b border-white/[0.03] z-50 py-6 px-10 font-mono select-none"
            >
              {/* Жесткая сетка на 5 колонок с выравниванием по центру */}
              <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-5 gap-6 items-center justify-items-center">

                {/* СЕКЦИЯ 1: О ПЛАТФОРМЕ */}
                <motion.div
                  whileHover={{ scale: 1.02, borderColor: 'rgba(255,255,255,0.2)', backgroundColor: 'rgba(255,255,255,0.03)' }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setActiveModal('about')}
                  className="border border-white/5 bg-white/[0.02] backdrop-blur-sm p-6 rounded-xl flex flex-col justify-center items-center text-center h-40 w-full cursor-pointer transition-all duration-300 group"
                >
                  <span className="text-lg md:text-xl font-black uppercase tracking-widest text-zinc-400 group-hover:text-white transition-colors duration-200">
                    {t.btnAbout}
                  </span>
                  <span className="text-xs text-zinc-500 group-hover:text-zinc-300 mt-2 uppercase tracking-tight transition-colors duration-200">
                    {language === 'ru' ? 'МАНИФЕСТ И СТЕК' : 'MANIFESTO & STACK'}
                  </span>
                </motion.div>

                {/* СЕКЦИЯ 2: СОЦСЕТИ */}
                <motion.div
                  whileHover={{ scale: 1.02, borderColor: 'rgba(255,255,255,0.2)', backgroundColor: 'rgba(255,255,255,0.03)' }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setActiveModal('socials')}
                  className="border border-white/5 bg-white/[0.02] backdrop-blur-sm p-6 rounded-xl flex flex-col justify-center items-center text-center h-40 w-full cursor-pointer transition-all duration-300 group"
                >
                  <span className="text-lg md:text-xl font-black uppercase tracking-widest text-zinc-400 group-hover:text-white transition-colors duration-200">
                    {t.btnSocials}
                  </span>
                  <span className="text-xs text-zinc-500 group-hover:text-zinc-300 mt-2 uppercase tracking-tight transition-colors duration-200">
                    {language === 'ru' ? 'НАШИ РЕСУРСЫ' : 'OUR CHANNELS'}
                  </span>
                </motion.div>

                {/* ЦЕНТР: МОЙ ПРОФИЛЬ (ЖЕСТКАЯ ЦЕНТРОВКА, НИЧЕГО НЕ ЕДЕТ) */}
                <div className="flex flex-col items-center justify-center p-2 w-full min-w-0">
                  <div className="w-20 h-20 rounded-full bg-zinc-900 border border-white/10 flex items-center justify-center text-zinc-500 shadow-xl cursor-pointer shrink-0 hover:scale-110 hover:text-white hover:border-white/20 transition-all duration-200 ease-out">
                    <User2 size={36} strokeWidth={1.5} />
                  </div>

                  <span className="text-sm md:text-base font-black uppercase tracking-[0.2em] text-white mt-4 block text-center">
                    {t.profileTitle}
                  </span>

                  <span className="text-[10px] text-zinc-600 uppercase tracking-widest font-bold mt-1.5 block text-center truncate max-w-full">
                    {t.profileStatusGuest}
                  </span>

                  {/* Контейнер кнопок авторизации равного размера, выровненный строго по центру */}
                  <div className="flex items-center justify-center gap-2.5 mt-5 w-full max-w-[260px]">
                    <motion.button
                      whileTap={{ scale: 0.97 }}
                      whileHover={{ scale: 1.03, borderColor: "rgba(255,255,255,0.4)", backgroundColor: "rgba(255,255,255,0.05)", color: "#ffffff" }}
                      className="text-[11px] font-black uppercase tracking-wider text-white border border-white/25 py-2.5 rounded-lg bg-transparent flex-1 text-center transition-colors duration-150 ease-out hover:bg-zinc-800 hover:border-zinc-700 cursor-pointer"
                    >
                      {t.authRegisterBtn}
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.03, borderColor: "rgba(255,255,255,0.4)", backgroundColor: "rgba(255,255,255,0.05)", color: "#ffffff" }}
                      whileTap={{ scale: 0.97 }}
                      className="text-[11px] font-black uppercase tracking-wider text-zinc-400 border border-white/10 py-2.5 rounded-lg transition-all bg-zinc-900/40 flex-1 text-center"
                    >
                      {t.authLoginBtn}
                    </motion.button>
                  </div>
                </div>

                {/* СЕКЦИЯ 3: ПОДДЕРЖКА */}
                <motion.div
                  whileHover={{ scale: 1.02, borderColor: 'rgba(255,255,255,0.2)', backgroundColor: 'rgba(255,255,255,0.03)' }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setActiveModal('support')}
                  className="border border-white/5 bg-white/[0.02] backdrop-blur-sm p-6 rounded-xl flex flex-col justify-center items-center text-center h-40 w-full cursor-pointer transition-all duration-300 group"
                >
                  <span className="text-lg md:text-xl font-black uppercase tracking-widest text-zinc-500 group-hover:text-white transition-colors duration-200">
                    {t.btnSupport}
                  </span>
                  <span className="text-xs text-zinc-600 group-hover:text-zinc-400 mt-2 uppercase tracking-tight transition-colors duration-200">
                    {language === 'ru' ? 'ДОНАТ АРТИСТУ' : 'SUPPORT CREATOR'}
                  </span>
                </motion.div>

                {/* СЕКЦИЯ 4: СОТРУДНИЧЕСТВО */}
                <motion.div
                  whileHover={{ scale: 1.02, borderColor: 'rgba(255,255,255,0.2)', backgroundColor: 'rgba(255,255,255,0.03)' }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setActiveModal('collab')}
                  className="border border-white/5 bg-white/[0.02] backdrop-blur-sm p-6 rounded-xl flex flex-col justify-center items-center text-center h-40 w-full cursor-pointer transition-all duration-300 group"
                >
                  <span className="text-lg md:text-xl font-black uppercase tracking-widest text-zinc-500 group-hover:text-white transition-colors duration-200">
                    {t.btnCollab}
                  </span>
                  <span className="text-xs text-zinc-600 group-hover:text-zinc-400 mt-2 uppercase tracking-tight transition-colors duration-200">
                    {language === 'ru' ? 'ДЕМО И СВЯЗЬ' : 'COLLABS & CONTACT'}
                  </span>
                </motion.div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {activeModal === 'about' && (
          <InfoModal title={t.modalAboutTitle} onClose={() => setActiveModal(null)}>
            <p className="text-sm text-zinc-400 uppercase tracking-tight leading-relaxed text-center">
              {t.modalAboutBody}
            </p>
          </InfoModal>
        )}

        {/* МЯГКИЕ ТЕМНО-СЕРЫЕ ПЛАШКИ СОЦСЕТЕЙ (ЖЕЛЕЗНО БЕЗ СДВИГОВ И ДЕРГАНИЙ ТЕКСТА) */}
        {activeModal === 'socials' && (
          <InfoModal title={t.modalSocialsTitle} onClose={() => setActiveModal(null)}>
            <p className="text-xs text-zinc-500 uppercase tracking-wider text-center mb-8">{t.modalSocialsBody}</p>
            <div className="flex flex-col gap-4 max-w-sm mx-auto w-full">
              <motion.a
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                href="https://t.me/nn_musics" target="_blank" rel="noopener noreferrer"
                className="flex items-center justify-center gap-3 border border-white/5 rounded-xl py-3.5 px-6 text-xs uppercase tracking-widest font-black text-zinc-400 bg-[#111113] hover:bg-[#1a1a1f] hover:text-zinc-200 hover:border-white/10 transition-all duration-200"
              >
                <Send size={15} fill="currentColor" className="stroke-none text-zinc-500" /> {t.labelTgChannel}
              </motion.a>

              <motion.a
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                href="https://www.youtube.com/@nordos07" target="_blank" rel="noopener noreferrer"
                className="flex items-center justify-center gap-3 border border-white/5 rounded-xl py-3.5 px-6 text-xs uppercase tracking-widest font-black text-zinc-400 bg-[#111113] hover:bg-[#1a1a1f] hover:text-zinc-200 hover:border-white/10 transition-all duration-200"
              >
                <Tv size={15} fill="currentColor" className="stroke-none text-zinc-500" /> {t.labelYtChannel}
              </motion.a>

              <CopyButton text="nordosfanchik" label={t.labelDiscord} variant="block">
                <MessageSquare size={15} fill="currentColor" className="stroke-none text-zinc-500" /> {t.labelDiscord}
              </CopyButton>
            </div>
          </InfoModal>
        )}

        {/* МОДАЛКА 3: ПОДДЕРЖКА — МГНОВЕННЫЙ ОТКЛИК И НЕОНОВЫЙ ИНТЕРАКТИВ */}
        {activeModal === 'support' && (
          <InfoModal title={t.modalSupportTitle} onClose={() => setActiveModal(null)}>
            <p className="text-sm text-zinc-400 uppercase tracking-tight leading-relaxed text-center mb-8">
              {t.modalSupportBody}
            </p>

            {/* СВЕРХСКОРОСТНАЯ КНОПКА С ЭФФЕКТОМ БЛИКА И МГНОВЕННОЙ ФИЗИКОЙ */}
            <motion.a
              whileHover={{ scale: 1.03, boxShadow: "0 0 25px rgba(255,122,0,0.5)" }}
              whileTap={{ scale: 0.92 }}
              transition={{ type: "spring", stiffness: 800, damping: 30 }}
              href="https://www.donationalerts.com/r/nordoosik"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center bg-[#ff7a00] text-white px-8 py-4 rounded-xl font-black uppercase tracking-widest text-xs shadow-[0_0_15px_rgba(255,122,0,0.15)] gap-2 mx-auto relative overflow-hidden group/donat cursor-pointer"
            >
              {/* Внутренний брутальный блик, бегущий по кнопке */}
              <div className="absolute top-0 -inset-full h-full w-1/2 z-5 block transform -skew-x-12 bg-gradient-to-r from-transparent to-white/20 opacity-40 group-hover/donat:animate-[shine_0.8s_ease-in-out]" />

              {/* Строгая геометрическая иконка молнии (или огня) для стиля */}
              <svg xmlns="http://w3.org" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-white group-hover/donat:scale-110 transition-transform duration-200">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
              </svg>

              <span>DonationAlerts</span>
            </motion.a>
          </InfoModal>
        )}

        {/* МОДАЛКА 4: СОТРУДНИЧЕСТВО */}
        {activeModal === 'collab' && (
          <InfoModal title={t.modalCollabTitle} onClose={() => setActiveModal(null)}>
            <div className="flex flex-col items-center gap-4 max-w-md mx-auto w-full">
              <p className="text-xs text-zinc-500 uppercase tracking-wider text-center mb-2">
                {t.modalCollabBody}
              </p>

              <CopyButton text="@nordosik" label={t.labelTgContact}>
                <Send size={16} className="text-zinc-500" />
              </CopyButton>

              <CopyButton text="gusinv24@gmail.com" label={t.labelEmail}>
                <Mail size={16} className="text-zinc-500" />
              </CopyButton>
            </div>
          </InfoModal>
        )}

      </AnimatePresence>
    </>
  )
}
