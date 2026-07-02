const fs = require('fs');
const path = require('path');
const { GoogleAuth } = require('google-auth-library');

const { normalizeAudioForTranscription, transcribeWithWhisper } = require('./audio-utils');
const { RECORDING_TRANSCRIPTION_FIELDS, lastNameTranscriptionNeeded } = require('./order-schema');
const { downloadRecording } = require('./yemot-recordings');

const GOOGLE_SPEECH_URL = 'https://speech.googleapis.com/v1p1beta1/speech:recognize';
const OPENAI_TRANSCRIPTIONS_URL = 'https://api.openai.com/v1/audio/transcriptions';
const OPENAI_CHAT_COMPLETIONS_URL = 'https://api.openai.com/v1/chat/completions';
const DEEPGRAM_LISTEN_URL = 'https://api.deepgram.com/v1/listen';

const HEBREW_LETTER_ALIASES = {
    א: ['א', 'אלף'],
    ב: ['ב', 'בית', 'בייט'],
    ג: ['ג', 'גימל'],
    ד: ['ד', 'דלת'],
    ה: ['ה', 'הא', 'הי'],
    ו: ['ו', 'וו', 'ואו'],
    ז: ['ז', 'זין'],
    ח: ['ח', 'חית'],
    ט: ['ט', 'טית'],
    י: ['י', 'יוד'],
    כ: ['כ', 'כף', 'חף', 'כף סופית'],
    ל: ['ל', 'למד'],
    מ: ['מ', 'מם', 'מם סופית'],
    נ: ['נ', 'נון', 'נון סופית', 'אינסופי', 'אינסופית', 'ינסופי', 'נונסופיס', 'nonsofit', 'nonsofit'],
    ס: ['ס', 'סמך'],
    ע: ['ע', 'עין'],
    פ: ['פ', 'פה', 'פה סופית', 'פא סופית'],
    צ: ['צ', 'צדי', 'צדיק', 'צדי סופית', 'צדיק סופית'],
    ק: ['ק', 'קוף'],
    ר: ['ר', 'ריש', 'רייש'],
    ש: ['ש', 'שין'],
    ת: ['ת', 'תו', 'תיו']
};

const ENGLISH_LETTER_ALIASES = {
    A: ['a', 'ay', 'ei'],
    B: ['b', 'bee', 'be'],
    C: ['c', 'cee', 'see'],
    D: ['d', 'dee'],
    E: ['e', 'ee'],
    F: ['f', 'ef'],
    G: ['g', 'gee'],
    H: ['h', 'aitch', 'haitch'],
    I: ['i', 'eye'],
    J: ['j', 'jay'],
    K: ['k', 'kay'],
    L: ['l', 'el'],
    M: ['m', 'em'],
    N: ['n', 'en'],
    O: ['o', 'oh'],
    P: ['p', 'pee'],
    Q: ['q', 'cue', 'queue'],
    R: ['r', 'ar'],
    S: ['s', 'ess'],
    T: ['t', 'tee'],
    U: ['u', 'you', 'yew'],
    V: ['v', 'vee'],
    W: ['w', 'doubleu', 'doubleyou', 'double you', 'double u'],
    X: ['x', 'ex'],
    Y: ['y', 'why'],
    Z: ['z', 'zee', 'zed']
};

const HEBREW_FINAL_FORM_MAP = {
    כ: 'ך',
    מ: 'ם',
    נ: 'ן',
    פ: 'ף',
    צ: 'ץ'
};

const HEBREW_BASE_FORM_MAP = {
    ך: 'כ',
    ם: 'מ',
    ן: 'נ',
    ף: 'פ',
    ץ: 'צ'
};

const PROFILE_BY_FIELD = {
    lastNameRecording: {
        languageCode: 'he-IL',
        hints: ['רווח', 'מקף', 'קו מפריד', 'סופית'],
        deepgramKeyterms: [
            'אלף', 'בית', 'גימל', 'דלת', 'הא', 'וו', 'ויו', 'זין', 'חית', 'טית',
            'יוד', 'כף', 'למד', 'מם', 'נון', 'סמך', 'עין', 'פא', 'צדי', 'קוף',
            'ריש', 'שין', 'תו', 'כף סופית', 'מם סופית', 'נון סופית', 'פא סופית',
            'צדי סופית', 'רווח', 'מקף', 'סופית'
        ],
        openAiPrompt: [
            'This is a noisy phone-call recording of a Hebrew family name (surname) being spelled letter by letter.',
            'Prefer spelled Hebrew letter names such as אלף, בית, גימל, דלת, הא, וו, זין, חית, טית, יוד, כף, למד, מם, נון, סמך, עין, פא, צדי, קוף, ריש, שין, תו.',
            'Keep spoken separator words like רווח, מקף, and final-form words like כף סופית, נון סופית, מם סופית, פא סופית, צדי סופית when they are said.',
            'Return only the transcription of what was spoken.'
        ].join(' '),
        normalize: normalizeHebrewSpelling
    },
    hebrewNameRecording: {
        languageCode: 'he-IL',
        hints: ['רווח', 'מקף', 'קו מפריד', 'סופית'],
        deepgramKeyterms: [
            'אלף', 'בית', 'גימל', 'דלת', 'הא', 'וו', 'ויו', 'זין', 'חית', 'טית',
            'יוד', 'כף', 'למד', 'מם', 'נון', 'סמך', 'עין', 'פא', 'צדי', 'קוף',
            'ריש', 'שין', 'תו', 'כף סופית', 'מם סופית', 'נון סופית', 'פא סופית',
            'צדי סופית', 'רווח', 'מקף', 'סופית'
        ],
        openAiPrompt: [
            'This is a noisy phone-call recording of a Hebrew personal name being spelled letter by letter.',
            'Prefer spelled Hebrew letter names such as אלף, בית, גימל, דלת, הא, וו, זין, חית, טית, יוד, כף, למד, מם, נון, סמך, עין, פא, צדי, קוף, ריש, שין, תו.',
            'Keep spoken separator words like רווח, מקף, and final-form words like כף סופית, נון סופית, מם סופית, פא סופית, צדי סופית when they are said.',
            'Return only the transcription of what was spoken.'
        ].join(' '),
        normalize: normalizeHebrewSpelling
    },
    englishLettersRecording: {
        languageCode: 'en-US',
        hints: ['space', 'dash', 'hyphen'],
        deepgramKeyterms: ['space', 'dash', 'hyphen'],
        openAiPrompt: [
            'This is a noisy phone-call recording of English letters being spelled one by one.',
            'Prefer letter-by-letter transcription and keep spoken separators such as space, dash, or hyphen when heard.',
            'Return only the transcription of what was spoken.'
        ].join(' '),
        normalize: normalizeEnglishSpelling
    },
    englishNameRecording: {
        languageCode: 'en-US',
        hints: ['space', 'dash', 'hyphen'],
        deepgramKeyterms: ['space', 'dash', 'hyphen'],
        openAiPrompt: [
            'This is a noisy phone-call recording of an English personal name being spelled one letter at a time.',
            'Prefer letter-by-letter transcription and keep spoken separators such as space, dash, or hyphen when heard.',
            'Return only the transcription of what was spoken.'
        ].join(' '),
        normalize: normalizeEnglishSpelling
    }
};

