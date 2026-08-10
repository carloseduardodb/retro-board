'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { Plus, Trash2, X, Send, Pencil, Check } from 'lucide-react'
import type { ActionCard, RealtimeEvent } from '@/lib/types/database'
import { cn } from '@/lib/utils'

type ActionsColumnProps = {
  actionCards: ActionCard[]
  sessionToken: string
  participantId: string
  participantName: string
  readOnly?: boolean
  broadcast: (event: RealtimeEvent) => void
  trackOperation: <T>(op: () => Promise<T>) => Promise<T>
}

export function ActionsColumn({
  actionCards,
  sessionToken,
  participantId,
  participantName,
  readOnly = false,
  broadcast,
  trackOperation,
}: ActionsColumnProps) {
  const [isAdding, setIsAdding] = useState(false)
  const [newText, setNewText] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleAddAction = async () => {
    if (!newText.trim() || isSubmitting) return

    const text = newText.trim()
    setIsSubmitting(true)
    setNewText('')
    setIsAdding(false)

    // Optimistic
    const tempId = `temp-${Date.now()}`
    const optimisticAction: ActionCard = {
      id: tempId,
      session_token: sessionToken,
      text,
      responsible: null,
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

  const handleEdit = async (action: ActionCard, text: string) => {
    // Optimistic
    broadcast({ type: 'action_updated', payload: { ...action, text } })

    try {
      await trackOperation(async () => {
        const res = await fetch('/api/actions', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: action.id, text }),
        })

        if (res.ok) {
          const { action: serverAction } = await res.json()
          broadcast({ type: 'action_updated', payload: serverAction })
        } else {
          broadcast({ type: 'action_updated', payload: action })
        }
      })
    } catch (error) {
      console.error('Error editing action:', error)
      broadcast({ type: 'action_updated', payload: action })
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

  // Ordenação por created_at decrescente (spec seção 6)
  const sortedActions = [...actionCards].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )

  return (
    <div
      data-testid="column-actions"
      className={cn('rounded-lg border flex flex-col min-h-0 bg-column-actions/30 border-column-actions/50')}
    >
      {/* Header */}
      <div className="px-4 py-3 rounded-t-lg font-medium bg-column-actions text-column-actions-foreground">
        <div className="flex items-center justify-between">
          <span>Ações</span>
          <span className="text-sm opacity-75">{actionCards.length}</span>
        </div>
      </div>

      {/* Add Action Form - fixed at top */}
      {!readOnly && (
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
      )}

      {/* Actions List */}
      <div className="flex-1 p-2 space-y-2 overflow-y-auto scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent">
        {sortedActions.map((action) => (
          <ActionCardItem
            key={action.id}
            action={action}
            readOnly={readOnly}
            onEdit={(text) => handleEdit(action, text)}
            onDelete={() => handleDelete(action.id)}
          />
        ))}
      </div>
    </div>
  )
}

type ActionCardItemProps = {
  action: ActionCard
  readOnly: boolean
  onEdit: (text: string) => void
  onDelete: () => void
}

function ActionCardItem({ action, readOnly, onEdit, onDelete }: ActionCardItemProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editText, setEditText] = useState(action.text)

  const handleSave = () => {
    const text = editText.trim()
    if (text && text !== action.text) {
      onEdit(text)
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
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setIsEditing(false)
                  setEditText(action.text)
                }}
              >
                <X className="w-4 h-4" />
              </Button>
              <Button size="sm" onClick={handleSave} disabled={!editText.trim()}>
                <Check className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="group" data-action-id={action.id}>
      <CardContent className="p-3">
        <p className="text-sm whitespace-pre-wrap break-words">{action.text}</p>
        {!readOnly && (
          <div className="flex items-center justify-end gap-1 mt-2 pt-2 border-t border-border/50">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
              title="Editar ação"
              onClick={() => {
                setEditText(action.text)
                setIsEditing(true)
              }}
            >
              <Pencil className="w-3 h-3" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive"
              title="Excluir ação"
              onClick={onDelete}
            >
              <Trash2 className="w-3 h-3" />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
