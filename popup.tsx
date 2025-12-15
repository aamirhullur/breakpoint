import { Loader2, MonitorSmartphone, Sparkles } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { z } from "zod"

import "./src/styles.css"

import {
  DEFAULT_DEVICE_IDS,
  DEVICE_PRESETS,
  type DevicePreset
} from "./src/constants/devices"
import {
  CANVAS_TAB_KEY,
  LAST_SESSION_KEY,
  SESSION_STORAGE_KEY
} from "./src/constants/storage"
import type { ResponsiveSession } from "./src/types"
import {
  getSessionStorage,
  getSyncStorage,
  removeSessionStorage,
  setSessionStorage,
  setSyncStorage
} from "./src/utils/storage"
import { normalizeTargetUrl } from "./src/utils/url"

const sessionInputSchema = z.object({
  url: z.string().trim().min(1, "Enter a website link or localhost URL"),
  devices: z.array(z.string()).min(1, "Pick at least one viewport")
})

type FormState = {
  url: string
  devices: string[]
}

type StatusState =
  | { type: "idle" }
  | { type: "submitting" }
  | { type: "success"; message: string }
  | { type: "error"; message: string }

const buildInitialState = (): FormState => ({
  url: "",
  devices: [...DEFAULT_DEVICE_IDS]
})

const buildCanvasUrl = (sessionId: string) => {
  const base = chrome.runtime.getURL("tabs/canvas.html")
  const url = new URL(base)
  url.searchParams.set("sessionId", sessionId)
  return url.toString()
}

const focusOrCreateCanvasTab = async (session: ResponsiveSession) => {
  const canvasUrl = buildCanvasUrl(session.id)
  const storedId = await getSessionStorage<number>(CANVAS_TAB_KEY)

  if (storedId !== undefined) {
    try {
      await chrome.tabs.get(storedId)
      await chrome.tabs.update(storedId, {
        url: canvasUrl,
        active: true
      })
      return
    } catch {
      await removeSessionStorage(CANVAS_TAB_KEY)
    }
  }

  const created = await chrome.tabs.create({ url: canvasUrl, active: true })
  if (created?.id !== undefined) {
    await setSessionStorage(CANVAS_TAB_KEY, created.id)
  }
}

const statusLabel = (status: StatusState) => {
  if (status.type === "submitting") return "Opening canvas…"
  if (status.type === "success") return status.message
  if (status.type === "error") return status.message
  return "Ready"
}

function IndexPopup() {
  const [form, setForm] = useState<FormState>(buildInitialState)
  const [status, setStatus] = useState<StatusState>({ type: "idle" })

  useEffect(() => {
    const load = async () => {
      const stored = await getSyncStorage<FormState>(LAST_SESSION_KEY)
      if (stored?.url) {
        setForm((prev) => ({
          url: stored.url,
          devices: stored.devices?.length ? stored.devices : prev.devices
        }))
      }
    }
    load()
  }, [])

  const deviceLookup = useMemo(() => new Set(form.devices), [form.devices])

  const handleToggleDevice = (device: DevicePreset) => {
    setForm((prev) => {
      const active = prev.devices.includes(device.id)
      if (active && prev.devices.length === 1) {
        return prev
      }
      const devices = active
        ? prev.devices.filter((id) => id !== device.id)
        : [...prev.devices, device.id]
      return { ...prev, devices }
    })
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    const parsed = sessionInputSchema.safeParse(form)
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0]
      setStatus({
        type: "error",
        message: firstIssue?.message ?? "Invalid input"
      })
      return
    }

    try {
      setStatus({ type: "submitting" })
      const normalizedUrl = normalizeTargetUrl(parsed.data.url)
      const session: ResponsiveSession = {
        id: crypto.randomUUID(),
        url: normalizedUrl,
        devices: parsed.data.devices,
        mode: "mirror",
        createdAt: new Date().toISOString()
      }

      await setSyncStorage(LAST_SESSION_KEY, {
        url: normalizedUrl,
        devices: session.devices
      })

      await setSessionStorage(SESSION_STORAGE_KEY, session)
      await focusOrCreateCanvasTab(session)
      setStatus({ type: "success", message: "Canvas opened in a new tab" })
    } catch (error) {
      setStatus({
        type: "error",
        message:
          error instanceof Error ? error.message : "Unable to open canvas tab"
      })
    }
  }

  return (
    <div className="popup-shell">
      <header style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <div
          style={{
            width: 42,
            height: 42,
            borderRadius: 12,
            background: "rgba(124, 140, 255, 0.15)",
            display: "grid",
            placeItems: "center",
            border: "1px solid rgba(124, 140, 255, 0.4)"
          }}>
          <MonitorSmartphone size={22} />
        </div>
        <div style={{ flex: 1 }}>
          <strong style={{ display: "block", fontSize: 16 }}>Breakpoint</strong>
          <span className="text-muted" style={{ fontSize: 13 }}>
            Launch multi-viewport layouts inside Chrome.
          </span>
        </div>
        <div className="status-chip">
          <Sparkles size={14} />
          Beta
        </div>
      </header>

      <form className="surface-card popup-form" onSubmit={handleSubmit}>
        <div className="input-root">
          <label htmlFor="url-input">Target URL or localhost</label>
          <input
            id="url-input"
            className="input-field"
            placeholder="https://example.com or localhost:3000"
            autoComplete="off"
            spellCheck={false}
            value={form.url}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, url: e.target.value }))
            }
          />
        </div>

        <div style={{ marginTop: 16 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginBottom: 8,
              gap: 8,
              alignItems: "center"
            }}>
            <label>Device presets</label>
            <span className="text-muted" style={{ fontSize: 12 }}>
              {form.devices.length} selected
            </span>
          </div>
          <div className="device-grid">
            {DEVICE_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                className="device-pill"
                data-active={deviceLookup.has(preset.id)}
                onClick={() => handleToggleDevice(preset)}>
                <span style={{ fontWeight: 600 }}>{preset.label}</span>
                <span className="text-muted" style={{ fontSize: 12 }}>
                  {preset.width} × {preset.height} · {preset.category}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 8,
            marginTop: 16
          }}>
          <button
            type="submit"
            className="primary-button"
            disabled={status.type === "submitting"}>
            {status.type === "submitting" ? (
              <span style={{ display: "inline-flex", alignItems: "center" }}>
                <Loader2 size={16} className="spin" />
                <span style={{ marginLeft: 8 }}>Launching…</span>
              </span>
            ) : (
              "Open Canvas"
            )}
          </button>
          <span className="text-muted" style={{ fontSize: 12 }}>
            Works best for URLs that allow embedding. If a viewport stays blank,
            the site blocks iframes—switch to mirrored tabs in the canvas.
          </span>
        </div>
      </form>

      <footer style={{ fontSize: 12 }} className="text-muted">
        {statusLabel(status)}
      </footer>
    </div>
  )
}

export default IndexPopup