class TranscriptionService {
    constructor() {
        this.auth = null;
    }

    async processPendingOrders(sheets, { limit = 10, retryOptions } = {}) {
        const orders = await sheets.getPendingTranscriptionOrders(limit);
        let processed = 0;

        for (const order of orders) {
            await this.processOrder(sheets, order, { retryOptions });
            processed += 1;
        }

        return {
            processed,
            pendingFound: orders.length
        };
    }

    async processOrder(sheets, order, { retryOptions } = {}) {
        if (!order._rowNumber) {
            throw new Error('Order row number is required for transcription processing.');
        }

        const patch = {};
        const freshResults = {};

        for (const [recordingKey, fieldConfig] of Object.entries(RECORDING_TRANSCRIPTION_FIELDS)) {
            const recordingPath = String(order[recordingKey] || '').trim();
            if (!recordingPath) {
                continue;
            }

            if (String(order[fieldConfig.statusKey] || '').trim().toLowerCase() === 'completed') {
                continue;
            }

            // העמודות transcript/status הוסרו מהגיליון — ההכרעה היא לפי "סופי מאושר".
            // אם כבר קיים ערך סופי מאושר (כולל תיקון ידני) — לא דורסים אותו.
            if (String(order[fieldConfig.finalKey] || '').trim()) {
                continue;
            }

            // אם כבר יש ערך כלשהו ב"בדיקה נדרשת" — ההקלטה כבר עובדה פעם אחת (כן/לא, או מספר ישן).
            // לא מתמללים שוב אוטומטית כדי לחסוך קריאות API. תמלול-מחדש ידני מאפס שדה זה.
            if (String(order[fieldConfig.needsReviewKey] || '').trim()) {
                continue;
            }

            // שם משפחה מתומלל רק כשהוא ההקלטה היחידה בהזמנה; אחרת מסומן "לא נדרש"
            // (הסימון גם מוציא את השורה מתור התמלול; ניקוי התא = תמלול ידני מחדש).
            if (recordingKey === 'lastNameRecording' && !lastNameTranscriptionNeeded(order)) {
                patch[fieldConfig.needsReviewKey] = 'לא נדרש';
                continue;
            }

            try {
                patch[fieldConfig.statusKey] = 'processing';
                patch[fieldConfig.errorKey] = '';
                await sheets.updateOrderFields(order._rowNumber, patch);

                const result = await this.transcribeRecording(recordingKey, recordingPath, retryOptions);
                freshResults[recordingKey] = result;
                patch[fieldConfig.transcriptKey] = result.transcript;
                patch[fieldConfig.normalizedKey] = result.normalized;
                patch[fieldConfig.finalKey] = result.normalized || result.transcript || '';
                patch[fieldConfig.confidenceKey] = result.confidence;
                patch[fieldConfig.needsReviewKey] = result.needsReview ? 'כן' : 'לא';
                patch[fieldConfig.statusKey] = 'completed';
                patch[fieldConfig.errorKey] = '';
            } catch (error) {
                patch[fieldConfig.statusKey] = 'error';
                patch[fieldConfig.errorKey] = truncate(String(error.message || error), 500);
                patch[fieldConfig.needsReviewKey] = 'כן';
            }
        }

        // הצלבת שם עברי↔אנגלי: רק אם שניהם תומללו עכשיו, ורק אם נמצא שזה אותו שם — לשפר את הדיוק.
        // אם השמות שונים (לקוח בחר שם עברי שונה מהאנגלי) — לא מצליבים ולא נוגעים.
        await this.applyCrossValidation(freshResults, patch);

        if (Object.keys(patch).length > 0) {
            await sheets.updateOrderFields(order._rowNumber, patch);
        }
    }

