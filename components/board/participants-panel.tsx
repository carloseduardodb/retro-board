'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Users, Circle, Pencil, Check } from 'lucide-react'
import type { Participant } from '@/lib/types/database'

type ParticipantsPanelProps = {
  participants: Participant[]
  currentParticipantId: string
  onRename: (newName: string) => void
}

export function ParticipantsPanel({ participants, currentParticipantId, onRename }: ParticipantsPanelProps) {
  const [editingName, setEditingName] = useState(false)
  const [nameValue, setNameValue] = useState('')

  const startEditing = (currentName: string) => {
    setNameValue(currentName)
    setEditingName(true)
  }

  const confirmEdit = () => {
    const trimmed = nameValue.trim()
    if (trimmed) {
      onRename(trimmed)
    }
    setEditingName(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') confirmEdit()
    if (e.key === 'Escape') setEditingName(false)
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Users className="w-4 h-4" />
          Participantes ({participants.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        {participants.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum participante conectado</p>
        ) : (
          <ul className="space-y-2">
            {participants.map((participant) => {
              const isMe = participant.id === currentParticipantId
              return (
                <li key={participant.id} className="flex items-center gap-2">
                  <Circle className="w-2 h-2 fill-green-500 text-green-500 shrink-0" />
                  {isMe && editingName ? (
                    <div className="flex items-center gap-1 flex-1 min-w-0">
                      <Input
                        value={nameValue}
                        onChange={(e) => setNameValue(e.target.value.slice(0, 20))}
                        onKeyDown={handleKeyDown}
                        onBlur={confirmEdit}
                        maxLength={20}
                        autoFocus
                        className="h-6 text-sm px-1 py-0"
                      />
                      <button onClick={confirmEdit} className="text-muted-foreground hover:text-foreground shrink-0">
                        <Check className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 flex-1 min-w-0">
                      <span className="text-sm truncate">{participant.name}{isMe ? ' (você)' : ''}</span>
                      {isMe && (
                        <button onClick={() => startEditing(participant.name)} className="text-muted-foreground hover:text-foreground shrink-0">
                          <Pencil className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
