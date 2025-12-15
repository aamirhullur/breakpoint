export type DeviceCategory = "mobile" | "tablet" | "desktop"

export type DevicePreset = {
  id: string
  label: string
  shortLabel: string
  width: number
  height: number
  pixelRatio: number
  userAgent: string
  category: DeviceCategory
  description: string
}

export const DEVICE_PRESETS: DevicePreset[] = [
  {
    id: "mobile-360x800",
    label: "Mobile 360×800",
    shortLabel: "Mobile",
    width: 360,
    height: 800,
    pixelRatio: 2,
    userAgent:
      "Mozilla/5.0 (Linux; Android 15; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36",
    category: "mobile",
    description: "Common mobile breakpoint"
  },
  {
    id: "tablet-768x1024",
    label: "Tablet 768×1024",
    shortLabel: "Tablet",
    width: 768,
    height: 1024,
    pixelRatio: 2,
    userAgent:
      "Mozilla/5.0 (iPad; CPU OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1",
    category: "tablet",
    description: "Classic tablet portrait breakpoint"
  },
  {
    id: "desktop-1920x1080",
    label: "Desktop 1920×1080",
    shortLabel: "1920px",
    width: 1920,
    height: 1080,
    pixelRatio: 1,
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    category: "desktop",
    description: "Baseline full HD desktop viewport"
  },
  {
    id: "iphone-16-pro",
    label: "iPhone 16 Pro",
    shortLabel: "iPhone",
    width: 393,
    height: 852,
    pixelRatio: 3,
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1",
    category: "mobile",
    description: "Apple flagship viewport @3x DPR"
  },
  {
    id: "pixel-9-pro",
    label: "Pixel 9 Pro",
    shortLabel: "Pixel",
    width: 412,
    height: 917,
    pixelRatio: 3,
    userAgent:
      "Mozilla/5.0 (Linux; Android 15; Pixel 9 Pro XL) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36",
    category: "mobile",
    description: "Reference Android flagship viewport"
  },
  {
    id: "ipad-mini-6",
    label: "iPad Mini 6",
    shortLabel: "iPad",
    width: 744,
    height: 1133,
    pixelRatio: 2,
    userAgent:
      "Mozilla/5.0 (iPad; CPU OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1",
    category: "tablet",
    description: "Compact tablet in portrait"
  },
  {
    id: "surface-pro-10",
    label: "Surface Pro 10",
    shortLabel: "Surface",
    width: 1024,
    height: 1366,
    pixelRatio: 2,
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    category: "tablet",
    description: "Large tablet / hybrid reference"
  },
  {
    id: "macbook-pro-14",
    label: "MacBook Pro 14”",
    shortLabel: "Laptop",
    width: 1512,
    height: 982,
    pixelRatio: 2,
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_6) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15",
    category: "desktop",
    description: "Typical wide laptop viewport"
  },
  {
    id: "desktop-1280",
    label: "Desktop 1280",
    shortLabel: "1280px",
    width: 1280,
    height: 800,
    pixelRatio: 1,
    userAgent:
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    category: "desktop",
    description: "Baseline desktop breakpoint"
  }
]

export const DEFAULT_DEVICE_IDS = [
  "mobile-360x800",
  "tablet-768x1024",
  "desktop-1920x1080"
] as const

export const DEVICE_BY_ID = Object.fromEntries(
  DEVICE_PRESETS.map((preset) => [preset.id, preset])
)
