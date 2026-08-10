'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Plus,
  ThumbsUp,
  Trash2,
  X,
  Send,
  Pencil,
  ArrowRight,
  Check,
  GripVertical,
  Layers,
  Ungroup,
  EyeOff,
} from 'lucide-react'
import type { Card as CardType, RealtimeEvent } from '@/lib/types/database'
import { cn } from '@/lib/utils'
import { useDroppable, useDraggable } from '@dnd-kit/core'
import { CardReactions } from '@/components/board/card-reactions'

type ColumnType = 'good' | 'bad' | 'ideas'

type BoardColumnProps = {
  type: ColumnType
  title: string
  cards: CardType[]
  sessionToken: string
  participantId: string
  participantName: string
  /** Enquanto true, os cards dos outros participantes ficam ocultos (anti-viés). */
  cardsHidden: boolean
  readOnly?: boolean
  broadcast: (event: RealtimeEvent) => void
  trackOperation: <T>(op: () => Promise<T>) => Promise<T>
}

const columnStyles: Record<ColumnType, { bg: string; border: string; header: string }> = {
  good: {
    bg: 'bg-column-good/30',
    border: 'border-column-good/50',
    header: 'bg-column-good text-column-good-foreground',
  },
  bad: {
    bg: 'bg-column-bad/30',
    border: 'border-column-bad/50',
    header: 'bg-column-bad text-column-bad-foreground',
  },
  ideas: {
    bg: 'bg-column-ideas/30',
    border: 'border-column-ideas/50',
    header: 'bg-column-ideas text-column-ideas-foreground',
  },
}

const columnLabels: Record<ColumnType, string> = {
  good: 'O que foi bom',
  bad: 'O que pode melhorar',
  ideas: 'Ideias',
}

/** Um item da lista da coluna: um card solto ou um grupo de cards relacionados. */
type ColumnEntry =
  | { kind: 'card'; key: string; card: CardType; votes: number; createdAt: number }
  | {
      kind: 'group'
      key: string
      groupId: string
      label: string | null
      cards: CardType[]
      votes: number
      createdAt: number
    }

function buildEntries(cards: CardType[]): ColumnEntry[] {
  const groups = new Map<string, CardType[]>()
  const entries: ColumnEntry[] = []

  for (const card of cards) {
    if (card.group_id) {
      const existing = groups.get(card.group_id)
      if (existing) {
        existing.push(card)
      } else {
        groups.set(card.group_id, [card])
      }
    } else {
      entries.push({
        kind: 'card',
        key: card.id,
        card,
        votes: card.votes,
        createdAt: new Date(card.created_at).getTime(),
      })
    }
  }

  for (const [groupId, groupCards] of groups) {
    // Um grupo com um único card é exibido como card solto.
    if (groupCards.length === 1) {
      const card = groupCards[0]
      entries.push({
        kind: 'card',
        key: card.id,
        card,
        votes: card.votes,
        createdAt: new Date(card.created_at).getTime(),
      })
      continue
    }

    const sorted = [...groupCards].sort((a, b) => {
      if (b.votes !== a.votes) return b.votes - a.votes
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })

    entries.push({
      kind: 'group',
      key: groupId,
      groupId,
      label: sorted.find((c) => c.group_label)?.group_label ?? null,
      cards: sorted,
      votes: sorted.reduce((sum, c) => sum + c.votes, 0),
      createdAt: Math.max(...sorted.map((c) => new Date(c.created_at).getTime())),
    })
  }

  return entries.sort((a, b) => {
    if (b.votes !== a.votes) return b.votes - a.votes
    return b.createdAt - a.createdAt
  })
}