    async applyCrossValidation(freshResults, patch) {
        if (!String(process.env.OPENAI_API_KEY || '').trim()) {
            return;
        }
        if (String(process.env.TRANSCRIPTION_ENABLE_CROSS_VALIDATION || 'true').trim().toLowerCase() === 'false') {
            return;
        }

        const heb = freshResults.hebrewNameRecording;
        const eng = freshResults.englishNameRecording;
        if (!heb || !eng) {
            return;
        }

        const hebrewText = String(heb.normalized || heb.transcript || '').trim();
        const englishText = String(eng.normalized || eng.transcript || '').trim();
        if (!hebrewText || !englishText) {
            return;
        }

        let cv;
        try {
            cv = await this.crossValidateNames(hebrewText, englishText);
        } catch (error) {
            console.warn(`[transcription] cross-validation failed: ${error.message}`);
            return;
        }

        // שמות שונים, או חוסר ודאות שזה אותו שם — לא נוגעים, כל שדה נשאר עצמאי.
        if (!cv || !cv.matched) {
            return;
        }

        const hebCfg = RECORDING_TRANSCRIPTION_FIELDS.hebrewNameRecording;
        const engCfg = RECORDING_TRANSCRIPTION_FIELDS.englishNameRecording;
        const needsReview = !!cv.needsReview;

        if (cv.hebrew) {
            patch[hebCfg.normalizedKey] = cv.hebrew;
            patch[hebCfg.finalKey] = cv.hebrew;
            patch[hebCfg.needsReviewKey] = needsReview ? 'כן' : 'לא';
            patch[hebCfg.confidenceKey] = cv.confidence;
        }
        if (cv.english) {
            patch[engCfg.normalizedKey] = cv.english;
            patch[engCfg.finalKey] = cv.english;
            patch[engCfg.needsReviewKey] = needsReview ? 'כן' : 'לא';
            patch[engCfg.confidenceKey] = cv.confidence;
        }
    }

