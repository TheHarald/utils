import { describe, expect, it } from 'vitest'
import { clonePcm, createPcm, pcmDuration, pcmLength, pcmToMono } from './pcm'

describe('createPcm', () => {
  it('создаёт нужное число каналов и обнуляет их', () => {
    const pcm = createPcm(44100, 2, 100)
    expect(pcm.sampleRate).toBe(44100)
    expect(pcm.channels).toHaveLength(2)
    expect(pcm.channels[0]).toBeInstanceOf(Float32Array)
    expect(pcm.channels[0]).toHaveLength(100)
    expect(Array.from(pcm.channels[1])).toEqual(new Array(100).fill(0))
    // Каналы не должны делить один буфер.
    expect(pcm.channels[0]).not.toBe(pcm.channels[1])
  })
})

describe('pcmLength / pcmDuration', () => {
  it('считает длину по первому каналу', () => {
    const pcm = createPcm(8000, 1, 4000)
    expect(pcmLength(pcm)).toBe(4000)
    expect(pcmDuration(pcm)).toBe(0.5)
  })

  it('не падает на пустых данных и нулевом sampleRate', () => {
    expect(pcmLength({ sampleRate: 8000, channels: [] })).toBe(0)
    expect(pcmDuration({ sampleRate: 8000, channels: [] })).toBe(0)
    expect(pcmDuration({ sampleRate: 0, channels: [new Float32Array(10)] })).toBe(10)
  })
})

describe('clonePcm', () => {
  it('копирует данные, а не ссылки', () => {
    const pcm = createPcm(8000, 1, 4)
    pcm.channels[0][0] = 0.5
    const copy = clonePcm(pcm)
    copy.channels[0][0] = -0.5
    expect(pcm.channels[0][0]).toBe(0.5)
    expect(copy.channels[0][0]).toBe(-0.5)
    expect(copy.sampleRate).toBe(8000)
  })
})

describe('pcmToMono', () => {
  it('усредняет каналы', () => {
    const mono = pcmToMono({
      sampleRate: 8000,
      channels: [Float32Array.from([1, 0.5, -1]), Float32Array.from([0, 0.5, 0])],
    })
    expect(Array.from(mono)).toEqual([0.5, 0.5, -0.5])
  })

  it('возвращает тишину, если каналов нет', () => {
    const mono = pcmToMono({ sampleRate: 8000, channels: [] })
    expect(mono).toHaveLength(0)
  })
})
