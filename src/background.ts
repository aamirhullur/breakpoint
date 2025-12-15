import { DEVICE_BY_ID, type DevicePreset } from "./constants/devices"
import type {
  DevicePresetId,
  MirrorMessageFromUi,
  MirrorMessageToUi,
  ResponsiveSession
} from "./types"

type DeviceRuntime = {
  deviceId: DevicePresetId
  tabId: number
  preset: DevicePreset
  attached: boolean
  initialized: boolean
}

type SessionRuntime = {
  session: ResponsiveSession
  port: chrome.runtime.Port
  previewWindowId: number
  devices: Map<DevicePresetId, DeviceRuntime>
  captureTimer: number | null
  isStopping: boolean
  isTicking: boolean
}

const sessions = new Map<string, SessionRuntime>()

const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms))

const withTimeout = async <T>(
  label: string,
  ms: number,
  promise: Promise<T>
): Promise<T> => {
  let timeoutId: number | null = null
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(`${label} timed out`)), ms) as unknown as number
  })
  try {
    return await Promise.race([promise, timeout])
  } finally {
    if (timeoutId !== null) clearTimeout(timeoutId)
  }
}

const postToUi = (port: chrome.runtime.Port, message: MirrorMessageToUi) => {
  try {
    port.postMessage(message)
  } catch {
    // ignored
  }
}

const debugTarget = (tabId: number): chrome.debugger.Debuggee => ({ tabId })

const sendCdp = async <T extends object = any>(
  tabId: number,
  method: string,
  params?: Record<string, any>
): Promise<T> => {
  return (await chrome.debugger.sendCommand(
    debugTarget(tabId),
    method,
    params
  )) as unknown as T
}

const ensureAttached = async (
  device: DeviceRuntime,
  port: chrome.runtime.Port,
  sessionId: string
) => {
  if (device.attached) return
  try {
    await chrome.debugger.attach(debugTarget(device.tabId), "1.3")
    device.attached = true
  } catch (error) {
    postToUi(port, {
      type: "mirror/status",
      sessionId,
      deviceId: device.deviceId,
      status: "error",
      message:
        error instanceof Error
          ? error.message
          : "Failed to attach Chrome debugger (missing permission?)"
    })
    throw error
  }
}

const applyEmulation = async (device: DeviceRuntime) => {
  const preset = device.preset

  await sendCdp(device.tabId, "Emulation.setDeviceMetricsOverride", {
    width: preset.width,
    height: preset.height,
    deviceScaleFactor: preset.pixelRatio,
    mobile: preset.category === "mobile"
  })

  await sendCdp(device.tabId, "Network.setUserAgentOverride", {
    userAgent: preset.userAgent
  })

  if (preset.category === "mobile") {
    await sendCdp(device.tabId, "Emulation.setTouchEmulationEnabled", {
      enabled: true,
      maxTouchPoints: 5
    })
  } else {
    await sendCdp(device.tabId, "Emulation.setTouchEmulationEnabled", {
      enabled: false
    })
  }
}

const navigate = async (device: DeviceRuntime, url: string) => {
  await sendCdp(device.tabId, "Page.enable")
  await sendCdp(device.tabId, "Network.enable")
  await sendCdp(device.tabId, "Runtime.enable")
  await sendCdp(device.tabId, "Page.navigate", { url })
}

const ensureInitialized = async (
  runtime: SessionRuntime,
  device: DeviceRuntime
) => {
  if (device.initialized) return
  const sessionId = runtime.session.id

  postToUi(runtime.port, {
    type: "mirror/status",
    sessionId,
    deviceId: device.deviceId,
    status: "starting"
  })

  await withTimeout(
    "debugger.attach",
    2500,
    ensureAttached(device, runtime.port, sessionId)
  )
  await withTimeout("applyEmulation", 2500, applyEmulation(device))

  // Make the tab active inside the preview window to ensure it paints for screenshots.
  try {
    await chrome.tabs.update(device.tabId, { active: true })
  } catch {
    // ignore
  }

  await withTimeout("navigate", 5000, navigate(device, runtime.session.url))
  await sleep(250)

  device.initialized = true
}

const captureFrame = async (device: DeviceRuntime): Promise<string> => {
  const result = await sendCdp<{ data: string }>(device.tabId, "Page.captureScreenshot", {
    format: "jpeg",
    quality: 70,
    fromSurface: true,
    captureBeyondViewport: false,
    clip: {
      x: 0,
      y: 0,
      width: device.preset.width,
      height: device.preset.height,
      scale: 1
    }
  })
  return result.data
}

