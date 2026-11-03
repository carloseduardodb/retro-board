'use client'

import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { X, Heart, Trash2, Send, PartyPopper } from 'lucide-react'
import { toast } from 'sonner'
import type { Kudo, Participant, RealtimeEvent } from '@/lib/types/database'

const MAX_TO_NAME = 20
const MAX_MESSAGE = 280

type KudosPanelProps = {
  kudos: Kudo[]
  sessionToken: string
  participantId: string
  participantName: string
  participants: Participant[]
  broadcast: (event: RealtimeEvent) => void
  onClose: () => void
}

const sameName = (a: string, b: string) =>
  a.trim().localeCompare(b.trim(), 'pt-BR', { sensitivity: 'base' }) === 0

const formatWhen = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })

export function KudosPanel({
  kudos,
  sessionToken,
  participantId,
  participantName,
  participants,
  broadcast,
  onClose,
}: KudosPanelProps) {
  const [toName, setToName] = useState('')
  const [message, setMessage] = useState('')
  const [anonymous, setAnonymous] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [onlyMine, setOnlyMine] = useState(false)

  // Sugestões de destinatário: quem está online agora + quem já recebeu kudos
  // no ciclo (o time nem sempre está todo conectado ao mesmo tempo).
  const nameSuggestions = useMemo(() => {
    const names = new Map<string, string>()
    for (const n of [...participants.map(p => p.name), ...kudos.map(k => k.to_name)]) {
      const key = n.trim().toLocaleLowerCase('pt-BR')
      if (key && !sameName(n, participantName) && !names.has(key)) names.set(key, n.trim())
    }
    return [...names.values()].sort((a, b) => a.localeCompare(b, 'pt-BR'))
  }, [participants, kudos, participantName])

  const sorted = useMemo(
    () => [...kudos].sort((a, b) => b.created_at.localeCompare(a.created_at)),
    [kudos],
  )
  const forMe = sorted.filter(k => sameName(k.to_name, participantName))
  const visible = onlyMine ? forMe : sorted

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!toName.trim() || !message.trim() || isSubmitting) return

    setIsSubmitting(true)
    try {
      const res = await fetch('/api/kudos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_token: sessionToken,
          to_name: toName.trim(),
          message: message.trim(),
          author: participantName,
          author_id: participantId,
          anonymous,
        }),
      })

      if (res.ok) {
        const { kudo } = await res.json()
        broadcast({ type: 'kudo_added', payload: kudo })
        setToName('')
        setMessage('')
        setAnonymous(false)
        toast.success(`Kudo enviado para ${kudo.to_name} 💛`)
      } else {
        const err = await res.json().catch(() => null)
        toast.error(err?.message ?? 'Não foi possível enviar o kudo')
      }
    } catch (error) {
      console.error('Error creating kudo:', error)
      toast.error('Não foi possível enviar o kudo')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleToggleLike = async (kudo: Kudo) => {
    const liked = kudo.likes.includes(participantId)
    // Otimista: o coração responde na hora; o servidor confirma em seguida.
    broadcast({
      type: 'kudo_updated',
      payload: {
        ...kudo,
        likes: liked ? kudo.likes.filter(p => p !== participantId) : [...kudo.likes, participantId],
      },
    })

    try {
      const res = await fetch('/api/kudos', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: kudo.id, participant_id: participantId, action: liked ? 'unlike' : 'like' }),
      })
      if (res.ok) {
        const { kudo: updated } = await res.json()
        broadcast({ type: 'kudo_updated', payload: updated })
      } else {
        broadcast({ type: 'kudo_updated', payload: kudo })
      }
    } catch {
      broadcast({ type: 'kudo_updated', payload: kudo })
    }
  }

  const handleDelete = async (kudo: Kudo) => {
    try {
      const res = await fetch(
        `/api/kudos?id=${kudo.id}&author_id=${encodeURIComponent(participantId)}`,
        { method: 'DELETE' },
      )
      if (res.ok) {
        broadcast({ type: 'kudo_deleted', payload: { id: kudo.id } })
      } else {
        toast.error('Não foi possível apagar o kudo')
      }
    } catch (error) {
      console.error('Error deleting kudo:', error)
      toast.error('Não foi possível apagar o kudo')
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div
        role="dialog"
        aria-label="Mural de Kudos"
        className="bg-card rounded-lg shadow-xl max-w-xl w-full max-h-[85vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Heart className="w-5 h-5 text-pink-500 fill-pink-500" />
            <div>
              <h2 className="font-semibold">Mural de Kudos</h2>
              <p className="text-xs text-muted-foreground">
                Reconheça quem mandou bem — vale até a próxima retro
              </p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Fechar mural">
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 border-b border-border space-y-2">
          <Input
            placeholder="Para quem?"
            aria-label="Para quem"
            value={toName}
            onChange={e => setToName(e.target.value.slice(0, MAX_TO_NAME))}
            maxLength={MAX_TO_NAME}
            list="kudos-recipients"
          />
          <datalist id="kudos-recipients">
            {nameSuggestions.map(n => <option key={n} value={n} />)}
          </datalist>
          <Textarea
            placeholder="O que essa pessoa fez de incrível?"
            aria-label="Mensagem do kudo"
            value={message}
            onChange={e => setMessage(e.target.value.slice(0, MAX_MESSAGE))}
            maxLength={MAX_MESSAGE}
            rows={3}
            className="resize-none"
            onKeyDown={e => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSubmit(e)
            }}
          />
          <div className="flex items-center justify-between gap-2">
            <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer select-none">
              <Checkbox checked={anonymous} onCheckedChange={v => setAnonymous(v === true)} />
              Enviar anonimamente
            </label>
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground tabular-nums">
                {message.length}/{MAX_MESSAGE}
              </span>
              <Button type="submit" size="sm" disabled={!toName.trim() || !message.trim() || isSubmitting}>
                <Send className="w-4 h-4 mr-1" />
                Enviar kudo
              </Button>
            </div>
          </div>
        </form>

        {/* Filtro */}
        {forMe.length > 0 && (
          <div className="px-4 pt-3 flex gap-2">
            <Button variant={onlyMine ? 'ghost' : 'secondary'} size="sm" onClick={() => setOnlyMine(false)}>
              Todos ({sorted.length})
            </Button>
            <Button variant={onlyMine ? 'secondary' : 'ghost'} size="sm" onClick={() => setOnlyMine(true)}>
              Para mim ({forMe.length})
            </Button>
          </div>
        )}

        {/* Lista */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {visible.length === 0 ? (
            <div className="text-center py-8 space-y-2">
              <PartyPopper className="w-8 h-8 mx-auto text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Nenhum kudo ainda nesta sprint. Seja a primeira pessoa a elogiar alguém!
              </p>
            </div>
          ) : (
            visible.map(kudo => {
              const liked = kudo.likes.includes(participantId)
              const isMine = kudo.author_id === participantId
              const isForMe = sameName(kudo.to_name, participantName)
              return (
                <article
                  key={kudo.id}
                  data-kudo-id={kudo.id}
                  className={`rounded-lg border p-3 space-y-2 ${
                    isForMe ? 'border-pink-300 bg-pink-50 dark:border-pink-900 dark:bg-pink-950/30' : 'border-border'
                  }`}
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="text-sm font-semibold">
                      Para {kudo.to_name}
                      {isForMe && <span className="ml-1 text-xs font-normal text-pink-600 dark:text-pink-400">(você!)</span>}
                    </p>
                    <time className="text-xs text-muted-foreground shrink-0" dateTime={kudo.created_at}>
                      {formatWhen(kudo.created_at)}
                    </time>
                  </div>
                  <p className="text-sm whitespace-pre-wrap break-words">{kudo.message}</p>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-muted-foreground">
                      — {kudo.anonymous ? 'anônimo' : kudo.author || 'alguém do time'}
                      {isMine && ' (você)'}
                    </span>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 gap-1"
                        onClick={() => handleToggleLike(kudo)}
                        aria-pressed={liked}
                        aria-label={liked ? 'Descurtir kudo' : 'Curtir kudo'}
                      >
                        <Heart className={`w-3.5 h-3.5 ${liked ? 'fill-pink-500 text-pink-500' : ''}`} />
                        {kudo.likes.length > 0 && <span className="text-xs tabular-nums">{kudo.likes.length}</span>}
                      </Button>
                      {isMine && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                          onClick={() => handleDelete(kudo)}
                          aria-label="Apagar kudo"
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                </article>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
