import { getDownloadURL, ref, uploadBytes } from 'firebase/storage'
import { firebaseEnabled, storage } from './firebase'
import type { MessageAttachment } from './types'

export const MAX_ATTACHMENT_BYTES = firebaseEnabled ? 10 * 1024 * 1024 : 700 * 1024
export const MAX_ATTACHMENT_LABEL = firebaseEnabled ? '10MB' : '700KB'
// When Storage upload fails, files up to this size fall back to inline storage
const INLINE_FALLBACK_BYTES = 700 * 1024

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

export type AttachmentResult = { ok: true; attachment: MessageAttachment } | { ok: false; error: string }

/**
 * Turn a File into an attachment: upload to Cloud Storage when available,
 * fall back to an inline data URL for small files (Firestore 1MB doc cap).
 */
export async function processAttachmentFile(file: File): Promise<AttachmentResult> {
  if (file.size > MAX_ATTACHMENT_BYTES) {
    return { ok: false, error: `הקובץ "${file.name}" גדול מדי (מקסימום ${MAX_ATTACHMENT_LABEL})` }
  }

  const base = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    name: file.name,
    mimeType: file.type || 'application/octet-stream',
    size: file.size,
  }

  if (storage) {
    try {
      const storageRef = ref(storage, `attachments/${base.id}-${file.name}`)
      await uploadBytes(storageRef, file)
      const url = await getDownloadURL(storageRef)
      return { ok: true, attachment: { ...base, url } }
    } catch {
      if (file.size > INLINE_FALLBACK_BYTES) {
        return {
          ok: false,
          error: `העלאת "${file.name}" נכשלה — קבצים מעל 700KB דורשים הפעלת Storage בקונסולת Firebase`,
        }
      }
      // fall through to inline
    }
  }

  try {
    const dataUrl = await readFileAsDataUrl(file)
    return { ok: true, attachment: { ...base, dataUrl } }
  } catch {
    return { ok: false, error: `לא ניתן לקרוא את הקובץ "${file.name}"` }
  }
}

/** Extract pasted image files from a clipboard event, renaming generic screenshots. */
export function filesFromClipboard(clipboardData: DataTransfer | null): File[] {
  return Array.from(clipboardData?.items ?? [])
    .filter((item) => item.kind === 'file')
    .map((item) => item.getAsFile())
    .filter((f): f is File => f !== null)
    .map((f) => {
      if (/^image\.\w+$/i.test(f.name)) {
        const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')
        const ext = f.type.split('/')[1] || 'png'
        return new File([f], `screenshot-${stamp}.${ext}`, { type: f.type })
      }
      return f
    })
}
