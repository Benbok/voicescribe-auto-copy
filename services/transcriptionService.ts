import type { TranscriptionMode, TranscriptionProvider } from '../types';
import { transcribeYandex, checkYandexHealth } from './yandexService';
import { transcribeAudio as transcribeGemini, checkGeminiHealth } from './geminiService';

export function getTranscriptionProvider(): TranscriptionProvider {
    return localStorage.getItem('TRANSCRIPTION_PROVIDER') === 'gemini' ? 'gemini' : 'yandex';
}

export function setTranscriptionProvider(provider: TranscriptionProvider): void {
    localStorage.setItem('TRANSCRIPTION_PROVIDER', provider);
}

export async function transcribeAudio(audio: Blob, mode: TranscriptionMode = 'general') {
    if (getTranscriptionProvider() === 'yandex') return transcribeYandex(audio, mode);
    return transcribeGemini(audio, mode);
}

export async function checkProviderHealth() {
    if (getTranscriptionProvider() === 'yandex') return checkYandexHealth();
    return checkGeminiHealth();
}