const createPreviewWindow = async (): Promise<number> => {
  let lastFocusedWindowId: number | undefined
  try {
    const last = await chrome.windows.getLastFocused()
    lastFocusedWindowId = last?.id
  } catch {
    // ignore
  }

  // Important:
  // - A minimized window can cause Chromium to stop painting, which makes CDP screenshots hang.
  // - Chrome/Brave require window bounds to be mostly on-screen (can't fully place off-screen).
  // So we create a small, unfocused popup that stays on-screen and immediately restore focus.
  const win = await chrome.windows.create({
    focused: false,
    type: "popup",
    width: 520,
    height: 420,
    url: "about:blank"
  })

  if (!win?.id) {
    throw new Error("Failed to create preview window")
  }

  try {
    await chrome.windows.update(win.id, { focused: false })
  } catch {
    // ignore
  }

  if (lastFocusedWindowId !== undefined) {
    try {
      await chrome.windows.update(lastFocusedWindowId, { focused: true })
    } catch {
      // ignore
    }
  }

  return win.id
}

const ensureDeviceTabs = async (
  session: ResponsiveSession,
  windowId: number
): Promise<Map<DevicePresetId, DeviceRuntime>> => {
  const devices = new Map<DevicePresetId, DeviceRuntime>()

  const deviceIds = session.devices.filter((deviceId) => Boolean(DEVICE_BY_ID[deviceId]))
  if (!deviceIds.length) {
    return devices
  }

  // Reuse the initial tab created with the window to avoid tab-removal races.
  const existingTabs = await chrome.tabs.query({ windowId })
  const hostTabId =
    existingTabs.find((tab) => tab.active && tab.id)?.id ??
    existingTabs.find((tab) => tab.id)?.id

  if (!hostTabId) {
    return devices
  }

  const firstDeviceId = deviceIds[0]
  const firstPreset = DEVICE_BY_ID[firstDeviceId]
  if (firstPreset) {
    try {
      await chrome.tabs.update(hostTabId, { url: session.url })
    } catch {
      // ignore
    }

    devices.set(firstDeviceId, {
      deviceId: firstDeviceId,
      tabId: hostTabId,
      preset: firstPreset,
      attached: false,
      initialized: false
    })
  }

  for (const deviceId of deviceIds.slice(1)) {
    const preset = DEVICE_BY_ID[deviceId]
    if (!preset) continue
    const tab = await chrome.tabs.create({
      windowId,
      url: session.url,
      active: false
    })
    if (!tab?.id) continue
    devices.set(deviceId, {
      deviceId,
      tabId: tab.id,
      preset,
      attached: false,
      initialized: false
    })
  }

  return devices
}

const startCaptureLoop = (runtime: SessionRuntime) => {
  if (runtime.captureTimer) return

  const tick = async () => {
    if (runtime.isStopping) return
    if (runtime.isTicking) return
    runtime.isTicking = true
    const sessionId = runtime.session.id
    const port = runtime.port

    try {
      for (const device of runtime.devices.values()) {
        if (runtime.isStopping) return
        try {
          await ensureInitialized(runtime, device)
          // Keep the tab active to ensure screenshots are available, but avoid navigating again.
          try {
            await chrome.tabs.update(device.tabId, { active: true })
          } catch {
            // ignore
          }

          await sleep(60)

          const dataBase64 = await withTimeout(
            "captureScreenshot",
            2500,
            captureFrame(device)
          )

          postToUi(port, {
            type: "mirror/frame",
            sessionId,
            deviceId: device.deviceId,
            mime: "image/jpeg",
            dataBase64,
            capturedAt: new Date().toISOString()
          })

          postToUi(port, {
            type: "mirror/status",
            sessionId,
            deviceId: device.deviceId,
            status: "live"
          })
        } catch (error) {
          postToUi(port, {
            type: "mirror/status",
            sessionId,
            deviceId: device.deviceId,
            status: "error",
            message: error instanceof Error ? error.message : "Capture failed"
          })
        }
      }
    } finally {
      runtime.isTicking = false
    }
  }

  // Initial burst then steady interval (captures all devices sequentially).
  void tick()
  runtime.captureTimer = setInterval(() => void tick(), 1100) as unknown as number
}