    async crossValidateNames(hebrewText, englishText) {
        const apiKey = String(process.env.OPENAI_API_KEY || '').trim();
        if (!apiKey) {
            return null;
        }

        const model = String(process.env.TRANSCRIPTION_REFINER_MODEL || 'gpt-5.4').trim();
        const systemPrompt = [
            'You are given two transcriptions from separate noisy phone recordings of the SAME order: a name spelled in Hebrew letters, and a name spelled in English (Latin) letters. These are speech-to-text of letter-by-letter spelling and OFTEN contain errors - the Hebrew side especially can be garbled.',
            'Your goal is to recover the customer\'s intended name. The two recordings USUALLY belong to the same person (a Hebrew name plus its English transliteration), but sometimes the customer deliberately chose two DIFFERENT names.',
            'Decide MATCHED (same name) vs NOT MATCHED (different names). Lean toward MATCHED when they are MORE OR LESS the same name:',
            '- If a substantial part matches across the two (the surname OR the first name) - even if the other part is garbled or implausible as a real name - treat it as the SAME name. The garbled part is almost certainly a speech-to-text error; correct it using the clearer recording (usually the English one). Set matched=true.',
            '- Example: Hebrew "למם ברדוגו" vs English "YEHUDIT BARDUGO" - the surname matches (ברדוגו=BARDUGO) and "למם" is not a real first name but an STT error for YEHUDIT, so matched=true and the Hebrew is corrected to "יהודית ברדוגו".',
            '- Example: Hebrew "פייגי פלדם" vs English "FAIGY FELDMAN" - clearly the same name with a missing final letter, so matched=true and the Hebrew is corrected to "פייגי פלדמן".',
            'Only set matched=false when the two are CLEARLY DIFFERENT real names (different plausible first AND last names with no transliteration link, e.g. "משה כהן" vs "SARA LEVI"), or when there is no meaningful overlap at all. Never merge two clearly different names.',
            'When matched=true, reconcile both and return the most accurate Hebrew form and English form (use each to fix the other; prefer the clearer English spelling to anchor the name).',
            'Set needs_review=true only if, even after reconciliation, the name remains genuinely uncertain.',
            'Return the English form in UPPERCASE Latin letters, and the Hebrew form in Hebrew letters with words separated by single spaces.',
            'Return valid JSON only.'
        ].join(' ');

        const response = await fetch(OPENAI_CHAT_COMPLETIONS_URL, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model,
                temperature: 0,
                response_format: {
                    type: 'json_schema',
                    json_schema: {
                        name: 'name_cross_validation',
                        strict: true,
                        schema: {
                            type: 'object',
                            additionalProperties: false,
                            properties: {
                                matched: { type: 'boolean' },
                                hebrew: { type: 'string' },
                                english: { type: 'string' },
                                needs_review: { type: 'boolean' },
                                confidence: { type: 'number' },
                                reason: { type: 'string' }
                            },
                            required: ['matched', 'hebrew', 'english', 'needs_review', 'confidence', 'reason']
                        }
                    }
                },
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: JSON.stringify({ hebrew: hebrewText, english: englishText }, null, 2) }
                ]
            })
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error?.message || `Cross-validation failed with status ${response.status}`);
        }

        const parsed = JSON.parse(data.choices?.[0]?.message?.content || '{}');
        const confidence = Number(parsed.confidence);
        return {
            matched: !!parsed.matched,
            hebrew: normalizeWhitespace(parsed.hebrew || ''),
            english: normalizeWhitespace(parsed.english || '').toUpperCase(),
            needsReview: !!parsed.needs_review || (Number.isFinite(confidence) && confidence < 0.86),
            confidence: Number.isFinite(confidence) ? confidence.toFixed(3) : '',
            reason: parsed.reason || ''
        };
    }

    async transcribeRecording(recordingKey, recordingPath, retryOptions = {}) {
        const options = {
            attempts: Number(retryOptions.attempts || 1),
            initialDelayMs: Number(retryOptions.initialDelayMs || 0),
            retryDelayMs: Number(retryOptions.retryDelayMs || 0)
        };
        let lastError = null;

        for (let attempt = 1; attempt <= Math.max(1, options.attempts); attempt += 1) {
            if (attempt === 1 && options.initialDelayMs > 0) {
                await delay(options.initialDelayMs);
            } else if (attempt > 1 && options.retryDelayMs > 0) {
                await delay(options.retryDelayMs);
            }

            try {
                const result = await this.transcribeRecordingOnce(recordingKey, recordingPath);
                if (attempt > 1) {
                    console.log(`[transcription] ${recordingKey} succeeded on attempt ${attempt}`);
                }
                return result;
            } catch (error) {
                lastError = error;
                if (!isRetryableTranscriptionError(error) || attempt >= Math.max(1, options.attempts)) {
                    throw error;
                }
                console.warn(`[transcription] ${recordingKey} attempt ${attempt} failed, retrying: ${error.message}`);
            }
        }

        throw lastError || new Error('No usable transcription result was produced.');
    }

    async transcribeRecordingOnce(recordingKey, recordingPath) {
        const profile = PROFILE_BY_FIELD[recordingKey];
        if (!profile) {
            throw new Error(`No transcription profile configured for ${recordingKey}.`);
        }

        const recording = await downloadRecording(recordingPath);
        const normalizedAudio = await normalizeAudioForTranscription(recording.buffer, {
            sampleRateHertz: 8000,
            channels: 1
        });

        const providers = this.getPreferredProviders(recordingKey);
        let lastError = null;
        const candidates = [];

        for (const provider of providers) {
            try {
                const rawResult = await this.transcribeWithProvider(provider, profile, normalizedAudio);
                const normalizedResult = this.normalizeTranscriptionResult(rawResult, profile, provider);

                if (!normalizedResult.transcript && !normalizedResult.normalized) {
                    continue;
                }

                candidates.push(normalizedResult);
            } catch (error) {
                lastError = error;
                if (!this.shouldTryNextProvider(provider, error)) {
                    throw error;
                }
            }
        }

        let bestResult = candidates.reduce(
            (currentBest, candidate) => chooseBetterResult(currentBest, candidate),
            null
        );

        if (bestResult && this.shouldUseOpenAiRefiner(recordingKey, bestResult)) {
            try {
                bestResult = await this.refineWithOpenAi(recordingKey, bestResult, candidates);
            } catch (error) {
                lastError = error;
            }
        }

        if (bestResult && (bestResult.normalized || bestResult.transcript)) {
            return bestResult;
        }

        throw lastError || new Error('No usable transcription result was produced.');
    }

    getPreferredProviders(recordingKey) {
        const configuredProvider = String(process.env.TRANSCRIPTION_PROVIDER || 'auto').trim().toLowerCase();
        const hasOpenAiKey = !!String(process.env.OPENAI_API_KEY || '').trim();
        const hasDeepgramKey = !!String(process.env.DEEPGRAM_API_KEY || '').trim();
        const hasWhisperModel = !!this.getWhisperModelPath();

        if (configuredProvider === 'openai') {
            return ['openai'];
        }

        if (configuredProvider === 'deepgram') {
            return ['deepgram'];
        }

        if (configuredProvider === 'google') {
            return ['google'];
        }

        if (configuredProvider === 'whisper') {
            return hasWhisperModel ? ['whisper'] : ['google'];
        }

        const providers = [];
        if (recordingKey === 'hebrewNameRecording') {
            if (hasOpenAiKey) {
                providers.push('openai');
            }
            if (hasDeepgramKey) {
                providers.push('deepgram');
            }
        } else {
            if (hasOpenAiKey) {
                providers.push('openai');
            }
            if (hasDeepgramKey) {
                providers.push('deepgram');
            }
        }

        // מנוע Whisper מתארח של OpenAI כמועמד נוסף — משפר דיוק (במיוחד בפרודקשן, שאין בו מודל Whisper מקומי).
        if (hasOpenAiKey) {
            providers.push('openai-whisper');
        }

        providers.push('google');

        if (hasWhisperModel) {
            providers.push('whisper');
        }

        return providers;
    }

    shouldUseOpenAiRefiner(recordingKey, bestResult) {
        if (!String(process.env.OPENAI_API_KEY || '').trim()) {
            return false;
        }

        if (String(process.env.TRANSCRIPTION_ENABLE_REFINER || 'true').trim().toLowerCase() === 'false') {
            return false;
        }

        if (!bestResult) {
            return false;
        }

        if (recordingKey === 'hebrewNameRecording' || recordingKey === 'lastNameRecording') {
            return true;
        }

        return bestResult.needsReview;
    }

    getWhisperModelPath() {
        const candidates = [
            process.env.TRANSCRIPTION_WHISPER_MODEL_PATH,
            process.env.WHISPER_MODEL_PATH,
            path.resolve(__dirname, '..', '..', 'models', 'ggml-large-v3-turbo.bin'),
            path.resolve(__dirname, '..', '..', 'models', 'ggml-large-v3.bin'),
            path.resolve(__dirname, '..', '..', 'models', 'ggml-medium.bin'),
            path.resolve(__dirname, '..', '..', 'models', 'ggml-small.bin'),
            path.resolve(__dirname, '..', '..', 'models', 'ggml-base.bin'),
            path.resolve(__dirname, '..', '..', 'models', 'ggml-tiny.bin')
        ].filter(Boolean);

        const existingPath = candidates.find((candidate) => fs.existsSync(path.resolve(candidate)));
        return existingPath ? path.resolve(existingPath) : null;
    }

    shouldTryNextProvider(provider, error) {
        const message = String(error.message || error);

        if (provider === 'openai' || provider === 'openai-whisper') {
            return /OPENAI_API_KEY|OpenAI transcription failed|fetch failed|timed out|ECONN|ETIMEDOUT|429|500|502|503|504|quota|billing|insufficient_quota|rate limit/i.test(message);
        }

        if (provider === 'deepgram') {
            return /DEEPGRAM_API_KEY|Deepgram transcription failed|fetch failed|timed out|ECONN|ETIMEDOUT|400|401|402|403|408|409|429|500|502|503|504|rate limit/i.test(message);
        }

        if (provider === 'whisper') {
            return /Whisper model file was not found|Whisper transcription failed/i.test(message);
        }

        return false;
    }

    async transcribeWithProvider(provider, profile, buffer) {
        if (provider === 'openai') {
            return this.transcribeWithOpenAI(profile, buffer);
        }

        if (provider === 'openai-whisper') {
            return this.transcribeWithOpenAI(profile, buffer, {
                model: String(process.env.TRANSCRIPTION_OPENAI_WHISPER_MODEL || 'whisper-1').trim()
            });
        }

        if (provider === 'deepgram') {
            return this.transcribeWithDeepgram(profile, buffer);
        }

        if (provider === 'whisper') {
            const transcript = await transcribeWithWhisper(buffer, {
                modelPath: this.getWhisperModelPath(),
                languageCode: profile.languageCode,
                useGpu: String(process.env.TRANSCRIPTION_WHISPER_USE_GPU || 'false').trim().toLowerCase() === 'true'
            });

            return {
                transcript,
                confidence: ''
            };
        }

        if (provider === 'google') {
            return this.transcribeWithGoogle(profile, buffer);
        }

        throw new Error(`Unsupported transcription provider: ${provider}`);
    }

    async transcribeWithDeepgram(profile, buffer) {
        const apiKey = String(process.env.DEEPGRAM_API_KEY || '').trim();
        if (!apiKey) {
            throw new Error('DEEPGRAM_API_KEY is missing for Deepgram transcription.');
        }

        const model = String(process.env.TRANSCRIPTION_DEEPGRAM_MODEL || 'nova-3').trim();
        const requestUrl = new URL(DEEPGRAM_LISTEN_URL);
        requestUrl.searchParams.set('model', model);
        requestUrl.searchParams.set('language', mapLanguageCodeToDeepgramLanguage(profile.languageCode));
        requestUrl.searchParams.set('punctuate', 'false');
        requestUrl.searchParams.set('smart_format', 'false');
        requestUrl.searchParams.set('diarize', 'false');

        (profile.deepgramKeyterms || []).forEach((term) => {
            if (term) {
                requestUrl.searchParams.append('keyterm', term);
            }
        });

        const response = await fetch(requestUrl, {
            method: 'POST',
            headers: {
                Authorization: `Token ${apiKey}`,
                'Content-Type': 'audio/wav'
            },
            body: buffer
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.err_msg || data.error || `Deepgram transcription failed with status ${response.status}`);
        }

        const alternative = data.results?.channels?.[0]?.alternatives?.[0];
        return {
            transcript: normalizeWhitespace(alternative?.transcript || ''),
            confidence: typeof alternative?.confidence === 'number' ? alternative.confidence.toFixed(3) : ''
        };
    }

    async transcribeWithOpenAI(profile, buffer, { model } = {}) {
        const apiKey = String(process.env.OPENAI_API_KEY || '').trim();
        if (!apiKey) {
            throw new Error('OPENAI_API_KEY is missing for OpenAI transcription.');
        }

        const selectedModel = String(model || process.env.TRANSCRIPTION_OPENAI_MODEL || 'gpt-4o-transcribe').trim();
        const isGpt4oTranscribe = /gpt-4o/i.test(selectedModel);
        const form = new FormData();
        form.append('model', selectedModel);
        form.append('file', new Blob([buffer], { type: 'audio/wav' }), 'recording.wav');
        // ל-whisper-1 מבקשים verbose_json כדי לקבל ביטחון (avg_logprob); ל-gpt-4o מספיק json.
        form.append('response_format', isGpt4oTranscribe ? 'json' : 'verbose_json');

        const language = mapLanguageCodeToOpenAiLanguage(profile.languageCode);
        if (language) {
            form.append('language', language);
        }

        if (profile.openAiPrompt) {
            form.append('prompt', profile.openAiPrompt);
        }

        // הפרמטר include[]=logprobs נתמך רק במודלים מסוג gpt-4o-transcribe.
        if (isGpt4oTranscribe) {
            form.append('include[]', 'logprobs');
        }

        const response = await fetch(OPENAI_TRANSCRIPTIONS_URL, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${apiKey}`
            },
            body: form
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error?.message || `OpenAI transcription failed with status ${response.status}`);
        }

        return {
            transcript: normalizeWhitespace(data.text || data.transcript || ''),
            confidence: deriveOpenAiConfidence(data)
        };
    }

    async refineWithOpenAi(recordingKey, bestResult, candidates) {
        const apiKey = String(process.env.OPENAI_API_KEY || '').trim();
        if (!apiKey) {
            throw new Error('OPENAI_API_KEY is missing for OpenAI refiner.');
        }

        const model = String(process.env.TRANSCRIPTION_REFINER_MODEL || 'gpt-5.4').trim();
        const payload = {
            task: recordingKey,
            current_best: {
                transcript: bestResult.transcript,
                normalized: bestResult.normalized,
                confidence: bestResult.confidence,
                needs_review: bestResult.needsReview
            },
            candidates: candidates.map((candidate) => ({
                provider: candidate.provider,
                transcript: candidate.transcript,
                normalized: candidate.normalized,
                confidence: candidate.confidence,
                needs_review: candidate.needsReview
            }))
        };

        const systemPrompt = [
            'You improve noisy phone-call transcriptions of spelled names and letters.',
            'Return valid JSON only.',
            'Prefer what is strongly supported by the candidate transcripts.',
            'For Hebrew names, interpret spoken Hebrew letter names, spaces, dashes, and final letters.',
            'Common STT confusions in Hebrew spelling are allowed when deciding the intended name: הא may appear as א or עין, וו may appear as ו or או, and final letters may be omitted or replaced.',
            'A very common surname like כהן may come from near-miss transcripts such as כף הא נון סופית, כף א נון סופית, כף עין נון סופית, כף נון סופית, כן, כאן, or כען.',
            'A very common first name like חיה may come from near-miss transcripts such as חית יוד א or similar forms where the final הא was mistranscribed.',
            'Do not invent extra words. If the result is ambiguous, set needs_review to true.',
            'If a very common Hebrew surname or first name is clearly the intended result from near-miss letter names, you may correct it.',
            'For English letter spellings, treat revach/revakh/rewach as the Hebrew-accent pronunciation of the word space.',
            'Choose the best transcript_basis from the candidates and produce the best normalized value.'
        ].join(' ');

        const userPrompt = JSON.stringify(payload, null, 2);
        const response = await fetch(OPENAI_CHAT_COMPLETIONS_URL, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model,
                temperature: 0,
                response_format: {
                    type: 'json_schema',
                    json_schema: {
                        name: 'transcription_refinement',
                        strict: true,
                        schema: {
                            type: 'object',
                            additionalProperties: false,
                            properties: {
                                transcript_basis: { type: 'string' },
                                normalized: { type: 'string' },
                                needs_review: { type: 'boolean' },
                                confidence: { type: 'number' },
                                reason: { type: 'string' }
                            },
                            required: ['transcript_basis', 'normalized', 'needs_review', 'confidence', 'reason']
                        }
                    }
                },
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt }
                ]
            })
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error?.message || `OpenAI refiner failed with status ${response.status}`);
        }

        const content = data.choices?.[0]?.message?.content || '';
        const parsed = JSON.parse(content);
        const confidence = Number(parsed.confidence);

        const shouldForceReview =
            (recordingKey === 'hebrewNameRecording' || recordingKey === 'lastNameRecording') &&
            Number.isFinite(confidence) &&
            confidence < 0.86;

        return {
            transcript: normalizeWhitespace(parsed.transcript_basis || bestResult.transcript || ''),
            normalized: normalizeWhitespace(parsed.normalized || ''),
            confidence: Number.isFinite(confidence) ? confidence.toFixed(3) : (bestResult.confidence || ''),
            needsReview: !!parsed.needs_review || shouldForceReview,
            provider: 'openai-refiner'
        };
    }

    async transcribeWithGoogle(profile, buffer) {
        const requestConfig = {
            encoding: 'LINEAR16',
            sampleRateHertz: 8000,
            languageCode: profile.languageCode,
            maxAlternatives: 5,
            enableAutomaticPunctuation: false,
            speechContexts: [
                {
                    phrases: profile.hints,
                    boost: 20
                }
            ]
        };

        if (String(profile.languageCode || '').toLowerCase().startsWith('en-')) {
            requestConfig.model = 'phone_call';
        }

        const token = await this.getAccessToken();
        const response = await fetch(GOOGLE_SPEECH_URL, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                config: requestConfig,
                audio: {
                    content: buffer.toString('base64')
                }
            })
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error?.message || `Speech API failed with status ${response.status}`);
        }

        const alternatives = (data.results || []).flatMap((result) => result.alternatives || []);
        const primary = pickBestAlternative(alternatives, profile);
        if (!primary || !primary.transcript) {
            return {
                transcript: '',
                confidence: ''
            };
        }

        return {
            transcript: primary.transcript,
            confidence: typeof primary.confidence === 'number' ? primary.confidence.toFixed(3) : ''
        };
    }

    normalizeTranscriptionResult(rawResult, profile, provider) {
        const transcript = normalizeWhitespace(rawResult?.transcript || '');
        if (!transcript) {
            return {
                transcript: '',
                normalized: '',
                confidence: rawResult?.confidence || '',
                needsReview: true,
                provider
            };
        }

        const normalization = profile.normalize(transcript);
        return {
            transcript,
            normalized: normalization.normalized,
            confidence: rawResult?.confidence || '',
            needsReview:
                normalization.needsReview ||
                isLowConfidence(rawResult?.confidence, profile) ||
                hasSuspiciousNormalizedValue(normalization.normalized),
            provider
        };
    }

    async getAccessToken() {
        if (!this.auth) {
            const credentials = this.loadCredentials();
            if (!credentials) {
                throw new Error('Google Speech credentials are missing.');
            }

            this.auth = new GoogleAuth({
                credentials,
                scopes: ['https://www.googleapis.com/auth/cloud-platform']
            });
        }

        const client = await this.auth.getClient();
        const token = await client.getAccessToken();
        if (!token || (typeof token === 'object' && !token.token)) {
            throw new Error('Failed to acquire Google access token for transcription.');
        }

        return typeof token === 'string' ? token : token.token;
    }

    loadCredentials() {
        const bundledCredentialsPath = path.resolve(__dirname, '..', '..', 'config', 'google-credentials.json');
        if (fs.existsSync(bundledCredentialsPath)) {
            return this.parseCredentials(fs.readFileSync(bundledCredentialsPath, 'utf8'));
        }

        if (process.env.GOOGLE_SHEETS_CREDENTIALS_JSON) {
            return this.parseCredentials(process.env.GOOGLE_SHEETS_CREDENTIALS_JSON);
        }

        if (process.env.GOOGLE_SHEETS_CLIENT_EMAIL && process.env.GOOGLE_SHEETS_PRIVATE_KEY) {
            return {
                type: 'service_account',
                client_email: process.env.GOOGLE_SHEETS_CLIENT_EMAIL,
                private_key: normalizePrivateKey(process.env.GOOGLE_SHEETS_PRIVATE_KEY)
            };
        }

        return null;
    }

    parseCredentials(rawValue) {
        const credentials = JSON.parse(rawValue);
        if (credentials.private_key) {
            credentials.private_key = normalizePrivateKey(credentials.private_key);
        }
        return credentials;
    }
}

function normalizePrivateKey(privateKey) {
    let normalized = String(privateKey || '');
    if (
        (normalized.startsWith('"') && normalized.endsWith('"')) ||
        (normalized.startsWith("'") && normalized.endsWith("'"))
    ) {
        normalized = normalized.slice(1, -1);
    }

    normalized = normalized.replace(/\r\n/g, '\n').replace(/\\n/g, '\n');
    if (!normalized.endsWith('\n')) {
        normalized += '\n';
    }

    return normalized;
}

function mapLanguageCodeToOpenAiLanguage(languageCode) {
    const code = String(languageCode || '').trim().toLowerCase();
    if (!code) {
        return '';
    }

    if (code.startsWith('he')) {
        return 'he';
    }

    if (code.startsWith('en')) {
        return 'en';
    }

    return code.split('-')[0] || '';
}

function mapLanguageCodeToDeepgramLanguage(languageCode) {
    const code = String(languageCode || '').trim().toLowerCase();
    if (!code) {
        return 'en';
    }

    if (code.startsWith('he')) {
        return 'he';
    }

    if (code.startsWith('en')) {
        return 'en';
    }

    return code.split('-')[0] || 'en';
}

function normalizeHebrewSpelling(transcript) {
    return normalizeSpelling(transcript, HEBREW_LETTER_ALIASES, {
        separators: ['רווח', 'ספייס', 'space'],
        hyphenWords: ['מקף', 'דש', 'dash', 'hyphen'],
        postProcess: (value, context) => applyGenericHebrewSpellingCorrections(value, context)
    });
}

function normalizeEnglishSpelling(transcript) {
    return normalizeSpelling(transcript, ENGLISH_LETTER_ALIASES, {
        separators: ['space', 'ספייס', 'רווח', 'revach', 'revakh', 'rewach'],
        hyphenWords: ['dash', 'hyphen', 'מקף'],
        postProcess: (value) => value.toUpperCase()
    });
}

function normalizeSpelling(transcript, aliasesMap, options) {
    const aliasIndex = buildAliasIndex(aliasesMap);
    const tokens = tokenizeTranscript(transcript);
    const words = [];
    let current = '';
    let unknownCount = 0;
    let index = 0;

    while (index < tokens.length) {
        const separatorMatch = matchPhrase(tokens, index, options.separators);
        if (separatorMatch) {
            if (current) {
                words.push(current);
                current = '';
            }
            index += separatorMatch.length;
            continue;
        }

        const hyphenMatch = matchPhrase(tokens, index, options.hyphenWords);
        if (hyphenMatch) {
            current += '-';
            index += hyphenMatch.length;
            continue;
        }

        const aliasMatch = matchAlias(tokens, index, aliasIndex);
        if (aliasMatch) {
            current += aliasMatch.value;
            index += aliasMatch.length;
            continue;
        }

        const token = tokens[index];

        if (/^[a-z]$/i.test(token)) {
            current += token.toUpperCase();
            index += 1;
            continue;
        }

        if (/^[א-ת]$/u.test(token)) {
            current += token;
            index += 1;
            continue;
        }

        unknownCount += 1;
        index += 1;
    }

    if (current) {
        words.push(current);
    }

    const normalized = options.postProcess(
        words.join(' ').replace(/\s+/g, ' ').trim(),
        {
            transcript: normalizeWhitespace(transcript),
            tokens,
            unknownCount
        }
    );
    return {
        normalized,
        unknownCount,
        needsReview: !normalized || unknownCount > 0
    };
}

function buildAliasIndex(aliasesMap) {
    const index = [];
    Object.entries(aliasesMap).forEach(([letter, aliases]) => {
        aliases.forEach((alias) => {
            index.push({
                tokens: alias.toLowerCase().split(/\s+/).filter(Boolean),
                value: letter
            });
        });
    });
    return index.sort((a, b) => b.tokens.length - a.tokens.length);
}

function matchPhrase(tokens, startIndex, phrases) {
    const normalizedPhrases = phrases
        .map((phrase) => String(phrase || '').toLowerCase().split(/\s+/).filter(Boolean))
        .sort((a, b) => b.length - a.length);

    for (const phraseTokens of normalizedPhrases) {
        if (phraseTokens.length === 0) {
            continue;
        }

        let matched = true;
        for (let offset = 0; offset < phraseTokens.length; offset += 1) {
            if (tokens[startIndex + offset] !== phraseTokens[offset]) {
                matched = false;
                break;
            }
        }

        if (matched) {
            return { length: phraseTokens.length };
        }
    }

    return null;
}

function matchAlias(tokens, startIndex, aliasIndex) {
    for (const entry of aliasIndex) {
        let matched = true;
        for (let offset = 0; offset < entry.tokens.length; offset += 1) {
            if (tokens[startIndex + offset] !== entry.tokens[offset]) {
                matched = false;
                break;
            }
        }

        if (matched) {
            return {
                value: entry.value,
                length: entry.tokens.length
            };
        }
    }

    return null;
}

function tokenizeTranscript(transcript) {
    return normalizeWhitespace(
        String(transcript || '')
            .replace(/[.,/#!$%^&*;:{}=_`~()?"'”“׳׳+-]/g, ' ')
    )
        .toLowerCase()
        .split(' ')
        .filter(Boolean);
}

