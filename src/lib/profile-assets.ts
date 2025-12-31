import { extractDriveFileId } from '@/lib/google-drive'

const PROFILE_ASSET_PATH = '/api/profile/assets'

export function resolveProfileAssetUrl(url: string | null) {
  if (!url) return null
  if (url.startsWith(PROFILE_ASSET_PATH)) return url

  const fileId = extractDriveFileId(url)
  if (!fileId) return url

  return `${PROFILE_ASSET_PATH}?fileId=${encodeURIComponent(fileId)}`
}
