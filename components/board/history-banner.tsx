'use client'

import { formatDateBrasilia } from '@/lib/snapshot-utils'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'

interface HistoryBannerProps {
  date: Date
  onExit: () => void
}

export function HistoryBanner({ date, onExit }: HistoryBannerProps) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const isoDate = `${year}-${month}-${day}`
  const formattedDate = formatDateBrasilia(isoDate)

  return (
    <div className="sticky top-0 z-50 flex items-center justify-between gap-3 rounded-lg bg-amber-100 dark:bg-amber-900/50 border border-amber-300 dark:border-amber-700 px-4 py-3 text-amber-900 dark:text-amber-100 shadow-sm">
      <div className="flex items-center gap-2 text-sm font-medium">
        <span>📅</span>
        <span>
          Visualizando snapshot de <strong>{formattedDate}</strong> — Alterações serão salvas neste dia histórico
        </span>
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={onExit}
        className="shrink-0 border-amber-400 hover:bg-amber-200 dark:border-amber-600 dark:hover:bg-amber-800"
      >
        <ArrowLeft className="mr-1 h-4 w-4" />
        Voltar ao board atual
      </Button>
    </div>
  )
}
