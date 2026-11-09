/**
 * Аудиоданные в «сыром» виде: набор каналов Float32 (−1…1).
 * Все преобразования (обрезка, усиление, фейды) работают с этой структурой,
 * поэтому их легко тестировать отдельно от Web Audio API.
 */
export interface PcmData {
  sampleRate: number
  channels: Float32Array[]
}

export function pcmLength(pcm: PcmData): number {
  return pcm.channels[0]?.length ?? 0
}

export function pcmDuration(pcm: PcmData): number {
  const rate = pcm.sampleRate || 1
  return pcmLength(pcm) / rate
}

export function createPcm(sampleRate: number, channelCount: number, length: number): PcmData {
  const channels: Float32Array[] = []
  for (let channel = 0; channel < channelCount; channel += 1) {
    channels.push(new Float32Array(length))
  }
  return { sampleRate, channels }
}

export function clonePcm(pcm: PcmData): PcmData {
  return {
    sampleRate: pcm.sampleRate,
    channels: pcm.channels.map((data) => new Float32Array(data)),
  }
}

/** AudioBuffer → PcmData (данные копируются, буфер дальше можно отпускать). */
export function pcmFromAudioBuffer(buffer: AudioBuffer): PcmData {
  const channels: Float32Array[] = []
  for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
    channels.push(new Float32Array(buffer.getChannelData(channel)))
  }
  return { sampleRate: buffer.sampleRate, channels }
}

/** PcmData → AudioBuffer для проигрывания через Web Audio API. */
export function pcmToAudioBuffer(context: BaseAudioContext, pcm: PcmData): AudioBuffer {
  const length = Math.max(1, pcmLength(pcm))
  const channelCount = Math.max(1, pcm.channels.length)
  const buffer = context.createBuffer(channelCount, length, pcm.sampleRate)
  pcm.channels.forEach((data, index) => {
    buffer.copyToChannel(new Float32Array(data), index)
  })
  return buffer
}

/** Микширование в моно: используется для волны, анализа пиков и уровня. */
export function pcmToMono(pcm: PcmData): Float32Array {
  const length = pcmLength(pcm)
  const mono = new Float32Array(length)
  const channels = pcm.channels
  if (channels.length === 0) return mono
  for (let i = 0; i < length; i += 1) {
    let sum = 0
    for (let channel = 0; channel < channels.length; channel += 1) {
      sum += channels[channel][i]
    }
    mono[i] = sum / channels.length
  }
  return mono
}
