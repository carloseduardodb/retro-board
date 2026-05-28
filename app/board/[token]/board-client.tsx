'use client'

import { useState, useCallback } from 'react'
import { useParticipant } from '@/hooks/use-participant'
import { useRealtime } from '@/hooks/use-realtime'
import type { Session, Card, ActionCard, Suggestion, PrevAction } from '@/lib/types/database'
import { BoardHeader } from '@/components/board/board-header'
import { BoardColumn } from '@/components/board/board-column'
import { ActionsColumn } from '@/components/board/actions-column'
import { TimerPanel } from '@/components/board/timer-panel'
import { ParticipantsPanel } from '@/components/board/participants-panel'
import { PrevActionsPanel } from '@/components/board/prev-actions-panel'
import { AIPanel } from '@/components/board/ai-panel'
import { RefreshCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card as CardUI, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DndContext, DragOverlay, closestCenter, PointerSensor, useSensor, useSensors, type DragStartEvent, type DragEndEvent } from '@dnd-kit/core'

type BoardClientProps = {
  session: Session
  initialCards: Card[]
  initialActionCards: ActionCard[]
  initialSuggestions: Suggestion[]
  initialPrevActions: PrevAction[]
}

export function BoardClient({
  session,
  initialCards,
  initialActionCards,
  initialSuggestions,
  initialPrevActions,
}: BoardClientProps) {
  const { participantId, participantName, updateName, isReady } = useParticipant()
  const [showAIPanel, setShowAIPanel] = useState(false)
  const [showPrevActions, setShowPrevActions] = useState(false)
  const [isClosing, setIsClosing] = useState(false)
  const [pendingOps, setPendingOps] = useState(0)

  const trackOperation = async <T,>(operation: () => Promise<T>): Promise<T> => {
    setPendingOps(n => n + 1)
    try {
      return await operation()
    } finally {
      setPendingOps(n => n - 1)
    }
  }

  const {
    cards,
    actionCards,
    suggestions,
    prevActions,
    session: realtimeSession,
    participants,
    isConnected,
    broadcast,
  } = useRealtime(session.token, participantId, participantName, {
    session,
    cards: initialCards,
    actionCards: initialActionCards,
    suggestions: initialSuggestions,
    prevActions: initialPrevActions,
  })

  const currentSession = realtimeSession || session

  // Filter cards by column
  const goodCards = cards.filter(c => c.column_type === 'good')
  const badCards = cards.filter(c => c.column_type === 'bad')
  const ideasCards = cards.filter(c => c.column_type === 'ideas')

  // DnD setup
  const [activeCard, setActiveCard] = useState<Card | null>(null)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  )

  const handleDragStart = (event: DragStartEvent) => {
    const card = cards.find(c => c.id === event.active.id)
    if (card) setActiveCard(card)
  }

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    setActiveCard(null)
    const { active, over } = event
    if (!over) return

    const cardId = active.id as string
    const targetColumn = over.id as string

    // Only allow dropping on column droppables (good, bad, ideas)
    if (!['good', 'bad', 'ideas'].includes(targetColumn)) return

    const card = cards.find(c => c.id === cardId)
    if (!card || card.column_type === targetColumn) return

    // Optimistic move
    const movedCard: Card = { ...card, column_type: targetColumn as 'good' | 'bad' | 'ideas' }
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
          broadcast({ type: 'card_deleted', payload: { id: movedCard.id } })
          broadcast({ type: 'card_added', payload: serverCard })
        } else {
          broadcast({ type: 'card_deleted', payload: { id: movedCard.id } })
          broadcast({ type: 'card_added', payload: card })
        }
      })
    } catch {
      broadcast({ type: 'card_deleted', payload: { id: movedCard.id } })
      broadcast({ type: 'card_added', payload: card })
    }
  }, [cards, broadcast, trackOperation])

  const handleCloseRetro = async () => {
    if (isClosing) return
    const confirmed = window.confirm(
      'Tem certeza que deseja encerrar a retro? Todos os cards serão removidos e as ações serão salvas para a próxima sprint.'
    )
    if (!confirmed) return

    setIsClosing(true)
    try {
      const res = await fetch('/api/sessions/close', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_token: session.token }),
      })

      if (res.ok) {
        const { prevActions: newPrevActions } = await res.json()
        broadcast({ type: 'retro_closed', payload: { prevActions: newPrevActions } })
      }
    } catch (error) {
      console.error('Error closing retro:', error)
    } finally {
      setIsClosing(false)
    }
  }

  if (!isReady) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-background">
        <RefreshCcw className="w-8 h-8 animate-spin text-muted-foreground" />
      </main>
    )
  }

  if (!participantName) {
    return <NamePrompt onConfirm={updateName} />
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <BoardHeader
        token={session.token}
        participantsCount={participants.length}
        isConnected={isConnected}
        isSyncing={pendingOps > 0}
        onShowPrevActions={() => setShowPrevActions(true)}
        onShowAI={() => setShowAIPanel(true)}
        onCloseRetro={handleCloseRetro}
      />

      <div className="flex-1 flex flex-col lg:flex-row">
        {/* Main Board Area */}
        <div className="flex-1 p-4 overflow-auto">
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 h-full min-h-[600px]">
              <BoardColumn
                type="good"
                title="O que foi bom"
                cards={goodCards}
                sessionToken={session.token}
                participantId={participantId}
                participantName={participantName}
                broadcast={broadcast}
                trackOperation={trackOperation}
              />
              <BoardColumn
                type="bad"
                title="O que pode melhorar"
                cards={badCards}
                sessionToken={session.token}
                participantId={participantId}
                participantName={participantName}
                broadcast={broadcast}
                trackOperation={trackOperation}
              />
              <BoardColumn
                type="ideas"
                title="Ideias"
                cards={ideasCards}
                sessionToken={session.token}
                participantId={participantId}
                participantName={participantName}
                broadcast={broadcast}
                trackOperation={trackOperation}
              />
              <ActionsColumn
                actionCards={actionCards}
                sessionToken={session.token}
                participantId={participantId}
                participantName={participantName}
                broadcast={broadcast}
                trackOperation={trackOperation}
              />
            </div>
            <DragOverlay>
              {activeCard && (
                <div className="bg-card border rounded-lg p-3 shadow-lg opacity-90 max-w-[250px]">
                  <p className="text-sm">{activeCard.text}</p>
                </div>
              )}
            </DragOverlay>
          </DndContext>
        </div>

        {/* Right Sidebar */}
        <div className="w-full lg:w-72 border-t lg:border-t-0 lg:border-l border-border bg-card p-4 space-y-4">
          <TimerPanel
            session={currentSession}
            sessionToken={session.token}
            broadcast={broadcast}
          />
          <ParticipantsPanel
            participants={participants}
            currentParticipantId={participantId}
            onRename={updateName}
          />
        </div>
      </div>

      {/* Prev Actions Modal */}
      {showPrevActions && (
        <PrevActionsPanel
          prevActions={prevActions}
          sessionToken={session.token}
          participantId={participantId}
          broadcast={broadcast}
          onClose={() => setShowPrevActions(false)}
        />
      )}

      {/* AI Panel Modal */}
      {showAIPanel && (
        <AIPanel
          sessionToken={session.token}
          cards={cards}
          actionCards={actionCards}
          suggestions={suggestions}
          broadcast={broadcast}
          onClose={() => setShowAIPanel(false)}
        />
      )}
    </div>
  )
}

function NamePrompt({ onConfirm }: { onConfirm: (name: string) => void }) {
  const [name, setName] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (name.trim()) {
      onConfirm(name.trim())
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-background p-4">
      <CardUI className="w-full max-w-sm shadow-lg">
        <CardHeader>
          <CardTitle className="text-center">Como você quer ser chamado?</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              placeholder="Seu nome ou apelido"
              value={name}
              onChange={(e) => setName(e.target.value.slice(0, 20))}
              maxLength={20}
              autoFocus
              className="text-base"
            />
            <Button type="submit" disabled={!name.trim()} className="w-full">
              Entrar na Retro
            </Button>
          </form>
        </CardContent>
      </CardUI>
    </main>
  )
}
