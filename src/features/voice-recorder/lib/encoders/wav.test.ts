import { describe, expect, it } from 'vitest'
import { createPcm, type PcmData } from '../pcm'
import { encodeWav, encodeWavBytes } from './wav'

const HEADER_SIZE = 44
const sampleRate = 8000

function ascii(bytes: Uint8Array, from: number, to: number): string {
  return String.fromCharCode(...bytes.slice(from, to))
}

function dataView(bytes: Uint8Array): DataView {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
}

function makePcm(samples: number[]): PcmData {
  const pcm = createPcm(sampleRate, 1, samples.length)
  pcm.channels[0].set(samples)
  return pcm
}

describe('WAV-заголовок', () => {
  it('содержит RIFF/WAVE/fmt/data и корректные размеры', () => {
    const bytes = encodeWavBytes(makePcm(new Array(8000).fill(0)))
    const view = dataView(bytes)

    expect(ascii(bytes, 0, 4)).toBe('RIFF')
    expect(ascii(bytes, 8, 12)).toBe('WAVE')
    expect(ascii(bytes, 12, 16)).toBe('fmt ')
    expect(ascii(bytes, 36, 40)).toBe('data')
    expect(view.getUint32(4, true)).toBe(36 + 8000 * 2)
    expect(view.getUint32(16, true)).toBe(16)
    expect(view.getUint16(20, true)).toBe(1) // PCM
    expect(view.getUint16(22, true)).toBe(1) // моно
    expect(view.getUint32(24, true)).toBe(sampleRate)
    expect(view.getUint32(28, true)).toBe(sampleRate * 2) // байт в секунду
    expect(view.getUint16(32, true)).toBe(2) // block align
    expect(view.getUint16(34, true)).toBe(16) // бит на сэмпл
    expect(view.getUint32(40, true)).toBe(8000 * 2)
    expect(bytes).toHaveLength(HEADER_SIZE + 8000 * 2)
  })

  it('пишет стерео с чередованием каналов', () => {
    const stereo = createPcm(sampleRate, 2, 2)
    stereo.channels[0].set([1, 1])
    stereo.channels[1].set([-1, -1])
    const bytes = encodeWavBytes(stereo)
    const view = dataView(bytes)

    expect(view.getUint16(22, true)).toBe(2)
    expect(view.getUint16(32, true)).toBe(4)
    expect(bytes).toHaveLength(HEADER_SIZE + 2 * 4)
    expect(view.getInt16(44, true)).toBe(32767) // L
    expect(view.getInt16(46, true)).toBe(-32768) // R
    expect(view.getInt16(48, true)).toBe(32767) // L
    expect(view.getInt16(50, true)).toBe(-32768) // R
  })
})

describe('WAV-сэмплы', () => {
  it('переводит float в 16 бит и обрезает выход за пределы', () => {
    const bytes = encodeWavBytes(makePcm([0, 0.5, -0.5, 1, -1, 2, -2]))
    const view = dataView(bytes)
    const samples = Array.from({ length: 7 }, (_, index) => view.getInt16(HEADER_SIZE + index * 2, true))

    expect(samples).toEqual([0, 16383, -16384, 32767, -32768, 32767, -32768])
  })

  it('на пустых данных отдаёт только заголовок', () => {
    const bytes = encodeWavBytes({ sampleRate, channels: [] })
    expect(bytes).toHaveLength(HEADER_SIZE)
    expect(dataView(bytes).getUint32(40, true)).toBe(0)
  })
})

describe('encodeWav', () => {
  it('возвращает Blob с типом audio/wav', () => {
    const blob = encodeWav(makePcm(new Array(100).fill(0)))
    expect(blob.type).toBe('audio/wav')
    expect(blob.size).toBe(HEADER_SIZE + 100 * 2)
  })
})
