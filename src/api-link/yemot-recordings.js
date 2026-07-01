const path = require('path');

const YEMOT_API_BASE = 'https://www.call2all.co.il/ym/api/';
const TOKEN_TTL_MS = 15 * 60 * 1000;

let cachedToken = null;
let cachedTokenAt = 0;

function normalizeRecordingPath(recordingPath) {
    let raw = String(recordingPath || '').trim().replace(/\\/g, '/');
    if (!raw) {
        return '';
    }

    const hyperlinkMatch = raw.match(/^=HYPERLINK\(\s*"([^"]+)"/i);
    if (hyperlinkMatch) {
        raw = hyperlinkMatch[1].trim();
    }

    // בגיליון נשמר לעתים קישור מלא (.../recording?path=0%2F3%2F1%2F025.wav). אם קיבלנו קישור כזה,
    // נחלץ את path כדי שלא ננסה להוריד את כל ה-URL בתור נתיב ימות.
    const queryMatch = raw.match(/[?&]path=([^&]+)/i);
    if (queryMatch) {
        try {
            raw = decodeURIComponent(queryMatch[1]);
        } catch (_) {
            raw = queryMatch[1];
        }
        raw = raw.replace(/\\/g, '/').trim();
    }

    if (/^0\/3\/\d{4}\.wav$/i.test(raw)) {
        const match = raw.match(/^0\/3\/(\d)(\d{3})\.wav$/i);
        if (match) {
            return `0/3/${match[1]}/${match[2]}.wav`;
        }
    }

    return raw.replace(/^\/+/, '');
}

function looksLikeRecordingReference(recordingPath) {
    const raw = String(recordingPath || '').trim();
    if (!raw) {
        return false;
    }

    if (/[?&]path=/i.test(raw)) {
        return true;
    }

    const normalized = normalizeRecordingPath(raw);
    return /^\d+(?:\/\d+)*\/[^/]+\.wav$/i.test(normalized);
}

async function getYemotToken({ forceRefresh = false } = {}) {
    if (!forceRefresh && cachedToken && Date.now() - cachedTokenAt < TOKEN_TTL_MS) {
        return cachedToken;
    }

    if (!process.env.YEMOT_USERNAME || !process.env.YEMOT_PASSWORD) {
        throw new Error('Yemot credentials are required.');
    }

    const response = await fetch(`${YEMOT_API_BASE}Login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            username: process.env.YEMOT_USERNAME,
            password: process.env.YEMOT_PASSWORD
        })
    });

    const data = await parseYemotJsonResponse(response, 'Login');
    if (data.responseStatus !== 'OK' || !data.token) {
        throw new Error(data.message || 'Yemot login failed.');
    }

    cachedToken = data.token;
    cachedTokenAt = Date.now();
    return cachedToken;
}

async function yemotJsonRequest(method, params = {}, { forceRefresh = false } = {}) {
    const token = await getYemotToken({ forceRefresh });
    const response = await fetch(`${YEMOT_API_BASE}${method}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            token,
            ...params
        })
    });

    const data = await parseYemotJsonResponse(response, method);

    if (data.responseStatus === 'EXPIRED_SESSION' && !forceRefresh) {
        cachedToken = null;
        return yemotJsonRequest(method, params, { forceRefresh: true });
    }

    return data;
}

async function getIvrTree(ivrPath) {
    const normalizedPath = normalizeRecordingPath(ivrPath).replace(/\/[^/]+\.wav$/i, '');
    const data = await yemotJsonRequest('GetIvrTree', { path: `ivr2:${normalizedPath}` });

    if (data.responseStatus && data.responseStatus !== 'OK') {
        throw new Error(data.message || `GetIvrTree failed with status ${data.responseStatus}.`);
    }

    return data;
}

async function downloadRecording(recordingPath) {
    const normalizedPath = normalizeRecordingPath(recordingPath);
    if (!normalizedPath) {
        throw new Error('Recording path is required.');
    }

    const token = await getYemotToken();
    const response = await fetch(`${YEMOT_API_BASE}DownloadFile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            token,
            path: `ivr2:${normalizedPath}`
        })
    });

    if (!response.ok) {
        throw new Error(`Yemot DownloadFile failed with status ${response.status}.`);
    }

    const buffer = Buffer.from(await response.arrayBuffer());

    if (buffer.length < 12 || buffer.toString('ascii', 0, 4) !== 'RIFF') {
        let message = `Yemot DownloadFile returned a non-audio response (${buffer.length} bytes).`;
        try {
            const parsed = JSON.parse(buffer.toString('utf8'));
            if (parsed.responseStatus === 'EXPIRED_SESSION') {
                cachedToken = null;
                return downloadRecording(normalizedPath);
            }
            message = parsed.message || parsed.responseStatus || message;
        } catch (_) {
            // לא JSON; נשאיר את הודעת ברירת המחדל.
        }
        throw new Error(message);
    }

    return {
        normalizedPath,
        fileName: path.basename(normalizedPath),
        buffer
    };
}

async function parseYemotJsonResponse(response, method) {
    if (!response.ok) {
        throw new Error(`Yemot ${method} failed with status ${response.status}.`);
    }

    const raw = await response.text();
    try {
        return JSON.parse(raw);
    } catch (error) {
        throw new Error(`Yemot ${method} returned invalid JSON: ${raw.slice(0, 200)}`);
    }
}

module.exports = {
    normalizeRecordingPath,
    looksLikeRecordingReference,
    getYemotToken,
    yemotJsonRequest,
    getIvrTree,
    downloadRecording
};
