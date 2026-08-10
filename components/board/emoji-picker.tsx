'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Input } from '@/components/ui/input'
import {
  EMOJI_CATEGORIES,
  DEFAULT_RECENT_EMOJIS,
  MAX_RECENT_EMOJIS,
  RECENT_EMOJIS_STORAGE_KEY,
  searchEmojis,
  isEmoji,
  type EmojiEntry,
} from '@/lib/emoji'
import { cn } from '@/lib/utils'

function readRecentEmojis(): string[] {
  if (typeof window === 'undefined') return [...DEFAULT_RECENT_EMOJIS]

  try {
    const raw = window.localStorage.getItem(RECENT_EMOJIS_STORAGE_KEY)
    if (!raw) return [...DEFAULT_RECENT_EMOJIS]
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return [...DEFAULT_RECENT_EMOJIS]
    const valid = parsed.filter(isEmoji).slice(0, MAX_RECENT_EMOJIS)
    return valid.length > 0 ? valid : [...DEFAULT_RECENT_EMOJIS]
  } catch {
    return [...DEFAULT_RECENT_EMOJIS]
  }
}

/** Registra o emoji escolhido no topo dos usados recentemente. */
export function rememberEmoji(emoji: string) {
  if (typeof window === 'undefined' || !isEmoji(emoji)) return

  try {
    const next = [emoji, ...readRecentEmojis().filter((e) => e !== emoji)].slice(
      0,
      MAX_RECENT_EMOJIS
    )
    window.localStorage.setItem(RECENT_EMOJIS_STORAGE_KEY, JSON.stringify(next))
  } catch {
    // localStorage indisponível — recentes simplesmente não persistem.
  }
}

type EmojiPickerProps = {
  /** Emojis já usados pelo participante neste card, para destacar na grade. */
  selected?: string[]
  onSelect: (emoji: string) => void
}

export function EmojiPicker({ selected = [], onSelect }: EmojiPickerProps) {
  const [query, setQuery] = useState('')
  const [activeCategory, setActiveCategory] = useState(EMOJI_CATEGORIES[0].id)
  const [recent, setRecent] = useState<string[]>([])
  const listRef = useRef<HTMLDivElement>(null)

  // localStorage só existe no cliente — carrega após a montagem.
  useEffect(() => {
    setRecent(readRecentEmojis())
  }, [])

  const results = useMemo(() => searchEmojis(query), [query])
  const isSearching = query.trim().length > 0

  const category =
    EMOJI_CATEGORIES.find((c) => c.id === activeCategory) ?? EMOJI_CATEGORIES[0]

  const handleSelect = (emoji: string) => {
    rememberEmoji(emoji)
    onSelect(emoji)
  }

  const renderGrid = (entries: readonly EmojiEntry[] | string[], keyPrefix: string) => (
    <div className="grid grid-cols-8 gap-0.5">
      {entries.map((entry) => {
        const emoji = typeof entry === 'string' ? entry : entry[0]
        const title = typeof entry === 'string' ? emoji : entry[1].split(' ')[0]
        return (
          <button
            key={`${keyPrefix}-${emoji}`}
            type="button"
            title={title}
            onClick={() => handleSelect(emoji)}
            className={cn(
              'flex h-7 w-7 items-center justify-center rounded text-lg leading-none transition-transform hover:scale-125 hover:bg-muted',
              selected.includes(emoji) && 'bg-primary/15'
            )}
          >
            {emoji}
          </button>
        )
      })}
    </div>
  )

  return (
    <div className="w-[272px]">
      <div className="p-2 pb-1">
        <Input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            listRef.current?.scrollTo({ top: 0 })
          }}
          placeholder="Buscar emoji"
          className="h-7 text-xs"
          autoFocus
        />
      </div>

      {!isSearching && (
        <div className="flex items-center gap-0.5 border-b border-border px-2 pb-1">
          {EMOJI_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              type="button"
              title={cat.label}
              onClick={() => {
                setActiveCategory(cat.id)
                listRef.current?.scrollTo({ top: 0 })
              }}
              className={cn(
                'flex h-6 w-6 items-center justify-center rounded text-sm leading-none transition-colors hover:bg-muted',
                cat.id === activeCategory && 'bg-muted ring-1 ring-primary/40'
              )}
            >
              {cat.icon}
            </button>
          ))}
        </div>
      )}

      <div
        ref={listRef}
        className="max-h-[196px] overflow-y-auto p-2 scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent"
      >
        {isSearching ? (
          results.length > 0 ? (
            renderGrid(results, 'search')
          ) : (
            <p className="py-6 text-center text-xs text-muted-foreground">
              Nenhum emoji encontrado
            </p>
          )
        ) : (
          <div className="space-y-2">
            {recent.length > 0 && (
              <div className="space-y-1">
                <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  Usados recentemente
                </p>
                {renderGrid(recent, 'recent')}
              </div>
            )}
            <div className="space-y-1">
              <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                {category.label}
              </p>
              {renderGrid(category.emojis, category.id)}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
