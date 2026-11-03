'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { X, Inbox, Trash2, Pencil, Check, Send, Lock } from 'lucide-react'
import { toast } from 'sonner'
import type { DraftCard, DraftCounts, RealtimeEvent } from '@/lib/types/database'

const MAX_TEXT = 500

type Column = DraftCard['column_type']

const COLUMNS: { type: Column; label: string; dot: string; count: (n: number) => string }[] = [
  { type: 'good', label: 'O que foi bom', dot: 'bg-column-good', count: n => `${n} ${n === 1 ? 'bom' : 'bons'}` },
  { type: 'bad', label: 'O que pode melhorar', dot: 'bg-column-bad', count: n => `${n} a melhorar` },
  { type: 'ideas', label: 'Ideias', dot: 'bg-column-ideas', count: n => `${n} ${n === 1 ? 'ideia' : 'ideias'}` },
  { type: 'actions', label: 'Ações', dot: 'bg-column-actions', count: n => `${n} ${n === 1 ? 'ação' : 'ações'}` },
]

const columnOf = (type: Column) => COLUMNS.find(c => c.type === type)!

type DraftsPanelProps = {
  sessionToken: string
  participantId: string
  participantName: string
  counts: DraftCounts
  releaseVersion: number
  broadcast: (event: RealtimeEvent) => void
  onClose: () => void
}

