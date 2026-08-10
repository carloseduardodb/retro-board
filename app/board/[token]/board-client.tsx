'use client'

import { useState, useCallback } from 'react'
import { useParticipant } from '@/hooks/use-participant'
import { useRealtime } from '@/hooks/use-realtime'
import { useHistoryRealtime } from '@/hooks/use-history-realtime'
import type { Session, Card, ActionCard, Suggestion, PrevAction, SnapshotData } from '@/lib/types/database'
import { BoardHeader } from '@/components/board/board-header'
import { BoardColumn } from '@/components/board/board-column'
import { ActionsColumn } from '@/components/board/actions-column'
import { TimerPanel } from '@/components/board/timer-panel'
import { ParticipantsPanel } from '@/components/board/participants-panel'
import { PrevActionsPanel } from '@/components/board/prev-actions-panel'
import { AIPanel } from '@/components/board/ai-panel'
import { HistoryCalendar } from '@/components/board/history-calendar'
import { HistoryBanner } from '@/components/board/history-banner'
import { DrawingLayer } from '@/components/board/drawing-layer'
import { RefreshCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card as CardUI, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DndContext, DragOverlay, closestCenter, pointerWithin, PointerSensor, useSensor, useSensors, type CollisionDetection, type DragStartEvent, type DragEndEvent } from '@dnd-kit/core'
import { toast } from 'sonner'
import { formatDateBrasilia } from '@/lib/snapshot-utils'

