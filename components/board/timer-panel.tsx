'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Play, Pause, Plus, Timer, RotateCcw } from 'lucide-react'
import type { Session, RealtimeEvent } from '@/lib/types/database'

type TimerPanelProps = {
  session: Session
  sessionToken: string
  broadcast: (event: RealtimeEvent) => void
}

export function TimerPanel({ session, sessionToken, broadcast }: TimerPanelProps) {
  const [displayTime, setDisplayTime] = useState('00:00')
  const [isUpdating, setIsUpdating] = useState(false)
  const hasPlayedExpiredSound = useRef(false)
  const tickTockRef = useRef<{ audioContext: AudioContext; interval: ReturnType<typeof setInterval> } | null>(null)

  const status = session.timer_status || 'configuring'
  const minutes = session.timer_minutes || 5

  // Calculate remaining time
  const calculateRemaining = useCallback(() => {
    if (status === 'running' && session.timer_ends_at) {
      const endsAt = new Date(session.timer_ends_at).getTime()
      const now = Date.now()
      const remaining = Math.max(0, Math.floor((endsAt - now) / 1000))
      return remaining
    }
    if (status === 'paused' && session.timer_remaining_seconds !== null) {
      return session.timer_remaining_seconds
    }
    if (status === 'configuring') {
      return minutes * 60
    }
    return 0
  }, [status, session.timer_ends_at, session.timer_remaining_seconds, minutes])

  // Play tick-tock sound
  const startTickTock = useCallback(() => {
    if (tickTockRef.current) return // already playing
    try {
      const audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
      let isTick = true

      const playTick = () => {
        const oscillator = audioContext.createOscillator()
        const gainNode = audioContext.createGain()
        oscillator.connect(gainNode)
        gainNode.connect(audioContext.destination)

        // Tick = higher pitch, Tock = lower pitch
        oscillator.frequency.value = isTick ? 1200 : 800
        oscillator.type = 'sine'
        gainNode.gain.value = 0.15

        oscillator.start()
        gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.08)
        oscillator.stop(audioContext.currentTime + 0.08)

        isTick = !isTick
      }

      playTick() // play immediately
      const interval = setInterval(playTick, 500)
      tickTockRef.current = { audioContext, interval }
    } catch {
      // Browser blocked autoplay
    }
  }, [])

  const stopTickTock = useCallback(() => {
    if (tickTockRef.current) {
      clearInterval(tickTockRef.current.interval)
      tickTockRef.current.audioContext.close()
      tickTockRef.current = null
    }
  }, [])

  // Cleanup tick-tock on unmount
  useEffect(() => {
    return () => stopTickTock()
  }, [stopTickTock])

  // Play expiry sound
  const playExpirySound = useCallback(() => {
    try {
      const audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
      const oscillator = audioContext.createOscillator()
      const gainNode = audioContext.createGain()
      
      oscillator.connect(gainNode)
      gainNode.connect(audioContext.destination)
      
      oscillator.frequency.value = 800
      oscillator.type = 'sine'
      gainNode.gain.value = 0.3
      
      oscillator.start()
      
      // Beep pattern: 3 short beeps
      setTimeout(() => { gainNode.gain.value = 0 }, 200)
      setTimeout(() => { gainNode.gain.value = 0.3 }, 400)
      setTimeout(() => { gainNode.gain.value = 0 }, 600)
      setTimeout(() => { gainNode.gain.value = 0.3 }, 800)
      setTimeout(() => {
        oscillator.stop()
        audioContext.close()
      }, 1000)
    } catch {
      // Browser blocked autoplay — no fallback per spec
    }
  }, [])

  // Update display
  useEffect(() => {
    const updateDisplay = () => {
      const remaining = calculateRemaining()
      const mins = Math.floor(remaining / 60)
      const secs = remaining % 60
      setDisplayTime(`${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`)

      // Tick-tock in the last 15 seconds
      if (status === 'running' && remaining > 0 && remaining <= 15) {
        startTickTock()
      } else {
        stopTickTock()
      }

      // Check if timer just expired
      if (status === 'running' && remaining === 0) {
        stopTickTock()
        if (!hasPlayedExpiredSound.current) {
          hasPlayedExpiredSound.current = true
          playExpirySound()
        }
        handleTimerAction('finish')
      }
    }

    updateDisplay()
    const interval = setInterval(updateDisplay, 1000)
    return () => clearInterval(interval)
  }, [calculateRemaining, status, playExpirySound, startTickTock, stopTickTock])

  // Reset sound flag when timer leaves finished state
  useEffect(() => {
    if (status !== 'finished') {
      hasPlayedExpiredSound.current = false
    }
  }, [status])

  const handleTimerAction = async (action: 'start' | 'pause' | 'resume' | 'add' | 'finish' | 'set' | 'reset', actionMinutes?: number) => {
    if (isUpdating && action !== 'finish') return
    setIsUpdating(true)

    try {
      const res = await fetch('/api/timer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_token: sessionToken,
          action,
          minutes: actionMinutes,
        }),
      })

      if (res.ok) {
        const { session: updatedSession } = await res.json()
        broadcast({ type: 'timer_update', payload: updatedSession })
      }
    } catch (error) {
      console.error('Timer action error:', error)
    } finally {
      setIsUpdating(false)
    }
  }

  // Propagate minutes change to all participants in real time
  const handleMinutesChange = (value: string) => {
    const newMinutes = Math.max(1, Math.min(60, parseInt(value) || 1))
    handleTimerAction('set', newMinutes)
  }

  const isConfiguring = status === 'configuring'
  const isRunning = status === 'running'
  const isPaused = status === 'paused'
  const isFinished = status === 'finished'

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Timer className="w-4 h-4" />
          Timer
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Timer Display */}
        <div className="text-center">
          <div className={`text-4xl font-mono font-bold ${isFinished ? 'text-destructive' : ''}`}>
            {displayTime}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {isConfiguring && 'Configure o tempo'}
            {isRunning && 'Em andamento'}
            {isPaused && 'Pausado'}
            {isFinished && 'Tempo esgotado!'}
          </p>
        </div>

        {/* Minutes Input (only when configuring) */}
        {isConfiguring && (
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min={1}
              max={60}
              value={minutes}
              onChange={(e) => handleMinutesChange(e.target.value)}
              className="text-center"
            />
            <span className="text-sm text-muted-foreground">min</span>
          </div>
        )}

        {/* Controls */}
        <div className="flex gap-2">
          {isConfiguring && (
            <Button
              onClick={() => handleTimerAction('start', minutes)}
              disabled={isUpdating}
              className="flex-1"
              size="sm"
            >
              <Play className="w-4 h-4 mr-1" />
              Iniciar
            </Button>
          )}

          {isRunning && (
            <>
              <Button
                onClick={() => handleTimerAction('pause')}
                disabled={isUpdating}
                variant="secondary"
                className="flex-1"
                size="sm"
              >
                <Pause className="w-4 h-4 mr-1" />
                Pausar
              </Button>
              <Button
                onClick={() => handleTimerAction('add')}
                disabled={isUpdating}
                variant="outline"
                size="sm"
              >
                <Plus className="w-4 h-4 mr-1" />
                1 min
              </Button>
              <Button
                onClick={() => handleTimerAction('reset')}
                disabled={isUpdating}
                variant="ghost"
                size="sm"
              >
                <RotateCcw className="w-4 h-4" />
              </Button>
            </>
          )}

          {isPaused && (
            <>
              <Button
                onClick={() => handleTimerAction('resume')}
                disabled={isUpdating}
                className="flex-1"
                size="sm"
              >
                <Play className="w-4 h-4 mr-1" />
                Retomar
              </Button>
              <Button
                onClick={() => handleTimerAction('add')}
                disabled={isUpdating}
                variant="outline"
                size="sm"
              >
                <Plus className="w-4 h-4 mr-1" />
                1 min
              </Button>
              <Button
                onClick={() => handleTimerAction('reset')}
                disabled={isUpdating}
                variant="ghost"
                size="sm"
              >
                <RotateCcw className="w-4 h-4" />
              </Button>
            </>
          )}

          {isFinished && (
            <>
              <Button
                onClick={() => handleTimerAction('add')}
                disabled={isUpdating}
                className="flex-1"
                size="sm"
              >
                <Plus className="w-4 h-4 mr-1" />
                +1 min
              </Button>
              <Button
                onClick={() => handleTimerAction('reset')}
                disabled={isUpdating}
                variant="ghost"
                size="sm"
              >
                <RotateCcw className="w-4 h-4" />
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
