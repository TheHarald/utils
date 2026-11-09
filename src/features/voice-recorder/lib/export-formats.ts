import { getSupportedNativeFormats, type NativeFormat } from './encoders/native'
import type { Mp3Bitrate } from './encoders/mp3'

export type ExportFormatKind = 'wav' | 'mp3' | 'native'

export interface ExportFormat {
  id: string
  label: string
  description: string
  extension: string
  kind: ExportFormatKind
  /** Заполнено только для форматов, которые пишет MediaRecorder. */
  native?: NativeFormat
}

export const MP3_BITRATES: Mp3Bitrate[] = [128, 192, 320]

function buildExportFormats(): ExportFormat[] {
  const formats: ExportFormat[] = [
    {
      id: 'wav',
      label: 'WAV',
      description: 'Без потерь, 16-bit PCM — подходит для монтажа',
      extension: 'wav',
      kind: 'wav',
    },
    {
      id: 'mp3',
      label: 'MP3',
      description: 'Самый совместимый формат, битрейт на выбор',
      extension: 'mp3',
      kind: 'mp3',
    },
  ]

  for (const native of getSupportedNativeFormats()) {
    formats.push({
      id: native.id,
      label: native.label,
      description: native.description,
      extension: native.extension,
      kind: 'native',
      native,
    })
  }

  return formats
}

/** Список форматов, доступных в текущем браузере. */
export const EXPORT_FORMATS: ExportFormat[] = buildExportFormats()

export function findExportFormat(id: string): ExportFormat | undefined {
  return EXPORT_FORMATS.find((format) => format.id === id)
}
