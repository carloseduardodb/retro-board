'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
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
import { Plus, ThumbsUp, Trash2, X, Send, Pencil, ArrowRight, Check, GripVertical } from 'lucide-react'
import type { Card as CardType, RealtimeEvent } from '@/lib/types/database'
import { cn } from '@/lib/utils'
import { useDroppable, useDraggable } from '@dnd-kit/core'

type ColumnType = 'good' | 'bad' | 'ideas'

type BoardColumnProps = {
  type: ColumnType
  title: string
  cards: CardType[]
  sessionToken: string
  participantId: string
  participantName: string
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

export function BoardColumn({
  type,
  title,
  cards,
  sessionToken,
  participantId,
  participantName,
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

  // Sort cards by votes (descending), then by createdAt (descending) as tiebreaker
  const sortedCards = [...cards].sort((a, b) => {
    if (b.votes !== a.votes) return b.votes - a.votes
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })

  const otherColumns = (Object.keys(columnLabels) as ColumnType[]).filter(c => c !== type)

  const { setNodeRef, isOver } = useDroppable({ id: type })

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'rounded-lg border flex flex-col transition-colors',
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

      {/* Cards List */}
      <div className="flex-1 p-2 space-y-2 overflow-y-auto max-h-[500px]">
        {sortedCards.map((card) => (
          <RetroCard
            key={card.id}
            card={card}
            participantId={participantId}
            currentColumn={type}
            otherColumns={otherColumns}
            onVote={() => handleVote(card)}
            onDelete={() => handleDelete(card.id)}
            onEdit={(newText) => handleEdit(card, newText)}
            onMove={(target) => handleMove(card, target)}
          />
        ))}

        {/* Add Card Form */}
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
    </div>
  )
}

type RetroCardProps = {
  card: CardType
  participantId: string
  currentColumn: ColumnType
  otherColumns: ColumnType[]
  onVote: () => void
  onDelete: () => void
  onEdit: (newText: string) => void
  onMove: (targetColumn: ColumnType) => void
}

function RetroCard({ card, participantId, currentColumn, otherColumns, onVote, onDelete, onEdit, onMove }: RetroCardProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editText, setEditText] = useState(card.text)
  const isOwner = card.author_id === participantId
  const hasVoted = card.voters.includes(participantId)

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: card.id,
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
    <Card ref={setNodeRef} style={style} className={cn('group', isDragging && 'opacity-50')}>
      <CardContent className="p-3">
        <div className="flex gap-1">
          <div
            {...attributes}
            {...listeners}
            className="flex items-center cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-50 transition-opacity"
          >
            <GripVertical className="w-3 h-3" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm whitespace-pre-wrap break-words">{card.text}</p>
          </div>
        </div>
        <div className="flex items-center justify-end mt-2 pt-2 border-t border-border/50">
          <div className="flex items-center gap-1">
            {/* Move dropdown */}
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

            {/* Edit button */}
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={() => setIsEditing(true)}
            >
              <Pencil className="w-3 h-3" />
            </Button>

            {/* Delete (owner only) */}
            {isOwner && (
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
              onClick={onVote}
            >
              <ThumbsUp className="w-3 h-3" />
              <span className="text-xs">{card.votes}</span>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
