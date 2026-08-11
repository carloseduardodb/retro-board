'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Plus, Trash2, X, Send, Pencil, Check, UserRound } from 'lucide-react'
import type { ActionCard, Participant, RealtimeEvent } from '@/lib/types/database'
import { cn } from '@/lib/utils'

type ActionsColumnProps = {
  actionCards: ActionCard[]
  sessionToken: string
  participantId: string
  participantName: string
  /** Quem está na sala agora — vira sugestão no campo de responsável. */
  participants: Participant[]
  readOnly?: boolean
  broadcast: (event: RealtimeEvent) => void
  trackOperation: <T>(op: () => Promise<T>) => Promise<T>
}

export function ActionsColumn({
  actionCards,
  sessionToken,
  participantId,
  participantName,
  participants,
  readOnly = false,
  broadcast,
  trackOperation,
}: ActionsColumnProps) {
  const [isAdding, setIsAdding] = useState(false)
  const [newText, setNewText] = useState('')
  const [newResponsible, setNewResponsible] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleAddAction = async () => {
    if (!newText.trim() || isSubmitting) return

    const text = newText.trim()
    const responsible = newResponsible.trim() || null
    setIsSubmitting(true)
    setNewText('')
    setNewResponsible('')
    setIsAdding(false)

    // Optimistic
    const tempId = `temp-${Date.now()}`
    const optimisticAction: ActionCard = {
      id: tempId,
      session_token: sessionToken,
      text,
      responsible,
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
            responsible,
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

  const handleEdit = async (action: ActionCard, text: string, responsible: string | null) => {
    // Optimistic
    broadcast({ type: 'action_updated', payload: { ...action, text, responsible } })

    try {
      await trackOperation(async () => {
        const res = await fetch('/api/actions', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: action.id, text, responsible, author_id: participantId }),
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
        await fetch(`/api/actions?id=${actionId}&author_id=${encodeURIComponent(participantId)}`, {
          method: 'DELETE',
        })
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
                <ResponsibleField
                  value={newResponsible}
                  onChange={setNewResponsible}
                  participants={participants}
                  listId="responsible-new"
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
                        setNewResponsible('')
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
            isOwner={action.author_id === participantId}
            participants={participants}
            onEdit={(text, responsible) => handleEdit(action, text, responsible)}
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
  /** Só quem escreveu a ação pode reescrevê-la ou apagá-la. */
  isOwner: boolean
  participants: Participant[]
  onEdit: (text: string, responsible: string | null) => void
  onDelete: () => void
}

function ActionCardItem({
  action,
  readOnly,
  isOwner,
  participants,
  onEdit,
  onDelete,
}: ActionCardItemProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editText, setEditText] = useState(action.text)
  const [editResponsible, setEditResponsible] = useState(action.responsible ?? '')

  const handleSave = () => {
    const text = editText.trim()
    const responsible = editResponsible.trim() || null
    if (text && (text !== action.text || responsible !== action.responsible)) {
      onEdit(text, responsible)
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
          <div className="mt-2">
            <ResponsibleField
              value={editResponsible}
              onChange={setEditResponsible}
              participants={participants}
              listId={`responsible-${action.id}`}
            />
          </div>
          <div className="flex justify-between items-center mt-2">
            <span className="text-xs text-muted-foreground">{editText.length}/500</span>
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setIsEditing(false)
                  setEditText(action.text)
                  setEditResponsible(action.responsible ?? '')
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

        {action.responsible && (
          <div
            className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
            title="Responsável pela ação"
          >
            <UserRound className="h-3 w-3" />
            {action.responsible}
          </div>
        )}

        {!readOnly && isOwner && (
          <div className="flex items-center justify-end gap-1 mt-2 pt-2 border-t border-border/50">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
              title="Editar ação"
              onClick={() => {
                setEditText(action.text)
                setEditResponsible(action.responsible ?? '')
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

/**
 * Responsável pela ação.
 *
 * É texto livre com sugestão de quem está na sala: quem vai tocar a ação
 * costuma estar na retro, mas nem sempre — e amarrar o campo à lista de
 * presentes impediria combinar algo com quem faltou.
 */
function ResponsibleField({
  value,
  onChange,
  participants,
  listId,
}: {
  value: string
  onChange: (value: string) => void
  participants: Participant[]
  listId: string
}) {
  const names = [...new Set(participants.map((p) => p.name).filter(Boolean))]

  return (
    <div className="flex items-center gap-2">
      <UserRound className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      <Input
        list={names.length > 0 ? listId : undefined}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Responsável (opcional)"
        maxLength={60}
        className="h-8 text-sm"
      />
      {names.length > 0 && (
        <datalist id={listId}>
          {names.map((name) => (
            <option key={name} value={name} />
          ))}
        </datalist>
      )}
    </div>
  )
}
