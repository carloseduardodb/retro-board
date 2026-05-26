'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Card, CardContent } from '@/components/ui/card'
import { X, Plus, Clock, User, Trash2 } from 'lucide-react'
import type { PrevAction, RealtimeEvent } from '@/lib/types/database'

type PrevActionsPanelProps = {
  prevActions: PrevAction[]
  sessionToken: string
  participantId: string
  broadcast: (event: RealtimeEvent) => void
  onClose: () => void
}

export function PrevActionsPanel({
  prevActions,
  sessionToken,
  participantId,
  broadcast,
  onClose,
}: PrevActionsPanelProps) {
  const [isAdding, setIsAdding] = useState(false)
  const [newText, setNewText] = useState('')
  const [newResponsible, setNewResponsible] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleAddPrevAction = async () => {
    if (!newText.trim() || isSubmitting) return

    setIsSubmitting(true)
    try {
      const res = await fetch('/api/prev-actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_token: sessionToken,
          text: newText.trim(),
          responsible: newResponsible.trim() || null,
        }),
      })

      if (res.ok) {
        const { prevAction } = await res.json()
        broadcast({ type: 'prev_action_updated', payload: prevAction })
        setNewText('')
        setNewResponsible('')
        setIsAdding(false)
      }
    } catch (error) {
      console.error('Error adding prev action:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleToggleDone = async (action: PrevAction) => {
    try {
      const res = await fetch('/api/prev-actions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: action.id,
          done: !action.done,
        }),
      })

      if (res.ok) {
        const { prevAction } = await res.json()
        broadcast({ type: 'prev_action_updated', payload: prevAction })
      }
    } catch (error) {
      console.error('Error updating prev action:', error)
    }
  }

  const handleDelete = async (actionId: string) => {
    try {
      await fetch(`/api/prev-actions?id=${actionId}`, {
        method: 'DELETE',
      })
      // Broadcast will be handled by realtime subscription
    } catch (error) {
      console.error('Error deleting prev action:', error)
    }
  }

  const completedCount = prevActions.filter(a => a.done).length

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-card rounded-lg shadow-xl max-w-lg w-full max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-muted-foreground" />
            <h2 className="font-semibold">Ações da Sprint Anterior</h2>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {prevActions.length === 0 && !isAdding ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Nenhuma ação anterior cadastrada
            </p>
          ) : (
            prevActions.map((action) => (
              <Card key={action.id} className={action.done ? 'opacity-60' : ''}>
                <CardContent className="p-3">
                  <div className="flex items-start gap-3">
                    <Checkbox
                      checked={action.done}
                      onCheckedChange={() => handleToggleDone(action)}
                      className="mt-0.5"
                    />
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm ${action.done ? 'line-through' : ''}`}>
                        {action.text}
                      </p>
                      {action.responsible && (
                        <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                          <User className="w-3 h-3" />
                          <span>{action.responsible}</span>
                        </div>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                      onClick={() => handleDelete(action.id)}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}

          {/* Add Form */}
          {isAdding && (
            <Card className="border-dashed">
              <CardContent className="p-3 space-y-2">
                <Input
                  placeholder="Descreva a ação da sprint anterior..."
                  value={newText}
                  onChange={(e) => setNewText(e.target.value)}
                  autoFocus
                />
                <Input
                  placeholder="Responsável (opcional)"
                  value={newResponsible}
                  onChange={(e) => setNewResponsible(e.target.value)}
                />
                <div className="flex justify-end gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setIsAdding(false)
                      setNewText('')
                      setNewResponsible('')
                    }}
                  >
                    Cancelar
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleAddPrevAction}
                    disabled={!newText.trim() || isSubmitting}
                  >
                    Adicionar
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            {completedCount} de {prevActions.length} concluídas
          </span>
          {!isAdding && (
            <Button variant="outline" size="sm" onClick={() => setIsAdding(true)}>
              <Plus className="w-4 h-4 mr-1" />
              Adicionar
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
