'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Plus, Trash2, X, Send, User } from 'lucide-react'
import type { ActionCard, RealtimeEvent } from '@/lib/types/database'
import { cn } from '@/lib/utils'

type ActionsColumnProps = {
  actionCards: ActionCard[]
  sessionToken: string
  participantId: string
  participantName: string
  broadcast: (event: RealtimeEvent) => void
  trackOperation: <T>(op: () => Promise<T>) => Promise<T>
}

export function ActionsColumn({
  actionCards,
  sessionToken,
  participantId,
  participantName,
  broadcast,
  trackOperation,
}: ActionsColumnProps) {
  const [isAdding, setIsAdding] = useState(false)
  const [newText, setNewText] = useState('')
  const [responsible, setResponsible] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleAddAction = async () => {
    if (!newText.trim() || isSubmitting) return

    const text = newText.trim()
    const resp = responsible.trim() || null
    setIsSubmitting(true)
    setNewText('')
    setResponsible('')
    setIsAdding(false)

    // Optimistic
    const tempId = `temp-${Date.now()}`
    const optimisticAction: ActionCard = {
      id: tempId,
      session_token: sessionToken,
      text,
      responsible: resp,
      author: participantName || 'Anônimo',
      author_id: participantId,
      created_at: new Date().toISOString(),
    }
    broadcast({ type: 'action_added', payload: optimisticAction })

    try {
      await trackOperation(async () => {
        const res = await fetch('/api/actions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            session_token: sessionToken,
            text,
            responsible: resp,
            author: participantName || 'Anônimo',
            author_id: participantId,
          }),
        })

        if (res.ok) {
          const { action } = await res.json()
          broadcast({ type: 'action_deleted', payload: { id: tempId } })
          broadcast({ type: 'action_added', payload: action })
        } else {
          broadcast({ type: 'action_deleted', payload: { id: tempId } })
        }
      })
    } catch (error) {
      console.error('Error adding action:', error)
      broadcast({ type: 'action_deleted', payload: { id: tempId } })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async (actionId: string) => {
    // Optimistic
    broadcast({ type: 'action_deleted', payload: { id: actionId } })

    try {
      await trackOperation(async () => {
        await fetch(`/api/actions?id=${actionId}`, { method: 'DELETE' })
      })
    } catch (error) {
      console.error('Error deleting action:', error)
    }
  }

  return (
    <div className={cn('rounded-lg border flex flex-col bg-column-actions/30 border-column-actions/50')}>
      {/* Header */}
      <div className="px-4 py-3 rounded-t-lg font-medium bg-column-actions text-column-actions-foreground">
        <div className="flex items-center justify-between">
          <span>Ações</span>
          <span className="text-sm opacity-75">{actionCards.length}</span>
        </div>
      </div>

      {/* Add Action Form - fixed at top */}
      <div className="px-2 pt-2">
        {isAdding ? (
          <Card className="border-dashed">
            <CardContent className="p-2 space-y-2">
              <Textarea
                placeholder="Descreva a ação..."
                value={newText}
                onChange={(e) => setNewText(e.target.value)}
                className="min-h-[60px] resize-none text-sm"
                maxLength={500}
                autoFocus
              />
              <Input
                placeholder="Responsável (opcional)"
                value={responsible}
                onChange={(e) => setResponsible(e.target.value)}
                className="text-sm"
              />
              <div className="flex justify-between items-center">
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
                      setResponsible('')
                    }}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleAddAction}
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
            Adicionar Ação
          </Button>
        )}
      </div>

      {/* Actions List */}
      <div className="flex-1 p-2 space-y-2 overflow-y-auto scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent">
        {actionCards.map((action) => (
          <ActionCardItem
            key={action.id}
            action={action}
            participantId={participantId}
            onDelete={() => handleDelete(action.id)}
          />
        ))}
      </div>
    </div>
  )
}

type ActionCardItemProps = {
  action: ActionCard
  participantId: string
  onDelete: () => void
}

function ActionCardItem({ action, participantId, onDelete }: ActionCardItemProps) {
  const isOwner = action.author_id === participantId

  return (
    <Card className="group">
      <CardContent className="p-3">
        <p className="text-sm whitespace-pre-wrap break-words">{action.text}</p>
        {action.responsible && (
          <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
            <User className="w-3 h-3" />
            <span>{action.responsible}</span>
          </div>
        )}
        <div className="flex items-center justify-between mt-2 pt-2 border-t border-border/50">
          <span className="text-xs text-muted-foreground truncate max-w-[100px]">
            {action.author}
          </span>
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
        </div>
      </CardContent>
    </Card>
  )
}
