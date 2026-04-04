import React, { useEffect, useState, useRef } from 'react'
import { useDictationState, useAudioLevel } from '../../hooks/useAPI'

function Waveform({ level }: { level: number }) {
  const smoothBars = useRef<number[]>(Array(12).fill(0))
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef<number>(0)

  useEffect(() => {
    const draw = () => {
      const canvas = canvasRef.current
      if (!canvas) { rafRef.current = requestAnimationFrame(draw); return }
      const c = canvas.getContext('2d')
      if (!c) return

      c.clearRect(0, 0, canvas.width, canvas.height)

      const barCount = 12
      const barWidth = 2
      const gap = 2.5
      const totalWidth = barCount * (barWidth + gap) - gap
      const startX = (canvas.width - totalWidth) / 2
      const centerY = canvas.height / 2

      for (let i = 0; i < barCount; i++) {
        const center = barCount / 2
        const dist = Math.abs(i - center) / center
        const t = Date.now() / 300
        const wave = Math.sin(t + i * 0.8) * 0.15
        const envelope = 1 - dist * 0.4
        const target = level * envelope + wave * level

        smoothBars.current[i] += (target - smoothBars.current[i]) * 0.1
        const value = Math.max(0, smoothBars.current[i])

        const minH = 2
        const maxH = canvas.height * 0.85
        const h = minH + value * (maxH - minH)
        const alpha = 0.4 + value * 0.6

        // Gradient from cyan to purple
        const hue = 200 + (i / barCount) * 60
        c.fillStyle = `hsla(${hue}, 80%, 70%, ${alpha})`
        c.beginPath()
        c.roundRect(startX + i * (barWidth + gap), centerY - h / 2, barWidth, h, 1)
        c.fill()
      }

      rafRef.current = requestAnimationFrame(draw)
    }
    rafRef.current = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(rafRef.current)
  }, [level])

  return <canvas ref={canvasRef} width={70} height={24} style={{ display: 'block' }} />
}

export default function DictationOverlay() {
  const { state } = useDictationState()
  const audioLevel = useAudioLevel()
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (state !== 'idle') {
      setVisible(true)
    } else {
      const timer = setTimeout(() => setVisible(false), 120)
      return () => clearTimeout(timer)
    }
  }, [state])

  if (!visible) return null

  const isRecording = state === 'recording'
  const isProcessing = state === 'transcribing' || state === 'processing'
  const isDone = state === 'pasting'
  const isError = state === 'error'

  return (
    <div style={{ width: '100vw', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent' }}>
      <style>{`
        @keyframes popIn { from { opacity: 0; transform: scale(0.85); } to { opacity: 1; transform: scale(1); } }
        @keyframes popOut { to { opacity: 0; transform: scale(0.85); } }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%, 100% { opacity: 0.5; } 50% { opacity: 1; } }
      `}</style>

      <div
        style={{
          animation: state === 'idle' ? 'popOut 0.1s ease-in forwards' : 'popIn 0.15s ease-out',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          background: 'rgba(10, 10, 18, 0.9)',
          borderRadius: '20px',
          padding: '5px 12px',
        }}
      >
        {/* Mic icon */}
        {isRecording && (
          <>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(140, 180, 255, 0.7)" strokeWidth="2" strokeLinecap="round">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            </svg>
            <Waveform level={audioLevel} />
          </>
        )}

        {isProcessing && (
          <svg
            width="14" height="14" viewBox="0 0 24 24"
            fill="none" stroke="rgba(140, 180, 255, 0.6)" strokeWidth="2" strokeLinecap="round"
            style={{ animation: 'spin 1s linear infinite' }}
          >
            <path d="M21 12a9 9 0 11-6.219-8.56" />
          </svg>
        )}

        {isDone && (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        )}

        {isError && (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        )}
      </div>
    </div>
  )
}
