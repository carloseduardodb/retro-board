'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { Plus, ThumbsUp, Trash2, X, Send } from 'lucide-react'
import type { Card as CardType, RealtimeEvent } from '@/lib/types/database'
import { cn } from '@/lib/utils'

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

    // Optimistic: create a temporary card locally
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
    
    // Optimistic update
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
    // Optimistic: remove immediately
    broadcast({ type: 'card_deleted', payload: { id: cardId } })

    try {
      await trackOperation(async () => {
        await fetch(`/api/cards?id=${cardId}`, { method: 'DELETE' })
      })
    } catch (error) {
      console.error('Error deleting card:', error)
    }
  }

  // Sort cards by votes (descending), then by createdAt (descending) as tiebreaker
  const sortedCards = [...cards].sort((a, b) => {
    if (b.votes !== a.votes) return b.votes - a.votes
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })

  return (
    <div className={cn('rounded-lg border flex flex-col', styles.bg, styles.border)}>
      {/* Header */}
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
            onVote={() => handleVote(card)}
            onDelete={() => handleDelete(card.id)}
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
  onVote: () => void
  onDelete: () => void
}

function RetroCard({ card, participantId, onVote, onDelete }: RetroCardProps) {
  const isOwner = card.author_id === participantId
  const hasVoted = card.voters.includes(participantId)

  return (
    <Card className="group">
      <CardContent className="p-3">
        <p className="text-sm whitespace-pre-wrap break-words">{card.text}</p>
        <div className="flex items-center justify-end mt-2 pt-2 border-t border-border/50">
          <div className="flex items-center gap-1">
            {isOwner && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive"
                onClick={onDelete}
              >
                <Trash2 className="w-3 h-3" />
              </Button>
            )}
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
