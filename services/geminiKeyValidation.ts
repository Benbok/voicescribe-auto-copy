export type KeyValidationResult = { status: 'ok' | 'error'; message: string };

// Validate a draft key without changing the active client or saving credentials.
export async function validateGeminiApiKey(
    key: string,
    request: typeof fetch = fetch,
): Promise<KeyValidationResult> {
    const trimmedKey = key.trim();
    const error = (message: string): KeyValidationResult => ({ status: 'error', message });
    if (!trimmedKey) return error('Введите API-ключ для проверки.');

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    try {
        const response = await request('https://generativelanguage.googleapis.com/v1beta/models', {
            headers: { 'x-goog-api-key': trimmedKey },
            signal: controller.signal,
        });
        if (response.status === 400 || response.status === 401) {
            return error('Gemini отклонил API-ключ. Проверьте правильность ключа.');
        }
        if (response.status === 403) {
            return error('Доступ запрещён. Проверьте ограничения ключа, доступ к Gemini API и регион.');
        }
        if (response.status === 429) {
            return error('Превышен лимит запросов Gemini. Повторите проверку позже.');
        }
        if (!response.ok) return error('Сервис Gemini временно недоступен. Повторите проверку позже.');

        const data = await response.json();
        if (!Array.isArray(data.models) || data.models.length === 0) {
            return error('Для этого ключа нет доступных моделей Gemini.');
        }
        return { status: 'ok', message: 'Ключ принят Gemini, список моделей доступен. Доступ к выбранной модели проверяется при транскрибации.' };
    } catch {
        return error(controller.signal.aborted
            ? 'Время проверки истекло. Повторите попытку.'
            : 'Не удалось связаться с Gemini. Проверьте интернет-соединение.');
    } finally {
        clearTimeout(timeout);
    }
}
