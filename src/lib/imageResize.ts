export const THUMBNAIL_MAX_DIM = 480
export const THUMBNAIL_QUALITY = 0.7

// Redimensionne une image côté navigateur (Canvas) — utilisé pour générer des
// miniatures légères de la galerie sans dépendre de la transformation d'image
// Supabase Storage (non disponible sur ce projet).
export async function resizeImageToBlob(source: Blob, maxDim: number, quality: number): Promise<Blob> {
  const bitmap = await createImageBitmap(source)
  const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height))
  const width = Math.round(bitmap.width * scale)
  const height = Math.round(bitmap.height * scale)

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas non supporté par ce navigateur')
  ctx.drawImage(bitmap, 0, 0, width, height)

  const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', quality))
  if (!blob) throw new Error('Compression impossible')
  return blob
}
