type TranscribeOptions = {
    apiKey: string;
    model: string;
    mimeType: string;
    base64Audio: string;
};

type Content = { type?: string; text?: string };
type InteractionResult = {
    status?: string;
    output_text?: string;
    outputs?: Content[];
    steps?: Array<{ type?: string; content?: Content[] }>;
};

export const usesTranscriptionApi = (model: string): boolean => model === 'gemini-3.5-transcribe';

export async function transcribeWithInteractions(
    options: TranscribeOptions,
    request: typeof fetch = fetch,
): Promise<string> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 120000);
    try {
        const response = await request('https://generativelanguage.googleapis.com/v1beta/interactions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-goog-api-key': options.apiKey },
            signal: controller.signal,
            body: JSON.stringify({
                model: options.model,
                input: [{ type: 'audio', data: options.base64Audio, mime_type: options.mimeType.split(';')[0].trim() }],
                generation_config: { transcription_config: { mode: 'smart' } },
                store: false,
            }),
        });
        if (!response.ok) {
            throw Object.assign(new Error(`Gemini Interactions API: HTTP ${response.status}.`), { status: response.status });
        }
        const result: InteractionResult = await response.json();
        if (result.status && result.status !== 'completed') {
            throw new Error(`Gemini не завершил транскрибацию (status=${result.status}). Повторите запись.`);
        }
        // output_text is the SDK convenience field; REST returns model_output steps.
        const content = result.steps
            ? result.steps.filter((step) => step.type === 'model_output').flatMap((step) => step.content || [])
            : result.outputs || [];
        const text = (result.output_text || content
            .filter((part) => part.type === 'text')
            .map((part) => part.text || '')
            .join('')).trim();
        if (!text) throw new Error('Gemini не вернул текст транскрипции. Проверьте, что в записи есть слышимая речь, и повторите попытку.');
        return text;
    } catch (error) {
        if (controller.signal.aborted) throw new Error('Истекло время ожидания транскрибации Gemini. Повторите попытку.');
        if (error instanceof TypeError) throw new Error('Не удалось связаться с Gemini Interactions API. Проверьте интернет-соединение.');
        throw error;
    } finally {
        clearTimeout(timeout);
    }
}
