/** Сохранение Blob на диск средствами браузера. */
export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.rel = 'noopener'
  document.body.append(link)
  link.click()
  link.remove()
  // Ссылку освобождаем чуть позже, чтобы браузер успел начать скачивание.
  window.setTimeout(() => URL.revokeObjectURL(url), 2000)
}
