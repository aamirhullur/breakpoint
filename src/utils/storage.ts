export const setSessionStorage = async (
  key: string,
  value: unknown
): Promise<void> => {
  if (!chrome?.storage?.session) {
    return
  }
  await chrome.storage.session.set({ [key]: value })
}

export const getSessionStorage = async <T>(
  key: string
): Promise<T | undefined> => {
  if (!chrome?.storage?.session) {
    return undefined
  }
  const data = await chrome.storage.session.get(key)
  return data?.[key] as T | undefined
}

export const removeSessionStorage = async (key: string): Promise<void> => {
  if (!chrome?.storage?.session) {
    return
  }
  await chrome.storage.session.remove(key)
}

export const setSyncStorage = async (
  key: string,
  value: unknown
): Promise<void> => {
  if (!chrome?.storage?.sync) {
    return
  }
  await chrome.storage.sync.set({ [key]: value })
}

export const getSyncStorage = async <T>(
  key: string
): Promise<T | undefined> => {
  if (!chrome?.storage?.sync) {
    return undefined
  }
  const data = await chrome.storage.sync.get(key)
  return data?.[key] as T | undefined
}
