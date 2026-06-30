'use client'

import { useState, useEffect, useCallback } from 'react'
import { Calendar } from '@/components/ui/calendar'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ptBR } from 'date-fns/locale'
import { parseISO, isSameDay } from 'date-fns'
import { CalendarDays, ArrowLeft, Loader2, RefreshCw } from 'lucide-react'

interface HistoryCalendarProps {
  sessionToken: string
  onSelectDate: (date: Date) => void
  onExitHistory: () => void
  isHistoryMode: boolean
  selectedDate: Date | null
}

export function HistoryCalendar({
  sessionToken,
  onSelectDate,
  onExitHistory,
  isHistoryMode,
  selectedDate,
}: HistoryCalendarProps) {
  const [snapshotDates, setSnapshotDates] = useState<Date[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchDates = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch(
        `/api/snapshots/dates?session_token=${encodeURIComponent(sessionToken)}`
      )

      if (!response.ok) {
        throw new Error('Falha ao carregar datas disponíveis')
      }

      const data = await response.json()
      const dates = (data.dates as string[]).map((d) => parseISO(d))
      setSnapshotDates(dates)
    } catch {
      setError('Não foi possível carregar o histórico')
    } finally {
      setLoading(false)
    }
  }, [sessionToken])

  useEffect(() => {
    fetchDates()
  }, [fetchDates])

  const today = new Date()

  const disabledMatcher = (day: Date) => {
    return !snapshotDates.some((snapshotDate) => isSameDay(snapshotDate, day))
  }

  const handleSelect = (date: Date | undefined) => {
    if (date) {
      onSelectDate(date)
    }
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <CalendarDays className="w-4 h-4" />
          Histórico
        </CardTitle>
      </CardHeader>
      <CardContent className="px-2 pb-3">
        {loading && (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            <span className="ml-2 text-sm text-muted-foreground">
              Carregando...
            </span>
          </div>
        )}

        {error && (
          <div className="flex flex-col items-center gap-2 py-4">
            <p className="text-sm text-destructive text-center">{error}</p>
            <Button variant="outline" size="sm" onClick={fetchDates}>
              <RefreshCw className="w-3 h-3" />
              Tentar novamente
            </Button>
          </div>
        )}

        {!loading && !error && (
          <>
            {snapshotDates.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Nenhum histórico disponível
              </p>
            ) : (
              <Calendar
                mode="single"
                selected={selectedDate ?? undefined}
                onSelect={handleSelect}
                locale={ptBR}
                modifiers={{ hasSnapshot: snapshotDates }}
                modifiersClassNames={{
                  hasSnapshot: 'has-snapshot-dot',
                }}
                disabled={disabledMatcher}
                toMonth={today}
                className="w-full [&_button:not(:disabled)]:cursor-pointer [&_button:disabled]:cursor-not-allowed"
              />
            )}

            {isHistoryMode && (
              <Button
                variant="outline"
                size="sm"
                className="w-full mt-3"
                onClick={onExitHistory}
              >
                <ArrowLeft className="w-3 h-3" />
                Voltar ao board atual
              </Button>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
