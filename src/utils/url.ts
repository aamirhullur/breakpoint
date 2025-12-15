const LOCALHOST_RLIKE = /^(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1])/i

export const normalizeTargetUrl = (raw: string): string => {
  const trimmed = raw.trim()
  if (!trimmed) {
    throw new Error("Enter a URL to preview")
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed
  }

  if (LOCALHOST_RLIKE.test(trimmed)) {
    return `http://${trimmed}`
  }

  try {
    const url = new URL(trimmed.startsWith("//") ? `https:${trimmed}` : trimmed)
    return url.toString()
  } catch {
    return `https://${trimmed}`
  }
}
