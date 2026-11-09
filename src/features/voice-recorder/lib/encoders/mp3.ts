import { Mp3Encoder } from '@breezystack/lamejs'
import { pcmLength, type PcmData } from '../pcm'

export type Mp3Bitrate = 128 | 192 | 320

/** Количество сэмплов в одном MPEG-фрейме для Layer III. */
const FRAME_SIZE = 1152

function floatToInt16(data: Float32Array): Int16Array {
  const output = new Int16Array(data.length)
  for (let i = 0; i < data.length; i += 1) {
    const sample = Math.max(-1, Math.min(1, data[i]))
    output[i] = sample < 0 ? sample * 0x8000 : sample * 0x7fff
  }
  return output
}

/**
 * Кодирование в MP3 через lamejs. Работает во всех современных браузерах
 * и не требует реального времени (в отличие от MediaRecorder).
 */
export function encodeMp3(pcm: PcmData, bitrate: Mp3Bitrate = 192): Blob {
  const channelCount = Math.min(Math.max(1, pcm.channels.length), 2)
  const length = pcmLength(pcm)
  if (length === 0) {
    return new Blob([], { type: 'audio/mpeg' })
  }

  const encoder = new Mp3Encoder(channelCount, pcm.sampleRate, bitrate)
  const left = floatToInt16(pcm.channels[0])
  const right = channelCount > 1 ? floatToInt16(pcm.channels[1]) : null
  const parts: ArrayBuffer[] = []

  for (let offset = 0; offset < left.length; offset += FRAME_SIZE) {
    const leftChunk = left.subarray(offset, offset + FRAME_SIZE)
    const encoded = right
      ? encoder.encodeBuffer(leftChunk, right.subarray(offset, offset + FRAME_SIZE))
      : encoder.encodeBuffer(leftChunk)
    if (encoded.length > 0) {
      parts.push(new Uint8Array(encoded).buffer as ArrayBuffer)
    }
  }

  const tail = encoder.flush()
  if (tail.length > 0) {
    parts.push(new Uint8Array(tail).buffer as ArrayBuffer)
  }

  return new Blob(parts, { type: 'audio/mpeg' })
}

/** Оценка размера MP3 — показываем пользователю до скачивания. */
export function estimateMp3Bytes(pcm: PcmData, bitrate: Mp3Bitrate): number {
  const seconds = pcmLength(pcm) / (pcm.sampleRate || 1)
  return Math.round((bitrate * 1000 * seconds) / 8)
}
