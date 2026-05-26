'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { X, Sparkles, Check, X as XIcon, Copy, ClipboardPaste, AlertCircle } from 'lucide-react'
import type { Card as CardType, ActionCard, Suggestion, RealtimeEvent } from '@/lib/types/database'

type AIPanelProps = {
  sessionToken: string
  cards: CardType[]
  actionCards: ActionCard[]
  suggestions: Suggestion[]
  broadcast: (event: RealtimeEvent) => void
  onClose: () => void
}

export function AIPanel({
  sessionToken,
  cards,
  actionCards,
  suggestions,
  broadcast,
  onClose,
}: AIPanelProps) {
  const [step, setStep] = useState<'prompt' | 'paste'>('prompt')
  const [pastedJson, setPastedJson] = useState('')
  const [parseError, setParseError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [promptCopied, setPromptCopied] = useState(false)

  const pendingSuggestions = suggestions.filter(s => s.status === 'pending')

  // Build the prompt from board cards (spec section 9 - step 1)
  const buildPrompt = (): string => {
    const goodCards = cards
      .filter(c => c.column_type === 'good')
      .sort((a, b) => b.votes - a.votes)
      .map(c => `- ${c.text} (${c.votes} votos)`)

    const badCards = cards
      .filter(c => c.column_type === 'bad')
      .sort((a, b) => b.votes - a.votes)
      .map(c => `- ${c.text} (${c.votes} votos)`)

    const ideasCards = cards
      .filter(c => c.column_type === 'ideas')
      .sort((a, b) => b.votes - a.votes)
      .map(c => `- ${c.text} (${c.votes} votos)`)

    const actions = actionCards
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .map(c => `- ${c.text}${c.responsible ? ` (Responsável: ${c.responsible})` : ''}`)

    return `Você é um facilitador de retrospectivas ágeis. Analise o feedback da equipe abaixo e sugira ações concretas e práticas para a próxima sprint.

## O que foi bom:
${goodCards.length > 0 ? goodCards.join('\n') : 'Nenhum item'}

## O que pode melhorar:
${badCards.length > 0 ? badCards.join('\n') : 'Nenhum item'}

## Ideias:
${ideasCards.length > 0 ? ideasCards.join('\n') : 'Nenhum item'}

## Ações já definidas:
${actions.length > 0 ? actions.join('\n') : 'Nenhuma'}

INSTRUÇÕES:
- Foque principalmente nos itens com mais votos
- Cada ação deve ser específica, mensurável e alcançável em uma sprint
- Se possível, sugira um responsável (ex: "Tech Lead", "Time", "PO")
- Responda EXCLUSIVAMENTE com um JSON válido no formato abaixo, sem texto adicional, sem markdown, sem explicações

FORMATO DE RESPOSTA (JSON array):
[
  {"id": "1", "text": "Descrição da ação", "responsible": "Responsável ou null"},
  {"id": "2", "text": "Descrição da ação", "responsible": null}
]`
  }

  const handleCopyPrompt = async () => {
    const prompt = buildPrompt()
    await navigator.clipboard.writeText(prompt)
    setPromptCopied(true)
    setTimeout(() => setPromptCopied(false), 2000)
  }

  // Step 3 — Paste and validate JSON from external AI
  const handlePasteJson = async () => {
    if (!pastedJson.trim() || isSubmitting) return

    setParseError('')
    setIsSubmitting(true)

    try {
      // Validate JSON format
      let parsed: unknown
      try {
        parsed = JSON.parse(pastedJson.trim())
      } catch {
        setParseError('JSON inválido. Cole exatamente o retorno da IA sem modificações.')
        setIsSubmitting(false)
        return
      }

      // Validate structure
      if (!Array.isArray(parsed)) {
        setParseError('O JSON deve ser um array de objetos.')
        setIsSubmitting(false)
        return
      }

      const suggestions = parsed as { id?: string; text?: string; responsible?: string | null }[]
      
      for (const item of suggestions) {
        if (!item.text || typeof item.text !== 'string') {
          setParseError('Cada item deve ter um campo "text" com uma string.')
          setIsSubmitting(false)
          return
        }
      }

      // Send validated suggestions to server
      const res = await fetch('/api/ai/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_token: sessionToken,
          suggestions: suggestions.map(s => ({
            text: s.text,
            responsible: s.responsible || null,
          })),
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        setParseError(data.error === 'invalid_ai_payload' 
          ? 'Formato JSON inválido. Verifique o retorno da IA.' 
          : 'Erro ao processar sugestões.')
        setIsSubmitting(false)
        return
      }

      const { suggestions: newSuggestions } = await res.json()
      newSuggestions.forEach((s: Suggestion) => {
        broadcast({ type: 'suggestion_added', payload: s })
      })
      setPastedJson('')
      setStep('prompt')
    } catch (error) {
      console.error('Error pasting suggestions:', error)
      setParseError('Erro ao processar sugestões.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleApproveSuggestion = async (suggestion: Suggestion) => {
    try {
      const res = await fetch('/api/suggestions/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          suggestion_id: suggestion.id,
          session_token: sessionToken,
        }),
      })

      if (res.ok) {
        const { suggestion: updated, action } = await res.json()
        broadcast({ type: 'suggestion_updated', payload: updated })
        broadcast({ type: 'action_added', payload: action })
      }
    } catch (error) {
      console.error('Error approving suggestion:', error)
    }
  }

  const handleRejectSuggestion = async (suggestionId: string) => {
    try {
      const res = await fetch('/api/suggestions/reject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ suggestion_id: suggestionId }),
      })

      if (res.ok) {
        const { suggestion: updated } = await res.json()
        broadcast({ type: 'suggestion_updated', payload: updated })
      }
    } catch (error) {
      console.error('Error rejecting suggestion:', error)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-card rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            <h2 className="font-semibold">Sugestões via IA Externa</h2>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Step 1 - Generate and copy prompt */}
          {step === 'prompt' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <h3 className="font-medium text-sm">Passo 1 — Copiar prompt</h3>
                <p className="text-sm text-muted-foreground">
                  Copie o prompt abaixo e cole em qualquer ferramenta de IA (ChatGPT, Claude, Gemini, etc.)
                </p>
              </div>

              <div className="bg-muted rounded-md p-3 max-h-[200px] overflow-y-auto">
                <pre className="text-xs whitespace-pre-wrap font-mono">{buildPrompt()}</pre>
              </div>

              <div className="flex gap-2">
                <Button onClick={handleCopyPrompt} className="flex-1">
                  {promptCopied ? (
                    <>
                      <Check className="w-4 h-4 mr-2" />
                      Copiado!
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4 mr-2" />
                      Copiar Prompt
                    </>
                  )}
                </Button>
                <Button variant="secondary" onClick={() => setStep('paste')}>
                  <ClipboardPaste className="w-4 h-4 mr-2" />
                  Colar Retorno
                </Button>
              </div>
            </div>
          )}

          {/* Step 3 - Paste JSON response */}
          {step === 'paste' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <h3 className="font-medium text-sm">Passo 2 — Colar retorno da IA</h3>
                <p className="text-sm text-muted-foreground">
                  Cole aqui o JSON retornado pela IA externa. O formato esperado é um array de objetos com &quot;id&quot;, &quot;text&quot; e &quot;responsible&quot;.
                </p>
              </div>

              <Textarea
                placeholder={'[\n  {"id": "1", "text": "Ação sugerida", "responsible": "Time"},\n  {"id": "2", "text": "Outra ação", "responsible": null}\n]'}
                value={pastedJson}
                onChange={(e) => {
                  setPastedJson(e.target.value)
                  setParseError('')
                }}
                className="min-h-[150px] font-mono text-sm"
              />

              {parseError && (
                <div className="flex items-start gap-2 text-sm text-destructive">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>{parseError}</span>
                </div>
              )}

              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep('prompt')}>
                  Voltar
                </Button>
                <Button
                  onClick={handlePasteJson}
                  disabled={!pastedJson.trim() || isSubmitting}
                  className="flex-1"
                >
                  <ClipboardPaste className="w-4 h-4 mr-2" />
                  Confirmar
                </Button>
              </div>
            </div>
          )}

          {/* Pending Suggestions (Step 4 - Approve/Reject) */}
          {pendingSuggestions.length > 0 && (
            <div className="mt-6 space-y-3 border-t border-border pt-4">
              <h3 className="font-medium text-sm">Sugestões Pendentes ({pendingSuggestions.length})</h3>
              {pendingSuggestions.map((suggestion) => (
                <Card key={suggestion.id}>
                  <CardContent className="p-3">
                    <p className="text-sm">{suggestion.text}</p>
                    {suggestion.responsible && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Responsável: {suggestion.responsible}
                      </p>
                    )}
                    <div className="flex justify-end gap-2 mt-3">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleRejectSuggestion(suggestion.id)}
                      >
                        <XIcon className="w-4 h-4 mr-1" />
                        Rejeitar
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleApproveSuggestion(suggestion)}
                      >
                        <Check className="w-4 h-4 mr-1" />
                        Aprovar
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