export function BoardColumn({
  type,
  title,
  cards,
  sessionToken,
  participantId,
  participantName,
  cardsHidden,
  readOnly = false,
  broadcast,
  trackOperation,
}: BoardColumnProps) {
  const [isAdding, setIsAdding] = useState(false)
  const [newText, setNewText] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const styles = columnStyles[type]
  const isColumnFull = cards.length >= 100

  const handleAddCard = async () => {
    if (!newText.trim() || isSubmitting) return

    const text = newText.trim()
    setIsSubmitting(true)
    setNewText('')
    setIsAdding(false)

    const tempId = `temp-${Date.now()}`
    const optimisticCard: CardType = {
      id: tempId,
      session_token: sessionToken,
      column_type: type,
      text,
      author: participantName || 'Anônimo',
      author_id: participantId,
      votes: 0,
      voters: [],
      group_id: null,
      group_label: null,
      reactions: {},
      created_at: new Date().toISOString(),
    }
    broadcast({ type: 'card_added', payload: optimisticCard })

    try {
      await trackOperation(async () => {
        const res = await fetch('/api/cards', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            session_token: sessionToken,
            column_type: type,
            text,
            author: participantName || 'Anônimo',
            author_id: participantId,
          }),
        })

        if (res.ok) {
          const { card } = await res.json()
          broadcast({ type: 'card_deleted', payload: { id: tempId } })
          broadcast({ type: 'card_added', payload: card })
        } else {
          broadcast({ type: 'card_deleted', payload: { id: tempId } })
        }
      })
    } catch (error) {
      console.error('Error adding card:', error)
      broadcast({ type: 'card_deleted', payload: { id: tempId } })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleVote = async (card: CardType) => {
    const hasVoted = card.voters.includes(participantId)

    const optimisticCard: CardType = {
      ...card,
      votes: hasVoted ? Math.max(0, card.votes - 1) : card.votes + 1,
      voters: hasVoted
        ? card.voters.filter(v => v !== participantId)
        : [...card.voters, participantId],
    }
    broadcast({ type: 'card_updated', payload: optimisticCard })

    try {
      await trackOperation(async () => {
        const res = await fetch('/api/cards/vote', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            card_id: card.id,
            participant_id: participantId,
            action: hasVoted ? 'unvote' : 'vote',
          }),
        })

        if (res.ok) {
          const { card: serverCard } = await res.json()
          broadcast({ type: 'card_updated', payload: serverCard })
        } else {
          broadcast({ type: 'card_updated', payload: card })
        }
      })
    } catch (error) {
      console.error('Error voting:', error)
      broadcast({ type: 'card_updated', payload: card })
    }
  }

  const handleReact = async (card: CardType, emoji: string) => {
    const reactions = { ...(card.reactions ?? {}) }
    const current = reactions[emoji] ?? []

    if (current.includes(participantId)) {
      const remaining = current.filter(id => id !== participantId)
      if (remaining.length > 0) {
        reactions[emoji] = remaining
      } else {
        delete reactions[emoji]
      }
    } else {
      reactions[emoji] = [...current, participantId]
    }

    broadcast({ type: 'card_updated', payload: { ...card, reactions } })

    try {
      await trackOperation(async () => {
        const res = await fetch('/api/cards/react', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            card_id: card.id,
            participant_id: participantId,
            emoji,
          }),
        })

        if (res.ok) {
          const { card: serverCard } = await res.json()
          broadcast({ type: 'card_updated', payload: serverCard })
        } else {
          broadcast({ type: 'card_updated', payload: card })
        }
      })
    } catch (error) {
      console.error('Error reacting to card:', error)
      broadcast({ type: 'card_updated', payload: card })
    }
  }

  const handleDelete = async (cardId: string) => {
    broadcast({ type: 'card_deleted', payload: { id: cardId } })

    try {
      await trackOperation(async () => {
        await fetch(`/api/cards?id=${cardId}`, { method: 'DELETE' })
      })
    } catch (error) {
      console.error('Error deleting card:', error)
    }
  }

  const handleEdit = async (card: CardType, newText: string) => {
    const optimistic: CardType = { ...card, text: newText }
    broadcast({ type: 'card_updated', payload: optimistic })

    try {
      await trackOperation(async () => {
        const res = await fetch('/api/cards', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: card.id, text: newText }),
        })

        if (res.ok) {
          const { card: serverCard } = await res.json()
          broadcast({ type: 'card_updated', payload: serverCard })
        } else {
          broadcast({ type: 'card_updated', payload: card })
        }
      })
    } catch (error) {
      console.error('Error editing card:', error)
      broadcast({ type: 'card_updated', payload: card })
    }
  }

  const handleMove = async (card: CardType, targetColumn: ColumnType) => {
    // Optimistic: remove from current, will appear in target via broadcast
    const movedCard: CardType = { ...card, column_type: targetColumn }
    broadcast({ type: 'card_deleted', payload: { id: card.id } })
    broadcast({ type: 'card_added', payload: movedCard })

    try {
      await trackOperation(async () => {
        const res = await fetch('/api/cards', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: card.id, column_type: targetColumn }),
        })

        if (res.ok) {
          const { card: serverCard } = await res.json()
          // Sync with server
          broadcast({ type: 'card_deleted', payload: { id: movedCard.id } })
          broadcast({ type: 'card_added', payload: serverCard })
        } else {
          // Revert
          broadcast({ type: 'card_deleted', payload: { id: movedCard.id } })
          broadcast({ type: 'card_added', payload: card })
        }
      })
    } catch (error) {
      console.error('Error moving card:', error)
      broadcast({ type: 'card_deleted', payload: { id: movedCard.id } })
      broadcast({ type: 'card_added', payload: card })
    }
  }

  const handleUngroupCard = async (card: CardType) => {
    try {
      await trackOperation(async () => {
        const res = await fetch(`/api/cards/group?card_id=${card.id}`, { method: 'DELETE' })
        if (res.ok) {
          const { cards: updated } = await res.json()
          broadcast({ type: 'cards_updated', payload: updated })
        }
      })
    } catch (error) {
      console.error('Error ungrouping card:', error)
    }
  }

  const handleUngroupAll = async (groupId: string) => {
    try {
      await trackOperation(async () => {
        const res = await fetch(
          `/api/cards/group?group_id=${groupId}&session_token=${encodeURIComponent(sessionToken)}`,
          { method: 'DELETE' }
        )
        if (res.ok) {
          const { cards: updated } = await res.json()
          broadcast({ type: 'cards_updated', payload: updated })
        }
      })
    } catch (error) {
      console.error('Error ungrouping:', error)
    }
  }

  const handleRenameGroup = async (groupId: string, label: string) => {
    try {
      await trackOperation(async () => {
        const res = await fetch('/api/cards/group', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            group_id: groupId,
            session_token: sessionToken,
            label: label.trim() || null,
          }),
        })
        if (res.ok) {
          const { cards: updated } = await res.json()
          broadcast({ type: 'cards_updated', payload: updated })
        }
      })
    } catch (error) {
      console.error('Error renaming group:', error)
    }
  }

  const entries = buildEntries(cards)
  const otherColumns = (Object.keys(columnLabels) as ColumnType[]).filter(c => c !== type)

  const { setNodeRef, isOver } = useDroppable({ id: type, disabled: readOnly })

  const renderCard = (card: CardType, inGroup: boolean) => (
    <RetroCard
      key={card.id}
      card={card}
      participantId={participantId}
      currentColumn={type}
      otherColumns={otherColumns}
      inGroup={inGroup}
      isHidden={cardsHidden && card.author_id !== participantId}
      readOnly={readOnly}
      onVote={() => handleVote(card)}
      onReact={(emoji) => handleReact(card, emoji)}
      onDelete={() => handleDelete(card.id)}
      onEdit={(text) => handleEdit(card, text)}
      onMove={(target) => handleMove(card, target)}
      onUngroup={() => handleUngroupCard(card)}
    />
  )

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'rounded-lg border flex flex-col transition-colors min-h-0',
        styles.bg,
        styles.border,
        isOver && 'ring-2 ring-primary/50'
      )}
    >      {/* Header */}
      <div className={cn('px-4 py-3 rounded-t-lg font-medium', styles.header)}>
        <div className="flex items-center justify-between">
          <span>{title}</span>
          <span className="text-sm opacity-75">{cards.length}</span>
        </div>
      </div>

      {/* Add Card Form - fixed at top */}
      {!readOnly && (
        <div className="px-2 pt-2">
          {isColumnFull ? (
            <p className="text-xs text-muted-foreground text-center py-2">
              Limite de 100 cards atingido
            </p>
          ) : isAdding ? (
            <Card className="border-dashed">
              <CardContent className="p-2">
                <Textarea
                  placeholder="Digite seu feedback..."
                  value={newText}
                  onChange={(e) => setNewText(e.target.value)}
                  className="min-h-[80px] resize-none text-sm"
                  maxLength={500}
                  autoFocus
                />
                <div className="flex justify-between items-center mt-2">
                  <span className="text-xs text-muted-foreground">
                    {newText.length}/500
                  </span>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setIsAdding(false)
                        setNewText('')
                      }}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleAddCard}
                      disabled={!newText.trim() || isSubmitting}
                    >
                      <Send className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Button
              variant="ghost"
              className="w-full border border-dashed border-border/50 text-muted-foreground hover:text-foreground"
              onClick={() => setIsAdding(true)}
            >
              <Plus className="w-4 h-4 mr-2" />
              Adicionar
            </Button>
          )}
        </div>
      )}

      {/* Cards List */}
      <div className="flex-1 p-2 space-y-2 overflow-y-auto scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent">
        {entries.map((entry) =>
          entry.kind === 'card' ? (
            renderCard(entry.card, false)
          ) : (
            <CardGroup
              key={entry.key}
              label={entry.label}
              count={entry.cards.length}
              votes={entry.votes}
              readOnly={readOnly}
              onRename={(label) => handleRenameGroup(entry.groupId, label)}
              onUngroupAll={() => handleUngroupAll(entry.groupId)}
            >
              {entry.cards.map((card) => renderCard(card, true))}
            </CardGroup>
          )
        )}
      </div>
    </div>
  )
}