function applyFinalHebrewLetters(value) {
    return value
        .split(' ')
        .filter(Boolean)
        .map((word) => {
            const lastChar = word[word.length - 1];
            if (!HEBREW_FINAL_FORM_MAP[lastChar]) {
                return word;
            }

            return `${word.slice(0, -1)}${HEBREW_FINAL_FORM_MAP[lastChar]}`;
        })
        .join(' ');
}

function applyGenericHebrewSpellingCorrections(value, context = {}) {
    const normalized = String(value || '').trim();
    if (!normalized) {
        return '';
    }

    let corrected = normalizeInternalHebrewLetterForms(normalized);
    corrected = applyGenericTranscriptAwareHebrewCorrections(corrected, context);
    corrected = applyFinalHebrewLetters(corrected);
    return corrected;
}

function normalizeInternalHebrewLetterForms(value) {
    return String(value || '')
        .split(' ')
        .filter(Boolean)
        .map((word) => {
            const letters = [...word];
            return letters
                .map((letter, index) => {
                    if (index < letters.length - 1 && HEBREW_BASE_FORM_MAP[letter]) {
                        return HEBREW_BASE_FORM_MAP[letter];
                    }

                    return letter;
                })
                .join('');
        })
        .join(' ');
}

function applyGenericTranscriptAwareHebrewCorrections(value, context = {}) {
    const normalized = String(value || '').trim();
    if (!normalized) {
        return '';
    }

    return normalized;
}

