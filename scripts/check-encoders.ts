import { computePeaks, applyGain, fadePcm, normalizePcm, pcmPeak, trimPcm } from '../src/features/voice-recorder/lib/audio-edit'
import { createPcm, pcmDuration } from '../src/features/voice-recorder/lib/pcm'
import { encodeMp3 } from '../src/features/voice-recorder/lib/encoders/mp3'
import { encodeWavBytes } from '../src/features/voice-recorder/lib/encoders/wav'

/**
 * Быстрая проверка аудио-ядра без браузера: заголовки WAV/MP3 и базовые правки.
 * Запуск: npm run check:audio
 */

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

function ascii(bytes: Uint8Array, from: number, to: number): string {
  return String.fromCharCode(...bytes.slice(from, to))
}

const sampleRate = 8000
const pcm = createPcm(sampleRate, 1, sampleRate)
for (let i = 0; i < pcm.channels[0].length; i += 1) {
  pcm.channels[0][i] = Math.sin((2 * Math.PI * 440 * i) / sampleRate) * 0.5
}

// WAV: заголовок RIFF/WAVE, корректные размеры и 16 бит на сэмпл.
const wav = encodeWavBytes(pcm)
const view = new DataView(wav.buffer, wav.byteOffset, wav.byteLength)
assert(ascii(wav, 0, 4) === 'RIFF', 'WAV должен начинаться с RIFF')
assert(ascii(wav, 8, 12) === 'WAVE', 'Далее должен идти WAVE')
assert(ascii(wav, 36, 40) === 'data', 'Блок data должен находиться по смещению 36')
assert(view.getUint16(22, true) === 1, 'WAV должен быть моно')
assert(view.getUint32(24, true) === sampleRate, 'Частота дискретизации должна сохраняться')
assert(view.getUint16(34, true) === 16, 'WAV должен быть 16-битным')
assert(wav.length === 44 + sampleRate * 2, `Неверный размер WAV: ${wav.length}`)
assert(view.getUint32(40, true) === sampleRate * 2, 'Неверный размер блока data')

// MP3: должны присутствовать MPEG frame sync (0xFF 0xEx).
const mp3Blob = encodeMp3(pcm, 128)
const mp3 = new Uint8Array(await mp3Blob.arrayBuffer())
assert(mp3.length > 400, `MP3 слишком маленький: ${mp3.length} байт`)
let hasFrameSync = false
for (let i = 0; i < mp3.length - 1; i += 1) {
  if (mp3[i] === 0xff && (mp3[i + 1] & 0xe0) === 0xe0) {
    hasFrameSync = true
    break
  }
}
assert(hasFrameSync, 'В MP3 не найден frame sync')
assert(mp3Blob.type === 'audio/mpeg', 'Неверный mime-тип MP3')

// Правки: обрезка, усиление, нормализация, фейды и пики.
assert(pcmDuration(pcm) === 1, 'Длительность исходника должна быть 1 секунда')
const trimmed = trimPcm(pcm, 0.25, 0.75)
assert(trimmed.channels[0].length === sampleRate / 2, 'Обрезка вернула неверную длину')

const normalizedPeak = pcmPeak(normalizePcm(trimmed))
assert(normalizedPeak > 0.85 && normalizedPeak <= 1, `Нормализация дала пик ${normalizedPeak}`)

const quieter = applyGain(trimmed, 0.5)
assert(pcmPeak(quieter) < pcmPeak(trimmed), 'Ослабление должно уменьшать пик')

const faded = fadePcm(pcm, 0.1, 0.1)
const last = faded.channels[0].length - 1
assert(Math.abs(faded.channels[0][0]) < 0.01, 'Fade in должен начинаться с тишины')
assert(Math.abs(faded.channels[0][last]) < 0.01, 'Fade out должен заканчиваться тишиной')

const peaks = computePeaks(pcm, 32)
assert(peaks.length === 32, 'computePeaks вернул неверное число бинов')
assert(
  peaks.every((value) => value >= 0 && value <= 1),
  'Пики должны быть в диапазоне 0…1',
)

console.log('OK: аудио-ядро работает как ожидается')
console.log(`WAV ${wav.length} Б · MP3 ${mp3.length} Б · пик после нормализации ${normalizedPeak.toFixed(3)}`)
