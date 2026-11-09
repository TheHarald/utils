import { describe, expect, it } from 'vitest'
import { createPcm, type PcmData } from '../pcm'
import { encodeMp3, estimateMp3Bytes } from './mp3'

const sampleRate = 44100

/** Тон 440 Гц заданной длительности; амплитуда специально умеренная. */
function makeTone(seconds: number, channels = 1): PcmData {
  const length = Math.round(sampleRate * seconds)
  const pcm = createPcm(sampleRate, channels, length)
  for (let i = 0; i < length; i += 1) {
    const value = Math.sin((2 * Math.PI * 440 * i) / sampleRate) * 0.5
    for (const channel of pcm.channels) channel[i] = value
  }
  return pcm
}

async function toBytes(blob: Blob): Promise<Uint8Array> {
  return new Uint8Array(await blob.arrayBuffer())
}

function hasFrameSync(bytes: Uint8Array): boolean {
  for (let i = 0; i < bytes.length - 1; i += 1) {
    if (bytes[i] === 0xff && (bytes[i + 1] & 0xe0) === 0xe0) return true
  }
  return false
}

describe('encodeMp3', () => {
  it('на пустых данных отдаёт пустой Blob', async () => {
    const blob = encodeMp3(createPcm(sampleRate, 1, 0), 128)
    expect(blob.type).toBe('audio/mpeg')
    expect(blob.size).toBe(0)
  })

  it('кодирует секунду моно в валидный MPEG-поток', async () => {
    const blob = encodeMp3(makeTone(1), 128)
    const bytes = await toBytes(blob)

    expect(blob.type).toBe('audio/mpeg')
    expect(bytes.length).toBeGreaterThan((128_000 / 8) * 0.8)
    expect(bytes.length).toBeLessThan((128_000 / 8) * 1.4)
    expect(hasFrameSync(bytes)).toBe(true)
  })

  it('чем выше битрейт, тем больше файл', async () => {
    const tone = makeTone(0.5)
    const low = encodeMp3(tone, 128).size
    const high = encodeMp3(tone, 320).size
    expect(high).toBeGreaterThan(low)
    expect(low).toBeGreaterThan(0)
  })

  it('кодирует стерео и не больше двух каналов', async () => {
    const stereo = encodeMp3(makeTone(0.2, 2), 192)
    const multi = encodeMp3(makeTone(0.2, 3), 192)

    expect(stereo.type).toBe('audio/mpeg')
    expect(stereo.size).toBeGreaterThan(0)
    expect(hasFrameSync(await toBytes(stereo))).toBe(true)
    // Третий канал отбрасывается — результат совпадает со стерео.
    expect(multi.size).toBe(stereo.size)
  })
})

describe('estimateMp3Bytes', () => {
  it('считает по битрейту и длительности', () => {
    expect(estimateMp3Bytes(makeTone(1), 128)).toBe(16_000)
    expect(estimateMp3Bytes(makeTone(1), 320)).toBe(40_000)
    expect(estimateMp3Bytes(makeTone(2), 192)).toBe(48_000)
  })

  it('не делит на ноль при неизвестной частоте', () => {
    const pcm: PcmData = { sampleRate: 0, channels: [new Float32Array(8000)] }
    expect(estimateMp3Bytes(pcm, 128)).toBe(Math.round((128_000 * 8000) / 8))
  })
})