type CardGroupProps = {
  label: string | null
  count: number
  votes: number
  readOnly: boolean
  onRename: (label: string) => void
  onUngroupAll: () => void
  children: React.ReactNode
}

function CardGroup({ label, count, votes, readOnly, onRename, onUngroupAll, children }: CardGroupProps) {
  const [isEditingLabel, setIsEditingLabel] = useState(false)
  const [draftLabel, setDraftLabel] = useState(label ?? '')

  const saveLabel = () => {
    if (draftLabel.trim() !== (label ?? '')) {
      onRename(draftLabel)
    }
    setIsEditingLabel(false)
  }

  return (
    <div className="group/group rounded-lg border-2 border-dashed border-primary/40 bg-background/40 p-2">
      <div className="flex items-center gap-1 px-1 pb-2">
        <Layers className="w-3.5 h-3.5 shrink-0 text-primary" />
        {isEditingLabel ? (
          <Input
            value={draftLabel}
            onChange={(e) => setDraftLabel(e.target.value)}
            onBlur={saveLabel}
            onKeyDown={(e) => {
              if (e.key === 'Enter') saveLabel()
              if (e.key === 'Escape') {
                setDraftLabel(label ?? '')
                setIsEditingLabel(false)
              }
            }}
            placeholder="Nome do grupo"
            maxLength={60}
            autoFocus
            className="h-6 text-xs"
          />
        ) : (
          <button
            type="button"
            disabled={readOnly}
            onClick={() => {
              setDraftLabel(label ?? '')
              setIsEditingLabel(true)
            }}
            className="flex-1 min-w-0 truncate text-left text-xs font-medium text-foreground disabled:cursor-default"
          >
            {label || <span className="text-muted-foreground">Grupo sem nome</span>}
          </button>
        )}
        <span className="shrink-0 text-[11px] text-muted-foreground">{count} cards</span>
        <span className="flex shrink-0 items-center gap-1 text-[11px] text-muted-foreground">
          <ThumbsUp className="w-3 h-3" />
          {votes}
        </span>
        {!readOnly && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 shrink-0 p-0 opacity-0 transition-opacity group-hover/group:opacity-100"
            title="Desagrupar todos"
            onClick={onUngroupAll}
          >
            <Ungroup className="w-3 h-3" />
          </Button>
        )}
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  )
}

