import type { DevicePreset } from "./constants/devices"

export type DevicePresetId = DevicePreset["id"]

export type CanvasMode = "mirror" | "iframe"

export type ResponsiveSession = {
  id: string
  url: string
  devices: DevicePresetId[]
  mode: CanvasMode
  createdAt: string
}

export type MirrorStartMessage = {
  type: "mirror/start"
  session: ResponsiveSession
}

export type MirrorStopMessage = {
  type: "mirror/stop"
  sessionId: string
}

export type MirrorReloadMessage = {
  type: "mirror/reload"
  sessionId: string
  deviceId: DevicePresetId
}

export type MirrorInputMessage = {
  type: "mirror/input"
  sessionId: string
  deviceId: DevicePresetId
  event:
    | { kind: "click"; x: number; y: number; button?: number }
    | { kind: "wheel"; x: number; y: number; deltaX: number; deltaY: number }
}

export type MirrorFrameMessage = {
  type: "mirror/frame"
  sessionId: string
  deviceId: DevicePresetId
  mime: "image/jpeg"
  dataBase64: string
  capturedAt: string
}

export type MirrorStatusMessage = {
  type: "mirror/status"
  sessionId: string
  deviceId: DevicePresetId
  status: "starting" | "live" | "error"
  message?: string
}

export type MirrorMessageFromUi =
  | MirrorStartMessage
  | MirrorStopMessage
  | MirrorReloadMessage
  | MirrorInputMessage

export type MirrorMessageToUi = MirrorFrameMessage | MirrorStatusMessage
