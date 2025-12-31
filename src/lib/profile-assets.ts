import { extractDriveFileId } from '@/lib/google-drive'

const PROFILE_ASSET_PATH = '/api/profile/assets'

const formatAssetVersion = (version?: string | number | Date | null) => {
  if (!version) return null
  if (version instanceof Date) return String(version.getTime())
  return String(version)
}

export function resolveProfileAssetUrl(
  url: string | null,
  version?: string | number | Date | null
) {
  if (!url) return null
  if (url.startsWith(PROFILE_ASSET_PATH)) return url

  const fileId = extractDriveFileId(url)
  if (!fileId) return url

  const baseUrl = `${PROFILE_ASSET_PATH}?fileId=${encodeURIComponent(fileId)}`
  const versionValue = formatAssetVersion(version)
  if (!versionValue) return baseUrl
  return `${baseUrl}&v=${encodeURIComponent(versionValue)}`
}
