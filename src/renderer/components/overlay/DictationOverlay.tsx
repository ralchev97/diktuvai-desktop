import React, { useEffect, useState, useRef } from 'react'
import { useDictationState, useAudioLevel } from '../../hooks/useAPI'

function WaveformDots({ level }: { level: number }) {
  const smoothBars = useRef<number[]>(Array(8).fill(0))
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef<number>(0)

  useEffect(() => {
    const draw = () => {
      const canvas = canvasRef.current
      if (!canvas) { rafRef.current = requestAnimationFrame(draw); return }
      const c = canvas.getContext('2d')
      if (!c) return

      c.clearRect(0, 0, canvas.width, canvas.height)

      const barCount = 8
      const dotSize = 2.5
      const gap = 2.5
      const totalWidth = barCount * (dotSize + gap) - gap
      const startX = (canvas.width - totalWidth) / 2
      const centerY = canvas.height / 2

      for (let i = 0; i < barCount; i++) {
        const center = barCount / 2
        const dist = Math.abs(i - center) / center
        const t = Date.now() / 350
        const wave = Math.sin(t + i * 0.7) * 0.12
        const envelope = 1 - dist * 0.35
        const target = level * envelope + wave * level

        smoothBars.current[i] += (target - smoothBars.current[i]) * 0.08
        const value = Math.max(0, smoothBars.current[i])

        const minH = 2.5
        const maxH = canvas.height * 0.85
        const h = minH + value * (maxH - minH)
        const alpha = 0.35 + value * 0.55

        c.fillStyle = `rgba(255, 255, 255, ${alpha})`
        c.beginPath()
        c.roundRect(startX + i * (dotSize + gap), centerY - h / 2, dotSize, h, dotSize / 2)
        c.fill()
      }

      rafRef.current = requestAnimationFrame(draw)
    }
    rafRef.current = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(rafRef.current)
  }, [level])

  return <canvas ref={canvasRef} width={44} height={18} style={{ display: 'block' }} />
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
    <div className="h-screen w-screen flex items-center justify-center">
      <style>{`
        @keyframes popIn { from { opacity: 0; transform: scale(0.8); } to { opacity: 1; transform: scale(1); } }
        @keyframes popOut { to { opacity: 0; transform: scale(0.8); } }
        @keyframes dotWave {
          0%, 100% { opacity: 0.15; transform: scaleY(1); }
          50% { opacity: 0.5; transform: scaleY(1.4); }
        }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>

      <div
        style={{
          animation: state === 'idle' ? 'popOut 0.1s ease-in forwards' : 'popIn 0.1s ease-out',
          display: 'inline-flex',
          alignItems: 'center',
        }}
      >
        {isRecording && <WaveformDots level={audioLevel} />}

        {isProcessing && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            {Array.from({ length: 7 }).map((_, i) => (
              <div
                key={i}
                style={{
                  width: 2,
                  height: 2,
                  borderRadius: '50%',
                  backgroundColor: 'rgba(255,255,255,0.35)',
                  animation: `dotWave 1.3s ease-in-out ${i * 0.1}s infinite`,
                }}
              />
            ))}
            <svg
              width="10" height="10" viewBox="0 0 24 24"
              fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2.5" strokeLinecap="round"
              style={{ marginLeft: 2, animation: 'spin 1s linear infinite' }}
            >
              <path d="M21 12a9 9 0 11-6.219-8.56" />
            </svg>
          </div>
        )}

        {isDone && (
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        )}

        {isError && (
          <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="3" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        )}
      </div>
    </div>
  )
}
