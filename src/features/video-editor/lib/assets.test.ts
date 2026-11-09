import { describe, expect, it } from 'vitest'
import { assetResolution, assetSummary, isVideoFile, type VideoAsset } from './assets'

function makeAsset(overrides: Partial<VideoAsset> = {}): VideoAsset {
  return {
    id: 'asset-1',
    name: 'clip.mp4',
    url: 'blob:asset-1',
    duration: 12.34,
    width: 1280,
    height: 720,
    size: 1024,
    ...overrides,
  }
}

describe('isVideoFile', () => {
  it('распознаёт видео по mime-типу', () => {
    expect(isVideoFile({ type: 'video/mp4', name: 'file' })).toBe(true)
    expect(isVideoFile({ type: 'video/webm', name: 'file' })).toBe(true)
  })

  it('смотрит на расширение, если mime пустой (drag&drop из проводника)', () => {
    expect(isVideoFile({ type: '', name: 'MOVIE.MOV' })).toBe(true)
    expect(isVideoFile({ type: '', name: 'clip.webm' })).toBe(true)
    expect(isVideoFile({ type: '', name: '.mp4' })).toBe(true)
    expect(isVideoFile({ type: '', name: 'notes.txt' })).toBe(false)
  })

  it('не пропускает файлы с другим mime, даже если расширение видео', () => {
    expect(isVideoFile({ type: 'image/png', name: 'shot.mp4' })).toBe(false)
    expect(isVideoFile({ type: 'application/pdf', name: 'doc.pdf' })).toBe(false)
  })
})

describe('подписи файла', () => {
  it('показывает разрешение', () => {
    expect(assetResolution(makeAsset())).toBe('1280×720')
  })

  it('сообщает, если браузер не дал размеры', () => {
    expect(assetResolution(makeAsset({ width: 0, height: 0 }))).toBe('размер неизвестен')
  })

  it('собирает компактную подпись с длительностью', () => {
    expect(assetSummary(makeAsset())).toBe('1280×720 · 0:12.3')
  })
})