type RetroCardProps = {
  card: CardType
  participantId: string
  currentColumn: ColumnType
  otherColumns: ColumnType[]
  inGroup: boolean
  isHidden: boolean
  readOnly: boolean
  onVote: () => void
  onReact: (emoji: string) => void
  onDelete: () => void
  onEdit: (newText: string) => void
  onMove: (targetColumn: ColumnType) => void
  onUngroup: () => void
}

function RetroCard({
  card,
  participantId,
  currentColumn,
  otherColumns,
  inGroup,
  isHidden,
  readOnly,
  onVote,
  onReact,
  onDelete,
  onEdit,
  onMove,
  onUngroup,
}: RetroCardProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editText, setEditText] = useState(card.text)
  const isOwner = card.author_id === participantId
  const hasVoted = card.voters.includes(participantId)
  const interactive = !readOnly && !isHidden

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: card.id,
    disabled: !interactive,
  })

  // Cada card também é alvo de drop: soltar um card sobre outro cria um grupo.
  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: `card:${card.id}`,
    disabled: !interactive,
  })

  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
  } : undefined

  const handleSaveEdit = () => {
    if (editText.trim() && editText.trim() !== card.text) {
      onEdit(editText.trim())
    }
    setIsEditing(false)
  }

  if (isHidden) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex items-center gap-2 p-3 text-muted-foreground">
          <EyeOff className="w-3.5 h-3.5 shrink-0" />
          <span className="text-xs">Oculto até a revelação</span>
        </CardContent>
      </Card>
    )
  }

  if (isEditing) {
    return (
      <Card>
        <CardContent className="p-2">
          <Textarea
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            className="min-h-[60px] resize-none text-sm"
            maxLength={500}
            autoFocus
          />
          <div className="flex justify-between items-center mt-2">
            <span className="text-xs text-muted-foreground">{editText.length}/500</span>
            <div className="flex gap-1">
              <Button variant="ghost" size="sm" onClick={() => { setIsEditing(false); setEditText(card.text) }}>
                <X className="w-4 h-4" />
              </Button>
              <Button size="sm" onClick={handleSaveEdit} disabled={!editText.trim()}>
                <Check className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div ref={setDropRef}>
      <Card
        ref={setNodeRef}
        style={style}
        className={cn(
          'group',
          isDragging && 'opacity-50',
          isOver && !isDragging && 'ring-2 ring-primary'
        )}
      >
        <CardContent className="p-3">
          <div className="flex gap-1">
            {interactive && (
              <div
                {...attributes}
                {...listeners}
                title="Arraste para outra coluna ou solte sobre outro card para agrupar"
                className="flex items-center cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-50 transition-opacity"
              >
                <GripVertical className="w-3 h-3" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm whitespace-pre-wrap break-words">{card.text}</p>
            </div>
          </div>

          <div className="mt-2">
            <CardReactions
              reactions={card.reactions ?? {}}
              participantId={participantId}
              disabled={!interactive}
              onToggle={onReact}
            />
          </div>

          <div className="flex items-center justify-end mt-2 pt-2 border-t border-border/50">
            <div className="flex items-center gap-1">
              {/* Desagrupar (apenas dentro de um grupo) */}
              {inGroup && !readOnly && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Remover do grupo"
                  onClick={onUngroup}
                >
                  <Ungroup className="w-3 h-3" />
                </Button>
              )}

              {/* Move dropdown */}
              {!readOnly && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <ArrowRight className="w-3 h-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {otherColumns.map(col => (
                      <DropdownMenuItem key={col} onClick={() => onMove(col)}>
                        Mover para {columnLabels[col]}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}

              {/* Edit button */}
              {!readOnly && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => setIsEditing(true)}
                >
                  <Pencil className="w-3 h-3" />
                </Button>
              )}

              {/* Delete (owner only) */}
              {isOwner && !readOnly && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive"
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Excluir card?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Essa ação não pode ser desfeita. O card será removido permanentemente.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={onDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                        Excluir
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}

              {/* Vote */}
              <Button
                variant={hasVoted ? 'default' : 'ghost'}
                size="sm"
                className="h-7 gap-1 px-2"
                disabled={readOnly}
                onClick={onVote}
              >
                <ThumbsUp className="w-3 h-3" />
                <span className="text-xs">{card.votes}</span>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
