import { CameraOffIcon, ChevronDownIcon, SwitchCameraIcon } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

export function Camera() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [deviceId, setDeviceId] = useState<string | null>(null)
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([])
  const [track, setTrack] = useState<MediaStreamTrack | null>(null)
  const [error, setError] = useState<string | null>(null)
  const isSupported = Boolean(navigator.mediaDevices)

  useEffect(() => {
    if (!isSupported) return

    let stream: MediaStream | null = null
    let isCancelled = false

    function updateDevices() {
      navigator.mediaDevices
        .enumerateDevices()
        .then((all) => {
          if (isCancelled) return
          setDevices(all.filter((device) => device.kind === 'videoinput'))
        })
        .catch((err: unknown) => {
          if (isCancelled) return
          setError(err instanceof Error ? err.message : String(err))
        })
    }

    navigator.mediaDevices.addEventListener('devicechange', updateDevices)

    navigator.mediaDevices
      .getUserMedia({
        video: deviceId ? { deviceId: { exact: deviceId } } : true,
        audio: false,
      })
      .then((result) => {
        if (isCancelled) {
          result.getTracks().forEach((track) => track.stop())
          return
        }

        stream = result
        if (videoRef.current) videoRef.current.srcObject = result
        setTrack(result.getVideoTracks()[0])
        setError(null)
        updateDevices()
      })
      .catch((err: unknown) => {
        if (isCancelled) return
        setError(err instanceof Error ? err.message : String(err))
      })

    return () => {
      isCancelled = true
      navigator.mediaDevices.removeEventListener('devicechange', updateDevices)
      stream?.getTracks().forEach((track) => track.stop())
    }
  }, [deviceId, isSupported])

  const settings = track?.getSettings()
  const isMirrored = settings?.facingMode !== 'environment'

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.code !== 'Space' && event.key !== 'Enter') return
      event.preventDefault()
      if (event.repeat || !videoRef.current) return
      downloadPhoto(videoRef.current, isMirrored)
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isMirrored])

  const message = isSupported
    ? error
    : 'Camera is not available. Open this page over HTTPS or localhost.'

  return (
    <main className="relative flex h-dvh flex-col overflow-hidden bg-black text-white select-none">
      <div className="relative flex-1">
        {message ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-8 text-center text-white/70">
            <CameraOffIcon className="size-10" />
            <p className="max-w-xs text-sm">{message}</p>
          </div>
        ) : (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className={cn(
              'absolute inset-0 size-full object-contain',
              isMirrored && '-scale-x-100'
            )}
          />
        )}
      </div>

      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 bg-black px-8 pt-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <div className="min-w-0 justify-self-start">
          {devices.length > 1 && (
            <label className="relative flex max-w-64 items-center gap-2 rounded-full bg-white/15 py-2 pr-4 pl-3 text-sm transition hover:bg-white/25">
              <SwitchCameraIcon className="size-5 shrink-0" />
              <span className="truncate">{track?.label}</span>
              <ChevronDownIcon className="size-4 shrink-0 text-white/60" />
              <select
                aria-label="Camera"
                value={settings?.deviceId}
                onChange={(event) => setDeviceId(event.target.value)}
                className="absolute inset-0 cursor-pointer opacity-0"
              >
                {devices.map((device, index) => (
                  <option key={device.deviceId} value={device.deviceId}>
                    {device.label || `Camera ${index + 1}`}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>

        <button
          type="button"
          aria-label="Take photo"
          disabled={Boolean(message)}
          onClick={() => {
            if (!videoRef.current) return
            downloadPhoto(videoRef.current, isMirrored)
          }}
          className="size-18 rounded-full border-4 border-white p-1 transition active:scale-95 disabled:opacity-40"
        >
          <span className="block size-full rounded-full bg-white" />
        </button>

        <div />
      </div>
    </main>
  )
}

function downloadPhoto(video: HTMLVideoElement, isMirrored: boolean) {
  if (video.videoWidth === 0) return

  const canvas = document.createElement('canvas')
  canvas.width = video.videoWidth
  canvas.height = video.videoHeight

  const context = canvas.getContext('2d')
  if (!context) throw new Error('Canvas 2D context is not available')

  if (isMirrored) {
    context.translate(canvas.width, 0)
    context.scale(-1, 1)
  }

  context.drawImage(video, 0, 0)

  const link = document.createElement('a')
  link.href = canvas.toDataURL('image/jpeg', 0.92)
  link.download = `photo-${Date.now()}.jpg`
  link.click()
}
