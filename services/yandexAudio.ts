const SAMPLE_RATE = 16000;
export const MAX_AUDIO_BYTES = 60 * 1024 * 1024;

export function encodeWav(samples: Float32Array, sampleRate: number): ArrayBuffer {
    const buffer = new ArrayBuffer(44 + samples.length * 2);
    const view = new DataView(buffer);
    const write = (offset: number, text: string) => {
        for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i));
    };
    write(0, 'RIFF');
    view.setUint32(4, buffer.byteLength - 8, true);
    write(8, 'WAVE');
    write(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    write(36, 'data');
    view.setUint32(40, samples.length * 2, true);
    samples.forEach((value, i) => {
        const sample = Math.max(-1, Math.min(1, value));
        view.setInt16(44 + i * 2, Math.round(sample * (sample < 0 ? 32768 : 32767)), true);
    });
    return buffer;
}

export async function audioToWavBase64(blob: Blob): Promise<string> {
    if (!blob.size) throw new Error('Запись пуста. Запишите речь ещё раз.');
    const context = new AudioContext();
    try {
        const decoded = await context.decodeAudioData(await blob.arrayBuffer());
        const length = Math.ceil(decoded.duration * SAMPLE_RATE);
        if (44 + length * 2 > MAX_AUDIO_BYTES) throw new Error('Запись превышает лимит SpeechKit 60 МБ. Разделите её на части.');
        const offline = new OfflineAudioContext(1, length, SAMPLE_RATE);
        const source = offline.createBufferSource();
        source.buffer = decoded;
        source.connect(offline.destination);
        source.start();
        const rendered = await offline.startRendering();
        const bytes = new Uint8Array(encodeWav(rendered.getChannelData(0), SAMPLE_RATE));
        const parts: string[] = [];
        for (let i = 0; i < bytes.length; i += 8192) parts.push(String.fromCharCode(...bytes.subarray(i, i + 8192)));
        return btoa(parts.join(''));
    } finally {
        await context.close();
    }
}
