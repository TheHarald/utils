import { pcmLength, type PcmData } from '../pcm'

const HEADER_SIZE = 44
const BYTES_PER_SAMPLE = 2 // 16-bit PCM

function writeAscii(view: DataView, offset: number, value: string): void {
  for (let i = 0; i < value.length; i += 1) {
    view.setUint8(offset + i, value.charCodeAt(i))
  }
}

/**
 * Кодирование в WAV (PCM 16-bit) — формат без потерь, который открывают
 * все плееры и редакторы. Реализовано вручную, без внешних зависимостей.
 */
export function encodeWavBytes(pcm: PcmData): Uint8Array {
  const channels = Math.max(1, pcm.channels.length)
  const sampleCount = pcmLength(pcm)
  const blockAlign = channels * BYTES_PER_SAMPLE
  const dataSize = sampleCount * blockAlign
  const buffer = new ArrayBuffer(HEADER_SIZE + dataSize)
  const view = new DataView(buffer)

  writeAscii(view, 0, 'RIFF')
  view.setUint32(4, 36 + dataSize, true)
  writeAscii(view, 8, 'WAVE')
  writeAscii(view, 12, 'fmt ')
  view.setUint32(16, 16, true) // размер блока fmt
  view.setUint16(20, 1, true) // PCM без сжатия
  view.setUint16(22, channels, true)
  view.setUint32(24, pcm.sampleRate, true)
  view.setUint32(28, pcm.sampleRate * blockAlign, true) // байт в секунду
  view.setUint16(32, blockAlign, true)
  view.setUint16(34, 16, true) // бит на сэмпл
  writeAscii(view, 36, 'data')
  view.setUint32(40, dataSize, true)

  let offset = HEADER_SIZE
  for (let i = 0; i < sampleCount; i += 1) {
    for (let channel = 0; channel < channels; channel += 1) {
      const sample = pcm.channels[channel]?.[i] ?? 0
      const clamped = Math.max(-1, Math.min(1, sample))
      view.setInt16(offset, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true)
      offset += BYTES_PER_SAMPLE
    }
  }

  return new Uint8Array(buffer)
}

export function encodeWav(pcm: PcmData): Blob {
  const bytes = encodeWavBytes(pcm)
  return new Blob([bytes.buffer as ArrayBuffer], { type: 'audio/wav' })
}
