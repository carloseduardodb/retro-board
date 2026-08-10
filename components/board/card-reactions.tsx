'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { SmilePlus } from 'lucide-react'
import { EmojiPicker, rememberEmoji } from '@/components/board/emoji-picker'
import type { Reactions } from '@/lib/types/database'
import { cn } from '@/lib/utils'

type CardReactionsProps = {
  reactions: Reactions
  participantId: string
  disabled?: boolean
  onToggle: (emoji: string) => void
}

export function CardReactions({ reactions, participantId, disabled, onToggle }: CardReactionsProps) {
  const [open, setOpen] = useState(false)

  // Ordena por quantidade de reações (desc) para o card não "dançar" a cada update.
  const active = Object.entries(reactions)
    .filter(([, voters]) => (voters?.length ?? 0) > 0)
    .sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]))

  const mine = active.filter(([, voters]) => voters.includes(participantId)).map(([emoji]) => emoji)

  const handlePick = (emoji: string) => {
    onToggle(emoji)
    setOpen(false)
  }

  return (
    <div className="flex flex-wrap items-center gap-1">
      {active.map(([emoji, voters]) => {
        const reacted = voters.includes(participantId)
        return (
          <button
            key={emoji}
            type="button"
            disabled={disabled}
            onClick={() => {
              rememberEmoji(emoji)
              onToggle(emoji)
            }}
            title={`${voters.length} ${voters.length === 1 ? 'reação' : 'reações'}`}
            className={cn(
              'flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-xs transition-colors',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              reacted
                ? 'border-primary/50 bg-primary/10 text-foreground'
                : 'border-border bg-muted/50 text-muted-foreground hover:bg-muted'
            )}
          >
            <span className="leading-none">{emoji}</span>
            <span className="leading-none tabular-nums">{voters.length}</span>
          </button>
        )
      })}

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            disabled={disabled}
            className={cn(
              'h-6 w-6 p-0 text-muted-foreground transition-opacity',
              active.length === 0 && 'opacity-0 group-hover:opacity-100'
            )}
            aria-label="Reagir"
          >
            <SmilePlus className="h-3.5 w-3.5" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto p-0">
          <EmojiPicker selected={mine} onSelect={handlePick} />
        </PopoverContent>
      </Popover>
    </div>
  )
}