export function DraftsPanel({
  sessionToken,
  participantId,
  participantName,
  counts,
  releaseVersion,
  broadcast,
  onClose,
}: DraftsPanelProps) {
  const [column, setColumn] = useState<Column>('good')
  const [text, setText] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isReleasing, setIsReleasing] = useState(false)
  const [myDrafts, setMyDrafts] = useState<DraftCard[] | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')

  const total = counts.good + counts.bad + counts.ideas + counts.actions

  // Só as minhas anotações vêm com texto. Recarrega quando alguém joga a
  // caixinha no board, que esvazia a lista.
  const loadMine = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/drafts?session_token=${encodeURIComponent(sessionToken)}&author_id=${encodeURIComponent(participantId)}`,
      )
      if (res.ok) {
        const data = await res.json()
        setMyDrafts(data.drafts)
        broadcast({ type: 'drafts_count', payload: data.counts })
      } else {
        setMyDrafts([])
      }
    } catch {
      setMyDrafts([])
    }
  }, [sessionToken, participantId, broadcast])

  useEffect(() => {
    loadMine()
  }, [loadMine, releaseVersion])

  const handleAdd = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!text.trim() || isSubmitting) return

    setIsSubmitting(true)
    try {
      const res = await fetch('/api/drafts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_token: sessionToken,
          column_type: column,
          text: text.trim(),
          author: participantName,
          author_id: participantId,
        }),
      })
      if (res.ok) {
        const { draft, counts: newCounts } = await res.json()
        setMyDrafts(prev => [...(prev ?? []), draft])
        broadcast({ type: 'drafts_count', payload: newCounts })
        setText('')
      } else {
        const err = await res.json().catch(() => null)
        toast.error(err?.message ?? 'Não foi possível guardar a anotação')
      }
    } catch {
      toast.error('Não foi possível guardar a anotação')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSaveEdit = async (draft: DraftCard) => {
    const trimmed = editText.trim()
    setEditingId(null)
    if (!trimmed || trimmed === draft.text) return

    try {
      const res = await fetch('/api/drafts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: draft.id, text: trimmed, author_id: participantId }),
      })
      if (res.ok) {
        const { draft: updated } = await res.json()
        setMyDrafts(prev => prev?.map(d => (d.id === updated.id ? updated : d)) ?? null)
      } else {
        toast.error('Não foi possível editar a anotação')
      }
    } catch {
      toast.error('Não foi possível editar a anotação')
    }
  }

  const handleDelete = async (draft: DraftCard) => {
    try {
      const res = await fetch(
        `/api/drafts?id=${draft.id}&author_id=${encodeURIComponent(participantId)}`,
        { method: 'DELETE' },
      )
      if (res.ok) {
        const { counts: newCounts } = await res.json()
        setMyDrafts(prev => prev?.filter(d => d.id !== draft.id) ?? null)
        broadcast({ type: 'drafts_count', payload: newCounts })
      } else {
        toast.error('Não foi possível apagar a anotação')
      }
    } catch {
      toast.error('Não foi possível apagar a anotação')
    }
  }

  const handleRelease = async () => {
    if (total === 0 || isReleasing) return
    const confirmed = window.confirm(
      `Jogar as ${total} anotações da caixinha nas colunas do board? Elas viram cards anônimos e saem da caixinha.`,
    )
    if (!confirmed) return

    setIsReleasing(true)
    try {
      const res = await fetch('/api/drafts/release', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_token: sessionToken }),
      })
      const data = await res.json().catch(() => null)
      if (data && Array.isArray(data.cards)) {
        broadcast({
          type: 'drafts_released',
          payload: { cards: data.cards, actionCards: data.actionCards, counts: data.counts },
        })
      }
      if (!res.ok) {
        toast.error('Parte da caixinha não foi para o board — tente de novo')
        return
      }

      const released = data.cards.length + data.actionCards.length
      const left = data.counts.good + data.counts.bad + data.counts.ideas + data.counts.actions
      if (left > 0) {
        toast.warning(`${released} anotações foram para o board; ${left} ficaram na caixinha porque a coluna lotou`)
      } else {
        toast.success(`${released} anotações foram para o board`)
        onClose()
      }
    } catch {
      toast.error('Não foi possível jogar a caixinha no board')
    } finally {
      setIsReleasing(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div
        role="dialog"
        aria-label="Caixinha da sprint"
        className="bg-card rounded-lg shadow-xl max-w-xl w-full max-h-[85vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Inbox className="w-5 h-5 text-muted-foreground" />
            <div>
              <h2 className="font-semibold">Caixinha da sprint</h2>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Lock className="w-3 h-3" />
                Anote ao longo da sprint — só você vê o que escreveu até a retro começar
              </p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Fechar caixinha">
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Form */}
        <form onSubmit={handleAdd} className="p-4 border-b border-border space-y-2">
          <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Coluna">
            {COLUMNS.map(c => (
              <button
                key={c.type}
                type="button"
                role="radio"
                aria-checked={column === c.type}
                onClick={() => setColumn(c.type)}
                className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors ${
                  column === c.type
                    ? 'border-foreground bg-muted font-medium'
                    : 'border-border text-muted-foreground hover:text-foreground'
                }`}
              >
                <span className={`w-2 h-2 rounded-sm ${c.dot}`} />
                {c.label}
              </button>
            ))}
          </div>
          <Textarea
            placeholder="Aconteceu algo que vale levar para a retro? Anota aqui antes que esqueça..."
            aria-label="Anotação"
            value={text}
            onChange={e => setText(e.target.value.slice(0, MAX_TEXT))}
            maxLength={MAX_TEXT}
            rows={3}
            className="resize-none"
            onKeyDown={e => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleAdd()
            }}
          />
          <div className="flex items-center justify-end gap-3">
            <span className="text-xs text-muted-foreground tabular-nums">{text.length}/{MAX_TEXT}</span>
            <Button type="submit" size="sm" disabled={!text.trim() || isSubmitting}>
              Guardar
            </Button>
          </div>
        </form>

        {/* Minhas anotações */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Suas anotações{myDrafts ? ` (${myDrafts.length})` : ''}
          </h3>
          {myDrafts === null ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Carregando...</p>
          ) : myDrafts.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              Você ainda não anotou nada nesta sprint.
            </p>
          ) : (
            myDrafts.map(draft => {
              const col = columnOf(draft.column_type)
              const editing = editingId === draft.id
              return (
                <div key={draft.id} data-draft-id={draft.id} className="rounded-lg border border-border p-3 space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <span className={`w-2 h-2 rounded-sm ${col.dot}`} />
                      {col.label}
                    </span>
                    <div className="flex items-center gap-0.5">
                      {editing ? (
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => handleSaveEdit(draft)} aria-label="Salvar edição">
                          <Check className="w-3 h-3" />
                        </Button>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          onClick={() => {
                            setEditingId(draft.id)
                            setEditText(draft.text)
                          }}
                          aria-label="Editar anotação"
                        >
                          <Pencil className="w-3 h-3" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                        onClick={() => handleDelete(draft)}
                        aria-label="Apagar anotação"
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                  {editing ? (
                    <Textarea
                      value={editText}
                      onChange={e => setEditText(e.target.value.slice(0, MAX_TEXT))}
                      maxLength={MAX_TEXT}
                      rows={2}
                      autoFocus
                      className="resize-none text-sm"
                      onKeyDown={e => {
                        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSaveEdit(draft)
                        if (e.key === 'Escape') setEditingId(null)
                      }}
                    />
                  ) : (
                    <p className="text-sm whitespace-pre-wrap break-words">{draft.text}</p>
                  )}
                </div>
              )
            })
          )}
        </div>

        {/* Footer: o time + jogar no board */}
        <div className="p-4 border-t border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            {total === 0
              ? 'A caixinha do time está vazia'
              : <>Na caixinha do time: {COLUMNS.filter(c => counts[c.type] > 0).map(c => c.count(counts[c.type])).join(' · ')}</>}
          </p>
          <Button size="sm" onClick={handleRelease} disabled={total === 0 || isReleasing} className="shrink-0">
            <Send className="w-4 h-4 mr-1" />
            Jogar no board{total > 0 ? ` (${total})` : ''}
          </Button>
        </div>
      </div>
    </div>
  )
}
