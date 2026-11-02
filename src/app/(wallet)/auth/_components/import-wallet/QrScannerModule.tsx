'use client'

import React, { useEffect, useRef } from "react"
import jsQR from "jsqr"
import { X, Focus } from "lucide-react"

interface QrScannerModuleProps {
  onScanSuccess: (text: string) => void
  onClose: () => void
}

export const QrScannerModule = React.memo(function QrScannerModule({
  onScanSuccess,
  onClose
}: QrScannerModuleProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  const lastScanTimeRef = useRef<number>(0)

  useEffect(() => {
    let stream: MediaStream | null = null

    async function startCamera() {
      try {
        // Запрос потока с идеальным HD-разрешением для Android Chrome
        stream = await navigator.mediaDevices.getUserMedia({
          video: { 
            facingMode: "environment",
            width: { ideal: 1280, max: 1920 },
            height: { ideal: 720, max: 1080 }
          }
        })
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          videoRef.current.setAttribute("playsinline", "true")
          videoRef.current.play()
          animationFrameRef.current = requestAnimationFrame(tick)
        }
      } catch (err) {
        console.error("Критическая ошибка запуска камеры на Android:", err)
        onClose()
      }
    }

    function tick() {
      if (videoRef.current && canvasRef.current) {
        const video = videoRef.current
        const canvas = canvasRef.current
        const context = canvas.getContext("2d", { willReadFrequently: true })

        if (context && video.readyState === video.HAVE_ENOUGH_DATA) {
          // Синхронизируем размеры холста с видеопотоком на каждом кадре
          if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
            canvas.width = video.videoWidth
            canvas.height = video.videoHeight
          }

          // Отрисовка кадра на холст идет НЕПРЕРЫВНО, чтобы предотвратить замерзание
          context.drawImage(video, 0, 0, canvas.width, canvas.height)

          // 🛡️ ТРОТТЛИНГ АНАЛИЗА ДЛЯ ANDROID (3 раза в секунду):
          // Используем performance.now() для гарантированной линейности времени в Chrome
          const now = performance.now()
          if (now - lastScanTimeRef.current >= 330) {
            lastScanTimeRef.current = now

            const imageData = context.getImageData(0, 0, canvas.width, canvas.height)
            const code = jsQR(imageData.data, imageData.width, imageData.height, {
              inversionAttempts: "dontInvert",
            })

            if (code && code.data) {
              const words = code.data.trim().split(/\s+/).filter(Boolean)
              if (words.length === 24) {
                onScanSuccess(code.data)
                return // Останавливаем цикл, если успешно сосканировали
              }
            }
          }
        }
      }
      animationFrameRef.current = requestAnimationFrame(tick)
    }

    startCamera()

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
      if (stream) {
        stream.getTracks().forEach(track => track.stop())
      }
    }
  }, [onScanSuccess, onClose])

  return (
    <div className="absolute inset-0 z-40 bg-zinc-950 rounded-xl overflow-hidden animate-fade-in flex flex-col justify-between p-4">
      
      {/* Верхняя панель */}
      <div className="flex items-center justify-between w-full z-10 bg-zinc-950/80 backdrop-blur-md p-2 rounded-lg border border-zinc-850 select-none">
        <div className="flex items-center gap-1.5 text-[9px] font-bold text-[#FF2E93] uppercase tracking-wider pl-1">
          <Focus size={10} className="animate-pulse" />
          <span>Сканирование вашего бэкапа</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-zinc-500 hover:text-white transition-colors p-1 rounded-md hover:bg-zinc-900 cursor-pointer"
        >
          <X size={12} />
        </button>
      </div>

      {/* Видео во весь экран плашки */}
      <video 
        ref={videoRef} 
        className="absolute inset-0 w-full h-full object-cover opacity-80 pointer-events-none select-none" 
      />
      
      {/* Скрытый холст для процессинга jsQR */}
      <canvas ref={canvasRef} className="hidden" />
      
      {/* Прицел */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none">
        <div className="w-[180px] h-[180px] border-2 border-dashed border-[#FF2E93]/60 bg-[#FF2E93]/5 rounded-xl shadow-[0_0_40px_rgba(255,46,147,0.15)] flex items-center justify-center">
          <div className="w-4 h-4 border-t-2 border-l-2 border-[#FF2E93] absolute top-[-2px] left-[-2px]" />
          <div className="w-4 h-4 border-t-2 border-r-2 border-[#FF2E93] absolute top-[-2px] right-[-2px]" />
          <div className="w-4 h-4 border-b-2 border-l-2 border-[#FF2E93] absolute bottom-[-2px] left-[-2px]" />
          <div className="w-4 h-4 border-b-2 border-r-2 border-[#FF2E93] absolute bottom-[-2px] right-[-2px]" />
        </div>
      </div>
      
      {/* Нижняя подсказка */}
      <div className="text-center z-10 bg-zinc-950/80 backdrop-blur-md py-1.5 px-3 rounded-lg border border-zinc-850 w-fit mx-auto pointer-events-none select-none">
        <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-wide">
          Поместите QR-код в рамку прицела
        </p>
      </div>
    </div>
  )
})