const stopSession = async (sessionId: string) => {
  const runtime = sessions.get(sessionId)
  if (!runtime) return
  runtime.isStopping = true

  if (runtime.captureTimer) {
    clearInterval(runtime.captureTimer)
    runtime.captureTimer = null
  }

  for (const device of runtime.devices.values()) {
    try {
      if (device.attached) {
        await chrome.debugger.detach(debugTarget(device.tabId))
      }
    } catch {
      // ignore
    }
  }

  try {
    const tabIds = Array.from(runtime.devices.values()).map((d) => d.tabId)
    if (tabIds.length) await chrome.tabs.remove(tabIds)
  } catch {
    // ignore
  }

  try {
    await chrome.windows.remove(runtime.previewWindowId)
  } catch {
    // ignore
  }

  sessions.delete(sessionId)
}

const handleUiMessage = async (
  runtime: SessionRuntime,
  message: MirrorMessageFromUi
) => {
  if (message.type === "mirror/start") {
    startCaptureLoop(runtime)
    return
  }

  if (message.type === "mirror/stop") {
    await stopSession(message.sessionId)
    return
  }

  if (message.type === "mirror/reload") {
    const device = runtime.devices.get(message.deviceId)
    if (!device) return
    await ensureAttached(device, runtime.port, runtime.session.id)
    device.initialized = false
    await sendCdp(device.tabId, "Page.reload", { ignoreCache: true })
    return
  }

  if (message.type === "mirror/input") {
    const device = runtime.devices.get(message.deviceId)
    if (!device) return
    await ensureInitialized(runtime, device)

    if (message.event.kind === "click") {
      const x = Math.max(0, Math.min(device.preset.width - 1, message.event.x))
      const y = Math.max(0, Math.min(device.preset.height - 1, message.event.y))
      const button = message.event.button ?? 0

      await sendCdp(device.tabId, "Input.dispatchMouseEvent", {
        type: "mousePressed",
        x,
        y,
        button: button === 2 ? "right" : "left",
        clickCount: 1
      })
      await sendCdp(device.tabId, "Input.dispatchMouseEvent", {
        type: "mouseReleased",
        x,
        y,
        button: button === 2 ? "right" : "left",
        clickCount: 1
      })
      return
    }

    if (message.event.kind === "wheel") {
      const x = Math.max(0, Math.min(device.preset.width - 1, message.event.x))
      const y = Math.max(0, Math.min(device.preset.height - 1, message.event.y))
      await sendCdp(device.tabId, "Input.dispatchMouseEvent", {
        type: "mouseWheel",
        x,
        y,
        deltaX: message.event.deltaX,
        deltaY: message.event.deltaY
      })
    }
  }
}

chrome.runtime.onConnect.addListener((port) => {
  if (!port.name.startsWith("responsive-view:")) return
  const sessionId = port.name.slice("responsive-view:".length)
  if (!sessionId) return

  port.onMessage.addListener(async (raw) => {
    try {
      const message = raw as MirrorMessageFromUi
      if (message.type === "mirror/start") {
        try {
          if (sessions.has(sessionId)) {
            await stopSession(sessionId)
          }

          const previewWindowId = await createPreviewWindow()
          const devices = await ensureDeviceTabs(
            message.session,
            previewWindowId
          )

          if (!devices.size) {
            throw new Error("No device tabs were created")
          }

          const runtime: SessionRuntime = {
            session: message.session,
            port,
            previewWindowId,
            devices,
            captureTimer: null,
            isStopping: false,
            isTicking: false
          }

          sessions.set(sessionId, runtime)
          startCaptureLoop(runtime)
          return
        } catch (error) {
          // Best-effort error propagation.
          for (const deviceId of message.session.devices) {
            postToUi(port, {
              type: "mirror/status",
              sessionId,
              deviceId,
              status: "error",
              message:
                error instanceof Error
                  ? error.message
                  : "Failed to start mirroring"
            })
          }
          return
        }
      }

      const runtime = sessions.get(sessionId)
      if (!runtime) return
      await handleUiMessage(runtime, message)
    } catch (error) {
      console.error("[responsive-view] port message failed", error)

      const runtime = sessions.get(sessionId)
      const deviceId = (raw as any)?.deviceId as DevicePresetId | undefined

      if (runtime && deviceId) {
        postToUi(runtime.port, {
          type: "mirror/status",
          sessionId: runtime.session.id,
          deviceId,
          status: "error",
          message: error instanceof Error ? error.message : "Unexpected error"
        })
        return
      }

      if (runtime) {
        for (const id of runtime.session.devices) {
          postToUi(runtime.port, {
            type: "mirror/status",
            sessionId: runtime.session.id,
            deviceId: id,
            status: "error",
            message: error instanceof Error ? error.message : "Unexpected error"
          })
        }
      }
    }
  })

  port.onDisconnect.addListener(() => {
    stopSession(sessionId).catch((error) => {
      console.error("[responsive-view] stopSession failed", error)
    })
  })
})
