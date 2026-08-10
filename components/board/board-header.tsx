'use client'

import { useState } from 'react'
import { useTheme } from 'next-themes'
import { Button } from '@/components/ui/button'
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu'
import { 
  Copy, 
  Check, 
  Users, 
  Clock, 
  Sparkles, 
  MoreHorizontal,
  Home,
  StopCircle,
  Moon,
  Sun,
  Pencil
} from 'lucide-react'
import Link from 'next/link'

type BoardHeaderProps = {
  token: string
  participantsCount: number
  isConnected: boolean
  isSyncing: boolean
  isDrawing: boolean
  onToggleDrawing: () => void
  onShowPrevActions: () => void
  onShowAI: () => void
  onCloseRetro: () => void
}

export function BoardHeader({
  token,
  participantsCount,
  isConnected,
  isSyncing,
  isDrawing,
  onToggleDrawing,
  onShowPrevActions,
  onShowAI,
  onCloseRetro,
}: BoardHeaderProps) {
  const [copied, setCopied] = useState(false)
  const { theme, setTheme } = useTheme()

  const copyLink = async () => {
    const url = `${window.location.origin}/board/${token}`
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <header className="border-b border-border bg-card px-4 py-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
            <Home className="w-4 h-4" />
          </Link>
          
          <div className="flex items-center gap-2">
            <div className="flex gap-1">
              <div className="w-2 h-2 rounded-sm bg-column-good" />
              <div className="w-2 h-2 rounded-sm bg-column-bad" />
              <div className="w-2 h-2 rounded-sm bg-column-ideas" />
              <div className="w-2 h-2 rounded-sm bg-column-actions" />
            </div>
            <span className="font-semibold text-foreground">Retro Board</span>
          </div>

          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-md bg-muted">
            <span className="text-sm font-mono font-medium tracking-wider">{token}</span>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={copyLink}
            >
              {copied ? (
                <Check className="w-3 h-3 text-green-600" />
              ) : (
                <Copy className="w-3 h-3" />
              )}
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Syncing indicator */}
          {isSyncing && (
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
              <span className="hidden sm:inline text-xs">Salvando...</span>
            </div>
          )}

          {/* Connection status */}
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-yellow-500'}`} />
            <span className="hidden sm:inline">{isConnected ? 'Conectado' : 'Conectando...'}</span>
          </div>

          {/* Participants count */}
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Users className="w-4 h-4" />
            <span>{participantsCount}</span>
          </div>

          {/* Modo desenho */}
          <Button
            variant={isDrawing ? 'default' : 'ghost'}
            size="sm"
            className="h-8 w-8 p-0"
            onClick={onToggleDrawing}
            title={isDrawing ? 'Sair do modo desenho (Esc)' : 'Rabiscar o board'}
            aria-pressed={isDrawing}
          >
            <Pencil className="w-4 h-4" />
            <span className="sr-only">Modo desenho</span>
          </Button>

          {/* Theme toggle */}
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          >
            <Sun className="w-4 h-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute w-4 h-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            <span className="sr-only">Alternar tema</span>
          </Button>

          {/* Actions dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <MoreHorizontal className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onShowPrevActions}>
                <Clock className="w-4 h-4 mr-2" />
                Ações Anteriores
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onShowAI}>
                <Sparkles className="w-4 h-4 mr-2" />
                Gerar Ações com IA
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onCloseRetro} className="text-destructive focus:text-destructive">
                <StopCircle className="w-4 h-4 mr-2" />
                Encerrar Retro
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  )
}