function normalizeWhitespace(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
}

function chooseBetterResult(currentBest, candidate) {
    if (!candidate) {
        return currentBest;
    }

    if (!currentBest) {
        return candidate;
    }

    const currentScore = scoreResult(currentBest);
    const candidateScore = scoreResult(candidate);
    return candidateScore > currentScore ? candidate : currentBest;
}

function scoreResult(result) {
    const normalized = String(result?.normalized || '');
    const transcript = String(result?.transcript || '');
    const confidence = Number(result?.confidence || 0);
    const providerBoost =
        result?.provider === 'openai-refiner'
            ? 120
            : result?.provider === 'openai'
            ? 100
            : result?.provider === 'openai-whisper'
            ? 90
            : result?.provider === 'google'
                ? 5
                : 0;

    return (
        (result?.needsReview ? 0 : 1000) +
        normalized.length * 10 +
        transcript.length +
        confidence * 100 +
        providerBoost
    );
}

function pickBestAlternative(alternatives, profile) {
    const scored = alternatives
        .filter((alternative) => String(alternative?.transcript || '').trim())
        .map((alternative) => {
            const normalization = profile.normalize(String(alternative.transcript || ''));
            const confidence = typeof alternative.confidence === 'number' ? alternative.confidence : 0;
            const score =
                (normalization.normalized ? 100 : 0) +
                confidence * 20 -
                normalization.unknownCount * 25 +
                normalization.normalized.length;

            return {
                ...alternative,
                _score: score
            };
        })
        .sort((left, right) => right._score - left._score);

    return scored[0] || null;
}

