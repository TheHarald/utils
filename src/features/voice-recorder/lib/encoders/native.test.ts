import { afterEach, describe, expect, it, vi } from 'vitest'
import { createPcm } from '../pcm'
import {
  encodeWithMediaRecorder,
  getSupportedNativeFormats,
  isMediaRecorderSupported,
  type NativeFormat,
} from './native'

/** Подменяет window.MediaRecorder минимальным стендом. */
function stubMediaRecorder(supported: string[]): void {
  vi.stubGlobal('window', {
    MediaRecorder: {
      isTypeSupported: (type: string) => supported.includes(type),
    },
  })
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('isMediaRecorderSupported', () => {
  it('в Node без window возвращает false', () => {
    expect(isMediaRecorderSupported()).toBe(false)
    expect(getSupportedNativeFormats()).toEqual([])
  })

  it('требует функцию isTypeSupported', () => {
    vi.stubGlobal('window', { MediaRecorder: class {} })
    expect(isMediaRecorderSupported()).toBe(false)
  })
})

describe('getSupportedNativeFormats', () => {
  it('оставляет только форматы, которые умеет браузер', () => {
    stubMediaRecorder(['audio/ogg;codecs=opus'])
    expect(getSupportedNativeFormats().map((format) => format.id)).toEqual(['ogg'])
  })

  it('поддерживает несколько форматов и сохраняет порядок', () => {
    stubMediaRecorder(['audio/webm;codecs=opus', 'audio/mp4'])
    expect(getSupportedNativeFormats().map((format) => format.id)).toEqual(['webm', 'm4a'])
  })

  it('возвращает пустой список, если ни один mime-тип не подходит', () => {
    stubMediaRecorder([])
    expect(getSupportedNativeFormats()).toEqual([])
  })
})

describe('encodeWithMediaRecorder', () => {
  const ogg: NativeFormat = {
    id: 'ogg',
    label: 'OGG (Opus)',
    description: 'Открытый формат',
    extension: 'ogg',
    mimeTypes: ['audio/ogg;codecs=opus'],
  }

  it('бросает понятную ошибку для неподдерживаемого формата', async () => {
    stubMediaRecorder([])
    await expect(encodeWithMediaRecorder(createPcm(8000, 1, 100), ogg)).rejects.toThrow(
      'не поддерживается этим браузером',
    )
  })

  it('не пытается кодировать пустую запись', async () => {
    stubMediaRecorder(['audio/ogg;codecs=opus'])
    await expect(encodeWithMediaRecorder(createPcm(8000, 1, 0), ogg)).rejects.toThrow(
      'Нечего кодировать',
    )
  })
})
