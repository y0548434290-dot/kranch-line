// סקריפט בנייה חד-פעמי (מקומי בלבד — לא רץ ב-Vercel):
// עובר על כל המשפטים ב-voice-lines.js, מייצר אודיו אמיתי דרך Google Gemini TTS
// (קול Kore בסגנון ילדה, כמו האתר magical-mermaid), מאט ל-0.9x וממיר ל-8kHz מונו
// בעזרת ffmpeg, ומעלה לימות לתיקייה ivr2:/0/tts.
//
// הרצה:   GEMINI_KEY=... node generate-voice.js            (מדלג על קבצים שכבר קיימים)
//         GEMINI_KEY=... node generate-voice.js --force    (מייצר מחדש הכל)
//         GEMINI_KEY=... node generate-voice.js ask_phone city_1   (רק keys ספציפיים)

require('./env-loader');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');
const { promisify } = require('util');

const execFileAsync = promisify(execFile);
const {
    ALL_LINES,
    TTS_STYLE_INSTRUCTION,
    TTS_VOICE,
    TTS_SPEED
} = require('./src/api-link/voice-lines');

const GEMINI_KEY = process.env.GEMINI_KEY || process.env.GEMINI_API_KEY;
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${GEMINI_KEY}`;
const YEMOT_API = 'https://www.call2all.co.il/ym/api/';
const TTS_REMOTE_DIR = 'ivr2:/0/tts';
const DELAY_MS = Number(process.env.GEN_DELAY_MS || 4000);

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ---- Gemini TTS ----
async function geminiTts(text, retry = 0) {
    const payload = {
        contents: [{ parts: [{ text: `${TTS_STYLE_INSTRUCTION} "${text}"` }] }],
        generationConfig: {
            responseModalities: ['AUDIO'],
            speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: TTS_VOICE } } }
        },
        model: 'gemini-2.5-flash-preview-tts'
    };

    let response;
    try {
        response = await fetch(GEMINI_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
    } catch (error) {
        if (retry < 5) { await delay(Math.pow(2, retry) * 1000); return geminiTts(text, retry + 1); }
        throw error;
    }

    if (response.status === 429 || response.status >= 500) {
        // NO_429_RETRY: כשמריצים דרך מתזמר שמסובב מפתחות, עדיף להיכשל מיד על 429
        // (המתזמר עובר למפתח הבא) במקום לבזבז backoff על מפתח שמכסתו נגמרה.
        const failFast = process.env.NO_429_RETRY && response.status === 429;
        if (!failFast && retry < 5) { await delay(Math.pow(2, retry) * 1000); return geminiTts(text, retry + 1); }
    }

    const data = await response.json();
    if (!response.ok) {
        throw new Error(`Gemini ${response.status}: ${JSON.stringify(data).slice(0, 300)}`);
    }

    const part = data.candidates?.[0]?.content?.parts?.[0];
    const b64 = part?.inlineData?.data;
    const mime = part?.inlineData?.mimeType || 'audio/L16;rate=24000';
    if (!b64) {
        // תקלה חולפת של Gemini על קלט קצר (finishReason: OTHER, בלי אודיו) — ננסה שוב.
        if (retry < 6) { await delay(Math.pow(2, retry) * 1000); return geminiTts(text, retry + 1); }
        throw new Error('No audio returned from Gemini.');
    }

    const rateMatch = mime.match(/rate=(\d+)/);
    const sampleRate = rateMatch ? parseInt(rateMatch[1], 10) : 24000;
    return { pcm: Buffer.from(b64, 'base64'), sampleRate };
}

// ---- PCM -> WAV (האטה ל-0.9x, המרה ל-8kHz מונו) ----
async function pcmToYemotWav(pcm, sampleRate, outPath) {
    const tmpPcm = path.join(os.tmpdir(), `tts_${process.pid}_${Math.floor(performance.now())}.pcm`);
    fs.writeFileSync(tmpPcm, pcm);
    try {
        await execFileAsync('ffmpeg', [
            '-y',
            '-f', 's16le', '-ar', String(sampleRate), '-ac', '1', '-i', tmpPcm,
            '-filter:a', `atempo=${TTS_SPEED}`,
            '-ar', '8000', '-ac', '1', '-sample_fmt', 's16',
            outPath
        ], { windowsHide: true });
    } finally {
        try { fs.unlinkSync(tmpPcm); } catch (_) {}
    }
}

// ---- Yemot ----
let yemotToken = null;
async function yemotLogin() {
    const r = await fetch(YEMOT_API + 'Login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ username: process.env.YEMOT_USERNAME, password: process.env.YEMOT_PASSWORD })
    });
    const j = await r.json();
    if (j.responseStatus !== 'OK' || !j.token) {
        throw new Error(`Yemot login failed: ${JSON.stringify(j).slice(0, 200)}`);
    }
    yemotToken = j.token;
}

async function yemotListTtsDir() {
    const r = await fetch(YEMOT_API + 'GetIvrTree', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ token: yemotToken, path: TTS_REMOTE_DIR })
    });
    const j = await r.json();
    const items = (j && j.items) || [];
    return new Set(items.map((item) => String(item.name || '').replace(/\.wav$/i, '')));
}

async function yemotUpload(key, wavPath, retry = 0) {
    const fd = new FormData();
    fd.append('token', yemotToken);
    fd.append('path', `${TTS_REMOTE_DIR}/${key}.wav`);
    fd.append('convertAudio', '1');
    fd.append('file', new Blob([fs.readFileSync(wavPath)], { type: 'audio/wav' }), `${key}.wav`);

    const r = await fetch(YEMOT_API + 'UploadFile', { method: 'POST', body: fd });
    const j = await r.json().catch(() => ({}));
    if (j.responseStatus === 'EXPIRED_SESSION' && retry < 2) {
        await yemotLogin();
        return yemotUpload(key, wavPath, retry + 1);
    }
    if (!j.success && j.responseStatus !== 'OK') {
        throw new Error(`Yemot upload failed for ${key}: ${JSON.stringify(j).slice(0, 200)}`);
    }
    return j;
}

// כותב את voice-manifest.json לפי מה שקיים בפועל בתיקיית ה-tts בימות.
// כך say() ב-voice-lines.js יודע אילו מפתחות להשמיע כקובץ ואילו כטקסט.
async function refreshManifest() {
    const have = await yemotListTtsDir();
    const keys = [...have]
        .filter((k) => Object.prototype.hasOwnProperty.call(ALL_LINES, k))
        .sort();
    const outPath = path.join(__dirname, 'src', 'api-link', 'voice-manifest.json');
    fs.writeFileSync(outPath, `${JSON.stringify(keys, null, 2)}\n`);
    console.log(`[manifest] wrote ${keys.length} keys -> ${outPath}`);
}

// ---- main ----
(async () => {
    // מצב עדכון manifest בלבד (לא דורש GEMINI_KEY): רק מסנכרן את הרשימה מימות.
    if (process.argv.includes('--manifest-only')) {
        await yemotLogin();
        await refreshManifest();
        return;
    }

    if (!GEMINI_KEY) {
        console.error('Missing GEMINI_KEY env var.');
        process.exit(1);
    }

    const force = process.argv.includes('--force');
    const explicitKeys = process.argv.slice(2).filter((arg) => !arg.startsWith('--'));
    const keys = explicitKeys.length > 0 ? explicitKeys : Object.keys(ALL_LINES);

    await yemotLogin();
    const existing = force ? new Set() : await yemotListTtsDir();

    const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tts-gen-'));
    const created = [];
    const skipped = [];
    const failed = [];

    for (const key of keys) {
        const text = ALL_LINES[key];
        if (text === undefined) {
            console.warn(`[skip] unknown key ${key}`);
            failed.push(key);
            continue;
        }
        if (!force && existing.has(key)) {
            skipped.push(key);
            console.log(`[skip] ${key} (already on Yemot)`);
            continue;
        }

        try {
            const { pcm, sampleRate } = await geminiTts(text);
            const wavPath = path.join(workDir, `${key}.wav`);
            await pcmToYemotWav(pcm, sampleRate, wavPath);
            await yemotUpload(key, wavPath);
            created.push(key);
            console.log(`[ok]   ${key}  "${text.slice(0, 40)}${text.length > 40 ? '…' : ''}"`);
            await delay(DELAY_MS);
        } catch (error) {
            failed.push(key);
            console.error(`[fail] ${key}: ${error.message}`);
        }
    }

    // מסנכרן את ה-manifest לפי מה שקיים בפועל בימות (כולל מה שעלה בריצה זו).
    try {
        await refreshManifest();
    } catch (error) {
        console.error(`[manifest] refresh failed: ${error.message}`);
    }

    console.log('\n==== SUMMARY ====');
    console.log(`created: ${created.length} | skipped: ${skipped.length} | failed: ${failed.length}`);
    if (failed.length) {
        console.log('FAILED keys:', failed.join(', '));
        process.exitCode = 1;
    }
})();
