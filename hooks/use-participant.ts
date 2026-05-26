'use client'

import { useCallback, useEffect, useState } from 'react'

const PARTICIPANT_ID_KEY = 'retro_participant_id'
const PARTICIPANT_NAME_KEY = 'retro_participant_name'

function generateUUID(): string {
  return crypto.randomUUID()
}

export function useParticipant() {
  const [participantId, setParticipantId] = useState<string>('')
  const [participantName, setParticipantName] = useState<string>('')
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    // Get or create participant ID
    let id = localStorage.getItem(PARTICIPANT_ID_KEY)
    if (!id) {
      id = generateUUID()
      localStorage.setItem(PARTICIPANT_ID_KEY, id)
    }
    setParticipantId(id)

    // Get stored name
    const name = localStorage.getItem(PARTICIPANT_NAME_KEY) || ''
    setParticipantName(name)
    setIsReady(true)
  }, [])

  const updateName = useCallback((name: string) => {
    setParticipantName(name)
    localStorage.setItem(PARTICIPANT_NAME_KEY, name)
  }, [])

  return {
    participantId,
    participantName,
    updateName,
    isReady,
  }
}
