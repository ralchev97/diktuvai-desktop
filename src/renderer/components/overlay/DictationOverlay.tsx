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
        const maxH = canvas.height * 0.9
        const h = minH + value * (maxH - minH)
        const alpha = 0.5 + value * 0.5

        // Subtle indigo → violet gradient for a modern look
        const hue = 235 + (i / barCount) * 35
        c.fillStyle = `hsla(${hue}, 85%, 75%, ${alpha})`
        c.beginPath()
        c.roundRect(startX + i * (barWidth + gap), centerY - h / 2, barWidth, h, 1.2)
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

  // Auto-hide limit overlay after 5 seconds
  useEffect(() => {
    if (state === 'limit') {
      const timer = setTimeout(() => setVisible(false), 5000)
      return () => clearTimeout(timer)
    }
  }, [state])

  const handleUpgrade = () => {
    (window as any).diktuvai?.upgradeFromLimit('pro')
  }

  if (!visible) return null

  const isRecording = state === 'recording'
  const isProcessing = state === 'transcribing' || state === 'processing'
  const isDone = state === 'pasting'
  const isError = state === 'error'
  const isLimit = state === 'limit'

  // Modern glass pill: subtle blur, soft border, inner highlight, smoother motion.
  const pillBase: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    background: 'linear-gradient(180deg, rgba(28, 28, 40, 0.72) 0%, rgba(14, 14, 22, 0.82) 100%)',
    backdropFilter: 'blur(18px) saturate(160%)',
    WebkitBackdropFilter: 'blur(18px) saturate(160%)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    boxShadow:
      '0 8px 24px rgba(0, 0, 0, 0.35), 0 1px 0 rgba(255, 255, 255, 0.06) inset',
    borderRadius: '999px',
    padding: '6px 14px',
    fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif',
  }

  return (
    <div style={{ width: '100vw', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent' }}>
      <style>{`
        @keyframes popIn { from { opacity: 0; transform: translateY(4px) scale(0.9); } to { opacity: 1; transform: translateY(0) scale(1); } }
        @keyframes popOut { to { opacity: 0; transform: translateY(4px) scale(0.9); } }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%, 100% { opacity: 0.55; } 50% { opacity: 1; } }
        @keyframes recordGlow { 0%, 100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.0); } 50% { box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.18); } }
      `}</style>

      {isLimit ? (
        <div
          style={{
            ...pillBase,
            animation: 'popIn 0.18s cubic-bezier(0.2, 0.8, 0.2, 1)',
            flexDirection: 'column',
            gap: '8px',
            borderRadius: '18px',
            padding: '14px 20px',
          }}
        >
          <span style={{ color: '#fbbf24', fontSize: '12px', fontWeight: 600 }}>
            Безплатните думи свършиха
          </span>
          <button
            onClick={handleUpgrade}
            style={{
              background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
              color: '#fff',
              border: 'none',
              borderRadius: '10px',
              padding: '7px 18px',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(99, 102, 241, 0.35)',
              fontFamily: '-apple-system, sans-serif',
            }}
          >
            Надгради за €5/мес
          </button>
        </div>
      ) : (
        <div
          style={{
            ...pillBase,
            animation: state === 'idle'
              ? 'popOut 0.14s cubic-bezier(0.4, 0, 1, 1) forwards'
              : 'popIn 0.18s cubic-bezier(0.2, 0.8, 0.2, 1)',
          }}
        >
          {isRecording && (
            <>
              <svg
                width="13" height="13" viewBox="0 0 24 24"
                fill="none"
                stroke="url(#micGrad)"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ flexShrink: 0, filter: 'drop-shadow(0 0 4px rgba(139, 92, 246, 0.45))' }}
              >
                <defs>
                  <linearGradient id="micGrad" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#a5b4fc" />
                    <stop offset="100%" stopColor="#c4b5fd" />
                  </linearGradient>
                </defs>
                <rect x="9" y="2" width="6" height="12" rx="3" />
                <path d="M5 11a7 7 0 0 0 14 0" />
                <line x1="12" y1="18" x2="12" y2="22" />
              </svg>
              <Waveform level={audioLevel} />
            </>
          )}

          {isProcessing && (
            <svg
              width="14" height="14" viewBox="0 0 24 24"
              fill="none" stroke="rgba(180, 200, 255, 0.85)" strokeWidth="2.2" strokeLinecap="round"
              style={{ animation: 'spin 0.9s linear infinite' }}
            >
              <path d="M21 12a9 9 0 11-6.219-8.56" />
            </svg>
          )}

          {isDone && (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          )}

          {isError && (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="2.6" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          )}
        </div>
      )}
    </div>
  )
}
