'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { useParticipant } from '@/hooks/use-participant'
import { Users, Plus, ArrowRight, RefreshCcw } from 'lucide-react'

export default function HomePage() {
  const router = useRouter()
  const { participantName, updateName, isReady } = useParticipant()
  
  const [name, setName] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [isJoining, setIsJoining] = useState(false)
  const [error, setError] = useState('')

  // Sync local state with stored name when ready
  useEffect(() => {
    if (isReady && participantName) {
      setName(participantName)
    }
  }, [isReady, participantName])

  const handleCreateSession = async () => {
    if (!name.trim()) {
      setError('Por favor, insira seu nome')
      return
    }

    setIsCreating(true)
    setError('')

    try {
      updateName(name.trim())
      
      const res = await fetch('/api/sessions', { method: 'POST' })
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Falha ao criar sessão')
      }

      router.push(`/board/${data.session.token}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao criar sessão')
    } finally {
      setIsCreating(false)
    }
  }

  const handleJoinSession = async () => {
    if (!name.trim()) {
      setError('Por favor, insira seu nome')
      return
    }

    if (!joinCode.trim()) {
      setError('Por favor, insira o código da sessão')
      return
    }

    setIsJoining(true)
    setError('')

    try {
      updateName(name.trim())
      
      const code = joinCode.toUpperCase().replace(/[^A-Z0-9]/g, '')
      const res = await fetch(`/api/sessions?token=${code}`)
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Sessão não encontrada')
      }

      router.push(`/board/${data.session.token}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao entrar na sessão')
    } finally {
      setIsJoining(false)
    }
  }

  const handleCodeInput = (value: string) => {
    // Only allow alphanumeric, max 6 chars
    const cleaned = value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6)
    setJoinCode(cleaned)
    setError('')
  }

  if (!isReady) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-background">
        <RefreshCcw className="w-8 h-8 animate-spin text-muted-foreground" />
      </main>
    )
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="flex gap-1">
              <div className="w-3 h-3 rounded-sm bg-column-good" />
              <div className="w-3 h-3 rounded-sm bg-column-bad" />
              <div className="w-3 h-3 rounded-sm bg-column-ideas" />
              <div className="w-3 h-3 rounded-sm bg-column-actions" />
            </div>
            <h1 className="text-3xl font-bold text-foreground">Retro Board</h1>
          </div>
          <p className="text-muted-foreground">
            Ferramenta de retrospectiva colaborativa para equipes ágeis
          </p>
        </div>

        <Card className="shadow-lg border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <Users className="w-5 h-5" />
              Entrar na Retrospectiva
            </CardTitle>
            <CardDescription>
              Crie uma nova sessão ou entre em uma existente
            </CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-6">
            {/* Name Input */}
            <div className="space-y-2">
              <Label htmlFor="name">Seu nome</Label>
              <Input
                id="name"
                placeholder="Digite seu nome"
                value={name}
                onChange={(e) => {
                  setName(e.target.value.slice(0, 20))
                  setError('')
                }}
                maxLength={20}
                className="text-base"
              />
            </div>

            {error && (
              <p className="text-sm text-destructive font-medium">{error}</p>
            )}

            {/* Create Session */}
            <div className="space-y-3">
              <Button 
                onClick={handleCreateSession} 
                disabled={isCreating || isJoining}
                className="w-full"
                size="lg"
              >
                {isCreating ? (
                  <RefreshCcw className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Plus className="w-4 h-4 mr-2" />
                )}
                Criar Nova Sessão
              </Button>
            </div>

            <div className="relative">
              <Separator />
              <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-3 text-sm text-muted-foreground">
                ou
              </span>
            </div>

            {/* Join Session */}
            <div className="space-y-3">
              <Label htmlFor="code">Código da sessão</Label>
              <div className="flex gap-2">
                <Input
                  id="code"
                  placeholder="ABC123"
                  value={joinCode}
                  onChange={(e) => handleCodeInput(e.target.value)}
                  className="text-base font-mono tracking-widest text-center uppercase"
                  maxLength={6}
                />
                <Button 
                  onClick={handleJoinSession}
                  disabled={isCreating || isJoining || joinCode.length < 6}
                  size="lg"
                  variant="secondary"
                >
                  {isJoining ? (
                    <RefreshCcw className="w-4 h-4 animate-spin" />
                  ) : (
                    <ArrowRight className="w-4 h-4" />
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Insira o código de 6 caracteres compartilhado pelo facilitador
              </p>
            </div>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground mt-6">
          Os dados da sessão são compartilhados em tempo real entre todos os participantes
        </p>
      </div>
    </main>
  )
}
