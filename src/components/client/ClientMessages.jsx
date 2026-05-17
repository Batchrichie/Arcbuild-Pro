import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { useClient } from '../../context/ClientContext'

export default function ClientMessages() {
  const { profile } = useAuth()
  const { clientId } = useClient()
  const [projects, setProjects] = useState([])
  const [projectId, setProjectId] = useState('')
  const [messages, setMessages] = useState([])
  const [body, setBody] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const bottomRef = useRef(null)

  const loadProjects = useCallback(async () => {
    if (!clientId) return
    const { data } = await supabase.from('projects').select('id, name').eq('client_id', clientId).order('name')
    const list = data ?? []
    setProjects(list)
    if (list.length === 1) setProjectId(list[0].id)
    else if (list.length && !projectId) setProjectId(list[0].id)
  }, [clientId, projectId])

  const loadMessages = useCallback(async () => {
    if (!projectId) return
    setLoading(true)
    const { data } = await supabase
      .from('messages')
      .select('id, message_body, sender_id, created_at, is_read')
      .eq('project_id', projectId)
      .order('created_at', { ascending: true })
    setMessages(data ?? [])
    setLoading(false)
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
  }, [projectId])

  useEffect(() => {
    loadProjects()
  }, [loadProjects])

  useEffect(() => {
    if (projectId) loadMessages()
  }, [projectId, loadMessages])

  const send = async (e) => {
    e.preventDefault()
    if (!body.trim() || !projectId || !profile?.id) return
    setSending(true)
    const { error } = await supabase.from('messages').insert({
      project_id: projectId,
      sender_id: profile.id,
      message_body: body.trim(),
    })
    setSending(false)
    if (error) {
      alert(error.message)
      return
    }
    setBody('')
    loadMessages()
  }

  const isMine = (msg) => msg.sender_id === profile?.id

  return (
    <div className="flex h-[min(70vh,560px)] flex-col">
      {projects.length > 1 && (
        <select
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
          className="mb-4 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 sm:max-w-sm"
        >
          {projects.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      )}

      <div className="flex-1 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-4">
        {loading ? (
          <div className="h-full animate-pulse rounded-lg bg-slate-200" />
        ) : messages.length === 0 ? (
          <p className="text-center text-sm text-slate-500">No messages yet. Start the conversation below.</p>
        ) : (
          <ul className="space-y-3">
            {messages.map((msg) => {
              const mine = isMine(msg)
              const unread = !mine && !msg.is_read
              return (
                <li key={msg.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
                      mine
                        ? 'bg-teal-700 text-white'
                        : `bg-white text-slate-800 shadow-sm ring-1 ring-slate-200 ${unread ? 'font-semibold' : ''}`
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{msg.message_body}</p>
                    <p className={`mt-1 text-xs ${mine ? 'text-teal-100' : 'text-slate-400'}`}>
                      {new Date(msg.created_at).toLocaleString('en-GH')}
                      {unread ? ' · New' : ''}
                    </p>
                  </div>
                </li>
              )
            })}
            <li ref={bottomRef} />
          </ul>
        )}
      </div>

      <form onSubmit={send} className="mt-4 flex gap-2">
        <input
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Type your message…"
          className="min-touch flex-1 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900"
        />
        <button
          type="submit"
          disabled={sending || !body.trim()}
          className="min-touch shrink-0 rounded-xl bg-teal-700 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
        >
          Send
        </button>
      </form>
    </div>
  )
}
