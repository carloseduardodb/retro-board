'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Plus, ArrowRight, RefreshCcw, Users } from 'lucide-react'

/** Criar ou entrar numa sessão. É o CTA do hero da landing. */
export function SessionForm() {
  const router = useRouter()

  const [joinCode, setJoinCode] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [isJoining, setIsJoining] = useState(false)
  const [error, setError] = useState('')

  const handleCreateSession = async () => {
    setIsCreating(true)
    setError('')

    try {
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
    if (!joinCode.trim()) {
      setError('Por favor, insira o código da sessão')
      return
    }

    setIsJoining(true)
    setError('')

    try {
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
    const cleaned = value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6)
    setJoinCode(cleaned)
    setError('')
  }

  return (
    <Card className="shadow-lg border-border/50">
      <CardContent className="pt-6">
        {error && <p className="text-sm text-destructive font-medium mb-4">{error}</p>}

        <Tabs defaultValue="create" className="w-full">
          <TabsList className="w-full mb-4">
            <TabsTrigger value="create" className="flex-1">
              <Plus className="w-4 h-4 mr-2" />
              Nova Sessão
            </TabsTrigger>
            <TabsTrigger value="join" className="flex-1">
              <Users className="w-4 h-4 mr-2" />
              Entrar
            </TabsTrigger>
          </TabsList>

          <TabsContent value="create" className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Crie uma nova retrospectiva e compartilhe o código com seu time.
            </p>
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
              Criar Sessão
            </Button>
          </TabsContent>

          <TabsContent value="join" className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Insira o código de 6 caracteres compartilhado pelo facilitador.
            </p>
            <Input
              placeholder="ABC123"
              value={joinCode}
              onChange={(e) => handleCodeInput(e.target.value)}
              className="text-base font-mono tracking-widest text-center uppercase"
              maxLength={6}
            />
            <Button
              onClick={handleJoinSession}
              disabled={isCreating || isJoining || joinCode.length < 6}
              className="w-full"
              size="lg"
              variant="secondary"
            >
              {isJoining ? (
                <RefreshCcw className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <ArrowRight className="w-4 h-4 mr-2" />
              )}
              Entrar na Sessão
            </Button>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}
