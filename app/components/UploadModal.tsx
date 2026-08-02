'use client'
import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { X, Plus, Image as ImageIcon, Check } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { usePlayer } from '../lib/usePlayer'
import { locales } from '../lib/locales'

interface UploadTrack {
  id: string
  title: string
  file: File | null
  duration: number | null
  collaborators: string
}

export default function UploadModal() {
  const [isOpen, setIsOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [releaseCollaborators, setReleaseCollaborators] = useState('')
  const [lyrics, setLyrics] = useState('')
  const [coverFile, setCoverFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)

  const language = usePlayer(state => state.language)
  const $t = locales[language as 'ru' | 'en'] || locales.en
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  const [tracks, setTracks] = useState<UploadTrack[]>([
    { id: '1', title: '', file: null, duration: null, collaborators: '' }
  ])

  const getDuration = (file: File): Promise<number> => {
    return new Promise((resolve) => {
      const audio = new Audio()
      audio.src = URL.createObjectURL(file)
      audio.onloadedmetadata = () => {
        URL.revokeObjectURL(audio.src)
        resolve(Math.round(audio.duration))
      }
    })
  }

  const releaseType = useMemo(() => {
    const validTracks = tracks.filter(t => t.file !== null)
    const trackCount = validTracks.length
    const totalDurationSec = validTracks.reduce((sum, t) => sum + (t.duration || 0), 0)
    const totalDurationMin = totalDurationSec / 60
    const hasLongTrack = validTracks.some(t => (t.duration || 0) > 600)

    if (trackCount >= 7) return 'album'
    if (trackCount > 0 && totalDurationMin > 30) return 'album'
    if (trackCount >= 4 && trackCount <= 6 && totalDurationMin <= 30) return 'ep'
    if (trackCount >= 1 && trackCount <= 3 && hasLongTrack && totalDurationMin <= 30) return 'ep'
    return 'single'
  }, [tracks])

  const ensureArtistsExist = async (artistNamesStr: string) => {
    if (!artistNamesStr) return
    const names = artistNamesStr.split(',').map(n => n.trim()).filter(n => n.length > 0)
    for (const name of names) {
      if (name.toUpperCase() === 'NORDOSIK') continue
      const { data } = await supabase.from('artists').select('id').ilike('name', name).maybeSingle()
      if (!data) {
        await supabase.from('artists').insert([{ name }])
      }
    }
  }

  const handleUpload = async () => {
    // 1. Проверяем, что заполнено название релиза
    if (!title.trim()) {
      return alert($t.errSpecifyTitle)
    }

    // 2. Проверяем, что у всех добавленных треков есть файлы и названия
    const invalidTrack = tracks.find(t => !t.title.trim() || !t.file)
    if (invalidTrack) {
      return alert($t.errFillAllTracks)
    }

    const filledTracks = tracks
    setLoading(true)

    try {
      // 3. Загрузка обложки
      let coverUrl = null
      if (coverFile) {
        const coverPath = `covers/${Date.now()}_${coverFile.name.replace(/[^a-z0-9.]/gi, '_')}`
        await supabase.storage.from('media').upload(coverPath, coverFile)
        coverUrl = supabase.storage.from('media').getPublicUrl(coverPath).data.publicUrl
      }

      // 4. Проверка и добавление артистов
      await ensureArtistsExist(releaseCollaborators)
      for (const tr of filledTracks) {
        await ensureArtistsExist(tr.collaborators)
      }

      // 5. Загрузка аудиофайлов во временный массив
      let uploadedTracksInfo = []
      for (const [index, t] of filledTracks.entries()) {
        if (!t.file) continue
        const duration = t.duration || await getDuration(t.file)
        const tPath = `tracks/${Date.now()}_${t.file.name.replace(/[^a-z0-9.]/gi, '_')}`
        await supabase.storage.from('media').upload(tPath, t.file)
        const { data: { publicUrl: tUrl } } = supabase.storage.from('media').getPublicUrl(tPath)

        uploadedTracksInfo.push({
          title: t.title,
          audio_url: tUrl,
          position: index + 1,
          duration: duration,
          collaborators: t.collaborators || null
        })
      }

      const totalDurationSec = uploadedTracksInfo.reduce((sum, t) => sum + t.duration, 0)
      const finalAudioUrl = uploadedTracksInfo.length === 1 ? uploadedTracksInfo[0].audio_url : null

      // 6. Создаём запись в таблице releases (получаем ее ID!)
      const { data: newRelease, error: relError } = await supabase
        .from('releases')
        .insert([{
          title,
          collaborators: releaseCollaborators || null,
          audio_url: finalAudioUrl,
          duration: totalDurationSec,
          cover_url: coverUrl,
          lyrics: lyrics,
          release_type: releaseType
        }])
        .select('id')
        .single()

      if (relError || !newRelease) throw relError || new Error('Не удалось создать релиз')

      const newReleaseId = newRelease.id

      // 7. Поочередно связываем треки с релизом
      for (let index = 0; index < uploadedTracksInfo.length; index++) {
        const trackItem = uploadedTracksInfo[index];

        // А) Проверяем, есть ли уже трек с таким названием в базе tracks
        const { data: existingTrack } = await supabase
          .from('tracks')
          .select('id')
          .ilike('title', trackItem.title.trim())
          .maybeSingle();

        let targetTrackId = existingTrack?.id;

        // Б) Если трека еще нет в базе — создаем новый
        if (!targetTrackId) {
          const { data: insertedTrack, error: trackErr } = await supabase
            .from('tracks')
            .insert([{
              title: trackItem.title.trim(),
              audio_url: trackItem.audio_url,
              duration: trackItem.duration,
              collaborators: trackItem.collaborators,
              position: trackItem.position
            }])
            .select('id')
            .single();

          if (trackErr || !insertedTrack) throw trackErr || new Error(`Ошибка сохранения трека "${trackItem.title}"`);
          targetTrackId = insertedTrack.id;
        }

        // В) Привязываем найденный (или созданный) track_id к новому релизу
        const { error: relTrackErr } = await supabase
          .from('release_tracks')
          .insert([{
            release_id: newReleaseId,
            track_id: targetTrackId,
            track_number: index + 1
          }]);

        if (relTrackErr) throw relTrackErr;
      }

      setIsOpen(false)
      window.location.reload()
    } catch (e: any) {
      alert(`${$t.uploadErrorAlert || 'Error:'} ${e.message}`)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => { document.body.style.overflow = 'unset' }
  }, [isOpen])

  const removeTrack = (id: string) => {
    if (tracks.length <= 1) return
    setTracks(tracks.filter(track => track.id !== id))
  }

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 bg-white hover:bg-zinc-200 text-black px-5 py-2.5 rounded-full font-black text-[11px] uppercase tracking-widest transition-all active:scale-95"
      >
        <Plus size={14} strokeWidth={3} />
        {isMounted ? $t.addRelease : (language === 'en' ? "ADD RELEASE" : "ДОБАВИТЬ РЕЛИЗ")}
      </button>

      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-3">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="absolute inset-0 bg-black/90 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="relative w-full max-w-[420px] max-h-[92vh] bg-[#0c0c0c] border border-white/10 p-5 rounded-2xl shadow-2xl flex flex-col justify-between overflow-hidden z-10"
            >
              {/* Крестик */}
              <motion.button
                onClick={() => setIsOpen(false)}
                whileHover={{ scale: 1.2, rotate: 90, color: "#ef4444" }}
                whileTap={{ scale: 0.85 }}
                className="absolute top-5 right-5 text-zinc-500 transition-colors text-xl font-mono select-none"
              >
                <X />
              </motion.button>

              <h2 className="text-xl font-black tracking-tighter uppercase text-white mb-3">
                {$t.newReleaseTitle || "NEW RELEASE"}
              </h2>

              <div className="space-y-3.5 overflow-y-auto pr-1 custom-scrollbar max-h-[calc(92vh-110px)]">
                {/* Формат релиза */}
                <div className="flex bg-black p-2.5 rounded-xl border border-white/5 items-center justify-between">
                  <span className="text-[11px] font-black uppercase tracking-wider text-zinc-400">
                    {$t.detectedType || "DETECTED TYPE:"}
                  </span>
                  <span className="px-3 py-1 bg-white text-black rounded-md text-[11px] font-black uppercase tracking-widest animate-pulse">
                    {releaseType === 'album' && ($t.album || "ALBUM")}
                    {releaseType === 'ep' && ($t.ep || "EP")}
                    {releaseType === 'single' && ($t.single || "SINGLE")}
                  </span>
                </div>

                {/* Название релиза */}
                <div className="space-y-1">
                  <label className="text-[11px] font-black uppercase tracking-wider text-zinc-400 ml-1">
                    {$t.releaseTitleLabel}
                  </label>
                  <input
                    type="text"
                    placeholder={$t.enterTitlePlaceholder}
                    className="w-full bg-black border border-white/5 p-2.5 rounded-xl focus:border-white/20 outline-none transition text-xs font-bold tracking-tight text-white placeholder:text-zinc-600"
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                  />
                </div>

                {/* Артисты релиза */}
                <div className="space-y-1">
                  <label className="text-[11px] font-black uppercase tracking-wider text-zinc-400 ml-1">
                    {$t.releaseArtistsLabel}
                  </label>
                  <input
                    type="text"
                    placeholder={$t.collaboratorsPlaceholder}
                    className="w-full bg-black border border-white/5 p-2.5 rounded-xl focus:border-white/20 outline-none transition text-xs font-medium tracking-tight text-white placeholder:text-zinc-600"
                    value={releaseCollaborators}
                    onChange={e => setReleaseCollaborators(e.target.value)}
                  />
                </div>

                {/* Треклист */}
                <div className="space-y-1">
                  <label className="text-[11px] font-black uppercase tracking-wider text-zinc-400 ml-1">
                    {$t.tracksLabel}
                  </label>
                  <div className="max-h-[160px] overflow-y-auto pr-1 custom-scrollbar flex flex-col gap-y-2">
                    {tracks.map((track, index) => (
                      <div key={track.id} className="flex gap-2 items-center bg-black/40 p-2 rounded-xl border border-white/5 group">
                        <span className="text-[11px] font-mono font-bold text-zinc-600 w-4 text-center">
                          {index + 1}
                        </span>
                        <div className="flex-1 flex flex-col gap-0.5">
                          <input
                            placeholder={$t.trackTitlePlaceholder}
                            className="bg-transparent w-full outline-none text-xs font-bold tracking-tight text-white placeholder:text-zinc-600"
                            value={track.title}
                            onChange={(e) => {
                              const newTracks = [...tracks]
                              newTracks[index].title = e.target.value
                              setTracks(newTracks)
                            }}
                          />
                          <input
                            placeholder={$t.collaboratorsPlaceholder}
                            className="bg-transparent w-full outline-none text-[10px] font-medium tracking-tight text-zinc-500 focus:text-zinc-300 transition-colors placeholder:text-zinc-700"
                            value={track.collaborators || ''}
                            onChange={(e) => {
                              const newTracks = [...tracks]
                              newTracks[index].collaborators = e.target.value
                              setTracks(newTracks)
                            }}
                          />
                        </div>

                        <label className="cursor-pointer p-1.5 hover:bg-white/5 rounded-lg transition flex-shrink-0">
                          <input
                            type="file"
                            accept="audio/*"
                            className="hidden"
                            onChange={async (e) => {
                              const file = e.target.files?.[0] || null
                              const newTracks = [...tracks]
                              newTracks[index].file = file
                              if (file) {
                                newTracks[index].duration = await getDuration(file)
                              } else {
                                newTracks[index].duration = null
                              }
                              setTracks(newTracks)
                            }}
                          />
                          {track.file ? <Check size={14} className="text-white" /> : <Plus size={14} className="text-zinc-500" />}
                        </label>

                        {tracks.length > 1 && (
                          <button
                            onClick={() => removeTrack(track.id)}
                            className="p-1.5 text-zinc-600 hover:text-red-500 transition-colors rounded-lg hover:bg-red-500/10 flex-shrink-0"
                          >
                            <X size={14} />
                          </button>
                        )}
                      </div>
                    ))}

                    <button
                      onClick={() => setTracks([...tracks, { id: `track-upload-id-${Date.now()}`, title: '', file: null, duration: null, collaborators: '' }])}
                      className="w-full py-2 border border-dashed border-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest text-zinc-500 hover:text-zinc-300 transition-colors"
                    >
                      {$t.addTrackBtn}
                    </button>
                  </div>
                </div>

                {/* Обложка */}
                <div className="space-y-1">
                  <label className="text-[11px] font-black uppercase tracking-wider text-zinc-400 ml-1">
                    {$t.coverImageLabel}
                  </label>
                  <label className={`flex items-center justify-between p-2.5 bg-black border rounded-xl cursor-pointer transition-all ${coverFile ? 'border-white/20' : 'border-white/5 hover:border-white/10'}`}>
                    <input type="file" accept="image/*" className="hidden" onChange={e => setCoverFile(e.target.files?.[0] || null)} />
                    <span className="text-xs font-bold text-zinc-400">
                      {coverFile ? coverFile.name : $t.selectFilePlaceholder}
                    </span>
                    {coverFile ? <Check size={14} className="text-white" /> : <ImageIcon size={14} className="text-zinc-600" />}
                  </label>
                </div>

                {/* Кнопка публикации */}
                <button
                  onClick={handleUpload}
                  disabled={loading}
                  className="w-full bg-white text-black py-3.5 rounded-xl font-black uppercase tracking-widest text-xs hover:bg-zinc-200 transition-all active:scale-[0.98] mt-2 shadow-xl disabled:opacity-50 flex-shrink-0"
                >
                  {loading ? $t.processing : $t.publishRelease}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  )
}