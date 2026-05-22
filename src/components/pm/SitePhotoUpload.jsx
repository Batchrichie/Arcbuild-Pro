import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { usePmProject } from '../../context/PmProjectContext'

export default function SitePhotoUpload() {
  const { profile } = useAuth()
  const { selectedProjectId } = usePmProject()
  const [photos, setPhotos] = useState([])
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [preview, setPreview] = useState(null)
  const [pendingFile, setPendingFile] = useState(null)
  const [description, setDescription] = useState('')
  const [photoDate, setPhotoDate] = useState(new Date().toISOString().split('T')[0])
  const [fullscreen, setFullscreen] = useState(null)
  const [error, setError] = useState(null)

  const loadPhotos = useCallback(async () => {
    if (!selectedProjectId) return
    setLoading(true)
    const { data, error: err } = await supabase
      .from('documents')
      .select('*')
      .eq('project_id', selectedProjectId)
      .eq('document_type', 'site_photo')
      .order('document_date', { ascending: false })

    if (err) {
      console.warn(err)
      setPhotos([])
    } else {
      setPhotos(data ?? [])
    }
    setLoading(false)
  }, [selectedProjectId])

  useEffect(() => {
    loadPhotos()
  }, [loadPhotos])

  const onFilePick = (e) => {
    const file = e.target.files?.[0]
    if (!file || !file.type.startsWith('image/')) {
      setError('Please select an image file.')
      return
    }
    setError(null)
    setPendingFile(file)
    setPreview(URL.createObjectURL(file))
  }

  const confirmUpload = async () => {
    if (!pendingFile || !selectedProjectId || !profile?.id) return
    setUploading(true)
    setError(null)
    try {
      const safeName = pendingFile.name.replace(/[^a-zA-Z0-9._-]/g, '_')
      const path = `${selectedProjectId}/${photoDate}/${Date.now()}_${safeName}`

      const { error: uploadErr } = await supabase.storage.from('site-photos').upload(path, pendingFile, {
        cacheControl: '3600',
        upsert: false,
      })
      if (uploadErr) throw uploadErr

      const { data: urlData } = supabase.storage.from('site-photos').getPublicUrl(path)

      const { error: insertErr } = await supabase.from('documents').insert({
        related_type: 'project',
        related_id: selectedProjectId,
        project_id: selectedProjectId,
        document_type: 'site_photo',
        file_name: pendingFile.name,
        file_url: urlData.publicUrl,
        description: description || null,
        document_date: photoDate,
        uploaded_by: profile.id,
      })
      if (insertErr) throw insertErr

      setPendingFile(null)
      setPreview(null)
      setDescription('')
      await loadPhotos()
    } catch (err) {
      setError(err.message || 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  if (!selectedProjectId) {
    return <p className="text-sm text-slate-500">Select a project to manage site photos.</p>
  }

  return (
    <div className="space-y-4 pb-24 lg:pb-4">
      <p className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1 text-sm text-emerald-200">
        Visible to client ✓
      </p>

      <div className="rounded-2xl border border-border-soft bg-white/5 p-4">
        <label className="min-touch inline-flex cursor-pointer items-center justify-center rounded-full border border-cyan-400/30 bg-cyan-500/15 px-4 py-2.5 text-sm font-semibold text-cyan-100">
          Upload site photo
          <input type="file" accept="image/*" className="hidden" onChange={onFilePick} />
        </label>

        {preview && (
          <div className="mt-4 space-y-3">
            <img src={preview} alt="Preview" className="max-h-48 rounded-xl object-cover" />
            <input
              type="text"
              placeholder="Description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-xl border border-border-soft bg-slate-900 px-3 py-2 text-sm text-white"
            />
            <input
              type="date"
              value={photoDate}
              onChange={(e) => setPhotoDate(e.target.value)}
              className="w-full rounded-xl border border-border-soft bg-slate-900 px-3 py-2 text-sm text-white"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={confirmUpload}
                disabled={uploading}
                className="min-touch flex-1 rounded-full bg-cyan-500 py-2.5 text-sm font-semibold text-slate-950 disabled:opacity-50"
              >
                {uploading ? 'Uploading…' : 'Confirm upload'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setPreview(null)
                  setPendingFile(null)
                }}
                className="min-touch rounded-full border border-border-soft px-4 py-2.5 text-sm text-slate-300"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
        {error && <p className="mt-2 text-sm text-red-300">{error}</p>}
      </div>

      {loading ? (
        <div className="h-32 animate-pulse rounded-2xl bg-white/5" />
      ) : photos.length === 0 ? (
        <p className="text-sm text-slate-500">No site photos yet.</p>
      ) : (
        <div className="columns-2 gap-3 sm:columns-3">
          {photos.map((photo) => (
            <button
              key={photo.id}
              type="button"
              onClick={() => setFullscreen(photo)}
              className="mb-3 block w-full break-inside-avoid overflow-hidden rounded-xl border border-border-soft text-left"
            >
              <img src={photo.file_url} alt={photo.description || photo.file_name} className="w-full object-cover" />
              <div className="bg-black/60 px-2 py-2 text-xs text-slate-200">
                <p>{photo.document_date || photo.created_at?.split('T')[0]}</p>
                {photo.description && <p className="mt-0.5 line-clamp-2 opacity-90">{photo.description}</p>}
              </div>
            </button>
          ))}
        </div>
      )}

      {fullscreen && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-[80] bg-black/90"
            aria-label="Close"
            onClick={() => setFullscreen(null)}
          />
          <div className="fixed inset-4 z-[81] flex items-center justify-center">
            <img
              src={fullscreen.file_url}
              alt={fullscreen.description || fullscreen.file_name}
              className="max-h-full max-w-full object-contain"
            />
          </div>
        </>
      )}
    </div>
  )
}