function isLowConfidence(confidenceValue) {
    const confidence = Number(confidenceValue || 0);
    return confidence > 0 && confidence < 0.88;
}

function hasSuspiciousNormalizedValue(value) {
    const normalized = String(value || '').trim();
    if (!normalized) {
        return false;
    }

    const words = normalized.split(/\s+/).filter(Boolean);
    return words.some((word) => /[ךםןףץ]./u.test(word));
}

function deriveOpenAiConfidence(payload) {
    const values = extractOpenAiLogprobs(payload);
    if (values.length === 0) {
        return '';
    }

    const avgProbability =
        values.reduce((sum, value) => sum + Math.exp(Math.min(0, Number(value))), 0) / values.length;

    if (!Number.isFinite(avgProbability) || avgProbability <= 0) {
        return '';
    }

    return avgProbability.toFixed(3);
}

function extractOpenAiLogprobs(payload) {
    if (!payload || typeof payload !== 'object') {
        return [];
    }

    const values = [];

    if (Array.isArray(payload.logprobs)) {
        values.push(...payload.logprobs);
    }

    if (Array.isArray(payload.segments)) {
        payload.segments.forEach((segment) => {
            if (Array.isArray(segment?.logprobs)) {
                values.push(...segment.logprobs);
            } else if (typeof segment?.avg_logprob === 'number') {
                values.push(segment.avg_logprob);
            }
        });
    }

    return values
        .map((entry) => {
            if (typeof entry === 'number') {
                return entry;
            }

            if (entry && typeof entry.logprob === 'number') {
                return entry.logprob;
            }

            return null;
        })
        .filter((value) => typeof value === 'number' && Number.isFinite(value));
}

function truncate(value, maxLength) {
    return value.length <= maxLength ? value : `${value.slice(0, maxLength - 3)}...`;
}

function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableTranscriptionError(error) {
    const message = String(error?.message || error);
    return /DownloadFile|non-audio|Audio buffer is empty|No usable transcription result|fetch failed|timed out|ECONN|ETIMEDOUT|429|500|502|503|504|rate limit/i.test(message);
}

module.exports = TranscriptionService;
