import { useEffect, useMemo, useRef, useState } from "react"
import { ExternalLink, RefreshCw } from "lucide-react"

import "../styles.css"
import { DEFAULT_DEVICE_IDS, DEVICE_BY_ID } from "../constants/devices"
import { SESSION_STORAGE_KEY } from "../constants/storage"
import type {
  DevicePresetId,
  MirrorMessageFromUi,
  MirrorMessageToUi,
  ResponsiveSession
} from "../types"
import { getSessionStorage } from "../utils/storage"

type FrameRecord = Record<DevicePresetId, { dataUrl: string; capturedAt: string }>
type StatusRecord = Record<
  DevicePresetId,
  { status: "starting" | "live" | "error"; message?: string }
>

const MIN_SCALE = 0.25
const MAX_SCALE = 1.25

const CanvasPage = () => {
  const [session, setSession] = useState<ResponsiveSession | null>(null)
  const [scale, setScale] = useState(0.85)
  const [frames, setFrames] = useState<FrameRecord>({} as FrameRecord)
  const [statusByDevice, setStatusByDevice] = useState<StatusRecord>(
    {} as StatusRecord
  )

  const portRef = useRef<chrome.runtime.Port | null>(null)

  useEffect(() => {
    const loadSession = async () => {
      const stored = await getSessionStorage<ResponsiveSession>(
        SESSION_STORAGE_KEY
      )
      if (stored) setSession(stored)
    }
    void loadSession()
  }, [])

  const devicePresets = useMemo(() => {
    const deviceIds = session?.devices?.length ? session.devices : DEFAULT_DEVICE_IDS
    return deviceIds.map((id) => DEVICE_BY_ID[id]).filter(Boolean)
  }, [session])

  useEffect(() => {
    if (!session) return

    const port = chrome.runtime.connect({
      name: `responsive-view:${session.id}`
    })

    portRef.current = port

    const onMessage = (raw: unknown) => {
      const message = raw as MirrorMessageToUi

      if (message.type === "mirror/frame" && message.sessionId === session.id) {
        const dataUrl = `data:${message.mime};base64,${message.dataBase64}`
        setFrames((prev) => ({
          ...prev,
          [message.deviceId]: { dataUrl, capturedAt: message.capturedAt }
        }))
        return
      }

      if (
        message.type === "mirror/status" &&
        message.sessionId === session.id
      ) {
        setStatusByDevice((prev) => ({
          ...prev,
          [message.deviceId]: {
            status: message.status,
            message: message.message
          }
        }))
      }
    }

    port.onMessage.addListener(onMessage)

    const start: MirrorMessageFromUi = {
      type: "mirror/start",
      session
    }
    port.postMessage(start)

    return () => {
      try {
        const stop: MirrorMessageFromUi = {
          type: "mirror/stop",
          sessionId: session.id
        }
        port.postMessage(stop)
      } catch {
        // ignored
      }

      try {
        port.onMessage.removeListener(onMessage)
      } catch {
        // ignored
      }

      try {
        port.disconnect()
      } catch {
        // ignored
      }
    }
  }, [session])

  const sendToBackground = (message: MirrorMessageFromUi) => {
    try {
      portRef.current?.postMessage(message)
    } catch {
      // ignored
    }
  }

  const openTargetTab = () => {
    if (!session?.url) return
    chrome.tabs.create({ url: session.url })
  }

  const reloadAll = () => {
    if (!session) return
    for (const preset of devicePresets) {
      sendToBackground({
        type: "mirror/reload",
        sessionId: session.id,
        deviceId: preset.id
      })
    }
  }

  if (!session) {
    return (
      <div className="mirror-shell">
        <div className="surface-card" style={{ padding: 24 }}>
          <p>Launch Responsive View from the popup to begin.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="mirror-shell">
      <header className="surface-card mirror-topbar">
        <div className="mirror-topbar__left">
          <span className="text-muted" style={{ fontSize: 12 }}>
            Target
          </span>
          <strong className="mirror-target">{session.url}</strong>
          <span className="text-muted" style={{ fontSize: 12 }}>
            {new Intl.DateTimeFormat([], {
              dateStyle: "medium",
              timeStyle: "short"
            }).format(new Date(session.createdAt))}
          </span>
        </div>

        <div className="mirror-topbar__right">
          <button
            type="button"
            className="primary-button"
            onClick={openTargetTab}>
            <ExternalLink size={16} style={{ marginRight: 6 }} />
            Open tab
          </button>

          <button type="button" className="ghost-button" onClick={reloadAll}>
            <RefreshCw size={14} style={{ marginRight: 6 }} />
            Reload all
          </button>

          <div className="scale-control mirror-scale" data-interactive="true">
            <span className="text-muted" style={{ fontSize: 12, width: 42 }}>
              {Math.round(scale * 100)}%
            </span>
            <input
              type="range"
              min={MIN_SCALE}
              max={MAX_SCALE}
              step={0.01}
              value={scale}
              onChange={(e) => setScale(Number(e.target.value))}
            />
          </div>
        </div>
      </header>

      <main className="surface-card mirror-workspace">
        <div className="mirror-grid">
          {devicePresets.map((preset) => {
            const status = statusByDevice[preset.id]?.status ?? "starting"
            const statusMessage = statusByDevice[preset.id]?.message
            const frame = frames[preset.id]
            const w = preset.width * scale
            const h = preset.height * scale

            const sendClick = (event: React.MouseEvent<HTMLDivElement>) => {
              const rect = event.currentTarget.getBoundingClientRect()
              const x = (event.clientX - rect.left) / scale
              const y = (event.clientY - rect.top) / scale
              sendToBackground({
                type: "mirror/input",
                sessionId: session.id,
                deviceId: preset.id,
                event: { kind: "click", x, y, button: event.button }
              })
            }

            const sendWheel = (event: React.WheelEvent<HTMLDivElement>) => {
              event.preventDefault()
              const rect = event.currentTarget.getBoundingClientRect()
              const x = (event.clientX - rect.left) / scale
              const y = (event.clientY - rect.top) / scale
              sendToBackground({
                type: "mirror/input",
                sessionId: session.id,
                deviceId: preset.id,
                event: {
                  kind: "wheel",
                  x,
                  y,
                  deltaX: event.deltaX,
                  deltaY: event.deltaY
                }
              })
            }

            const reloadViewport = () => {
              sendToBackground({
                type: "mirror/reload",
                sessionId: session.id,
                deviceId: preset.id
              })
            }

            return (
              <section key={preset.id} className="mirror-tile">
                <header className="mirror-tile__header">
                  <div>
                    <strong>{preset.label}</strong>
                    <div className="text-muted" style={{ fontSize: 12 }}>
                      {preset.width}×{preset.height} · DPR {preset.pixelRatio}
                    </div>
                  </div>

                  <span className={`device-pill device-pill--${status}`}>
                    {status === "starting" && "Starting"}
                    {status === "live" && "Live"}
                    {status === "error" && "Error"}
                  </span>
                </header>

                <div
                  className="mirror-viewport"
                  style={{ width: w, height: h }}
                  onClick={sendClick}
                  onWheel={sendWheel}>
                  {frame ? (
                    <img
                      className="mirror-image"
                      src={frame.dataUrl}
                      alt=""
                      draggable={false}
                    />
                  ) : (
                    <div className="mirror-placeholder">
                      <div className="text-muted" style={{ fontSize: 12 }}>
                        Waiting for frame…
                      </div>
                      {status === "error" && statusMessage ? (
                        <div
                          className="text-muted"
                          style={{ fontSize: 12, marginTop: 6 }}>
                          {statusMessage}
                        </div>
                      ) : null}
                    </div>
                  )}
                </div>

                <div className="mirror-tile__footer">
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={reloadViewport}>
                    <RefreshCw size={14} style={{ marginRight: 6 }} />
                    Reload
                  </button>

                  {frame?.capturedAt ? (
                    <span className="text-muted" style={{ fontSize: 12 }}>
                      {new Intl.DateTimeFormat([], {
                        timeStyle: "medium"
                      }).format(new Date(frame.capturedAt))}
                    </span>
                  ) : (
                    <span className="text-muted" style={{ fontSize: 12 }}>
                      …
                    </span>
                  )}
                </div>
              </section>
            )
          })}
        </div>
      </main>
    </div>
  )
}

export default CanvasPage

