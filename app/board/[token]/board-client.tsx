'use client'

import { useState } from 'react'
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
  const { participantId, participantName, isReady } = useParticipant()
  const [showAIPanel, setShowAIPanel] = useState(false)
  const [showPrevActions, setShowPrevActions] = useState(false)
  const [isClosing, setIsClosing] = useState(false)

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

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <BoardHeader
        token={session.token}
        participantsCount={participants.length}
        isConnected={isConnected}
        onShowPrevActions={() => setShowPrevActions(true)}
        onShowAI={() => setShowAIPanel(true)}
        onCloseRetro={handleCloseRetro}
      />

      <div className="flex-1 flex flex-col lg:flex-row">
        {/* Main Board Area */}
        <div className="flex-1 p-4 overflow-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 h-full min-h-[600px]">
            <BoardColumn
              type="good"
              title="O que foi bom"
              cards={goodCards}
              sessionToken={session.token}
              participantId={participantId}
              participantName={participantName}
              broadcast={broadcast}
            />
            <BoardColumn
              type="bad"
              title="O que pode melhorar"
              cards={badCards}
              sessionToken={session.token}
              participantId={participantId}
              participantName={participantName}
              broadcast={broadcast}
            />
            <BoardColumn
              type="ideas"
              title="Ideias"
              cards={ideasCards}
              sessionToken={session.token}
              participantId={participantId}
              participantName={participantName}
              broadcast={broadcast}
            />
            <ActionsColumn
              actionCards={actionCards}
              sessionToken={session.token}
              participantId={participantId}
              participantName={participantName}
              broadcast={broadcast}
            />
          </div>
        </div>

        {/* Right Sidebar */}
        <div className="w-full lg:w-72 border-t lg:border-t-0 lg:border-l border-border bg-card p-4 space-y-4">
          <TimerPanel
            session={currentSession}
            sessionToken={session.token}
            broadcast={broadcast}
          />
          <ParticipantsPanel participants={participants} />
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
