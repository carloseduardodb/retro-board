'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Users, Circle } from 'lucide-react'
import type { Participant } from '@/lib/types/database'

type ParticipantsPanelProps = {
  participants: Participant[]
}

export function ParticipantsPanel({ participants }: ParticipantsPanelProps) {
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
            {participants.map((participant) => (
              <li key={participant.id} className="flex items-center gap-2">
                <Circle className="w-2 h-2 fill-green-500 text-green-500" />
                <span className="text-sm truncate">{participant.name}</span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