// Agrupar exige soltar o card exatamente em cima de outro card; em qualquer
// outra posição vale a coluna mais próxima (mover entre colunas).
const boardCollisionDetection: CollisionDetection = (args) => {
  const hits = pointerWithin(args)
  // Card tem prioridade sobre o bloco do grupo, que tem prioridade sobre a coluna.
  const hit =
    hits.find((c) => String(c.id).startsWith('card:')) ??
    hits.find((c) => String(c.id).startsWith('group:'))
  return hit ? [hit] : closestCenter(args)
}

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
  const [isDrawing, setIsDrawing] = useState(false)
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

  // History mode state
  const [historyMode, setHistoryMode] = useState(false)
  const [historyDate, setHistoryDate] = useState<Date | null>(null)
  const [historyCards, setHistoryCards] = useState<Card[]>([])
  const [historyActionCards, setHistoryActionCards] = useState<ActionCard[]>([])

  // Format historyDate as YYYY-MM-DD for the realtime channel
  const historyDateStr = historyDate
    ? `${historyDate.getFullYear()}-${String(historyDate.getMonth() + 1).padStart(2, '0')}-${String(historyDate.getDate()).padStart(2, '0')}`
    : null

  // Subscribe to the history broadcast channel for real-time updates from other participants
  const handleHistoryRealtimeUpdate = useCallback((updatedCards: Card[], updatedActionCards: ActionCard[]) => {
    setHistoryCards(updatedCards)
    setHistoryActionCards(updatedActionCards)
  }, [])

  useHistoryRealtime({
    sessionToken: session.token,
    date: historyDateStr,
    enabled: historyMode,
    onUpdate: handleHistoryRealtimeUpdate,
  })

  const handleSelectHistoryDate = useCallback(async (date: Date) => {
    setHistoryMode(true)
    setHistoryDate(date)

    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const isoDate = `${year}-${month}-${day}`

    try {
      const res = await fetch(
        `/api/snapshots/${isoDate}?session_token=${encodeURIComponent(session.token)}`
      )
      if (res.ok) {
        const data = await res.json()
        const snapshotData: SnapshotData = data.snapshot.snapshot_data
        // Map snapshot cards to Card type for column rendering
        setHistoryCards(
          snapshotData.cards.map((c) => ({
            ...c,
            session_token: session.token,
            group_id: c.group_id ?? null,
            group_label: c.group_label ?? null,
            reactions: c.reactions ?? {},
          }))
        )
        setHistoryActionCards(
          snapshotData.actionCards.map((a) => ({
            ...a,
            session_token: session.token,
          }))
        )
      }
    } catch (error) {
      console.error('Error loading snapshot:', error)
    }
  }, [session.token])

  const handleExitHistory = useCallback(() => {
    setHistoryMode(false)
    setHistoryDate(null)
    setHistoryCards([])
    setHistoryActionCards([])
  }, [])

  // Conditional card rendering based on history mode
  const displayCards = historyMode ? historyCards : cards
  const displayActionCards = historyMode ? historyActionCards : actionCards

  // Filter cards by column
  const goodCards = displayCards.filter(c => c.column_type === 'good')
  const badCards = displayCards.filter(c => c.column_type === 'bad')
  const ideasCards = displayCards.filter(c => c.column_type === 'ideas')

  // DnD setup (disabled in history mode)
  const [activeCard, setActiveCard] = useState<Card | null>(null)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  )
  const activeSensors = historyMode ? undefined : sensors

  const handleDragStart = (event: DragStartEvent) => {
    if (historyMode) return
    const card = cards.find(c => c.id === event.active.id)
    if (card) setActiveCard(card)
  }

  // Agrupa dois cards relacionados (soltar um card em cima do outro)
  const handleGroupCards = useCallback(async (cardId: string, targetCardId: string) => {
    try {
      await trackOperation(async () => {
        const res = await fetch('/api/cards/group', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ card_id: cardId, target_card_id: targetCardId }),
        })

        if (res.ok) {
          const { cards: updated } = await res.json()
          broadcast({ type: 'cards_updated', payload: updated })
        } else {
          toast.error('Não foi possível agrupar os cards')
        }
      })
    } catch (error) {
      console.error('Error grouping cards:', error)
      toast.error('Não foi possível agrupar os cards')
    }
  }, [broadcast, trackOperation])

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    setActiveCard(null)
    if (historyMode) return
    const { active, over } = event
    if (!over) return

    const cardId = active.id as string
    const overId = String(over.id)

    // Soltou sobre outro card (ou sobre o bloco de um grupo) → agrupar
    if (overId.startsWith('card:') || overId.startsWith('group:')) {
      const targetCardId = overId.startsWith('card:')
        ? overId.slice('card:'.length)
        : (over.data.current?.targetCardId as string | undefined)

      if (targetCardId && targetCardId !== cardId) {
        await handleGroupCards(cardId, targetCardId)
      }
      return
    }

    const targetColumn = overId

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
  }, [cards, broadcast, trackOperation, historyMode, handleGroupCards])

  // Anti-viés: enquanto o timer roda, os cards dos outros participantes ficam
  // ocultos. Ao pausar, encerrar ou expirar o timer, todos ficam visíveis.
  const cardsHidden = !historyMode && currentSession.timer_status === 'running'


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
    <div className="h-screen bg-background flex flex-col overflow-hidden">
      <BoardHeader
        token={session.token}
        participantsCount={participants.length}
        isConnected={isConnected}
        isSyncing={pendingOps > 0}
        isDrawing={isDrawing}
        onToggleDrawing={() => setIsDrawing(v => !v)}
        onShowPrevActions={() => setShowPrevActions(true)}
        onShowAI={() => setShowAIPanel(true)}
        onCloseRetro={handleCloseRetro}
      />

      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden min-h-0">
        {/* Main Board Area */}
        <div className="relative flex-1 p-4 min-h-0 flex flex-col overflow-hidden">
          {historyMode && historyDate && (
            <HistoryBanner date={historyDate} onExit={handleExitHistory} />
          )}
          <DndContext sensors={activeSensors} collisionDetection={boardCollisionDetection} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 flex-1 min-h-0">
              <BoardColumn
                type="good"
                title="O que foi bom"
                cards={goodCards}
                sessionToken={session.token}
                participantId={participantId}
                participantName={participantName}
                cardsHidden={cardsHidden}
                readOnly={historyMode}
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
                cardsHidden={cardsHidden}
                readOnly={historyMode}
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
                cardsHidden={cardsHidden}
                readOnly={historyMode}
                broadcast={broadcast}
                trackOperation={trackOperation}
              />
              <ActionsColumn
                actionCards={displayActionCards}
                sessionToken={session.token}
                participantId={participantId}
                participantName={participantName}
                readOnly={historyMode}
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

          {/* Camada de rabiscos: sempre visível, mas só captura o mouse em modo desenho */}
          <DrawingLayer
            sessionToken={session.token}
            participantId={participantId}
            isDrawing={isDrawing}
            onExit={() => setIsDrawing(false)}
          />
        </div>

        {/* Right Sidebar */}
        <div className="w-full lg:w-72 border-t lg:border-t-0 lg:border-l border-border bg-card p-4 space-y-4 overflow-y-auto scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent">
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
          <HistoryCalendar
            sessionToken={session.token}
            onSelectDate={handleSelectHistoryDate}
            onExitHistory={handleExitHistory}
            isHistoryMode={historyMode}
            selectedDate={historyDate}
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
