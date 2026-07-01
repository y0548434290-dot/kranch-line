const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');
const { promisify } = require('util');

const execFileAsync = promisify(execFile);

function analyzeWavBuffer(buffer) {
    const wav = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer || []);
    const report = {
        isRiff: false,
        fileSize: wav.length
    };

    if (wav.length < 12 || wav.toString('ascii', 0, 4) !== 'RIFF' || wav.toString('ascii', 8, 12) !== 'WAVE') {
        report.note = 'Buffer is not a valid RIFF/WAVE file.';
        return report;
    }

    report.isRiff = true;
    report.riffDeclaredSize = wav.readUInt32LE(4);

    const fmtIdx = wav.indexOf('fmt ', 12, 'ascii');
    if (fmtIdx !== -1 && wav.length >= fmtIdx + 24) {
        report.audioFormat = wav.readUInt16LE(fmtIdx + 8);
        report.channels = wav.readUInt16LE(fmtIdx + 10);
        report.sampleRate = wav.readUInt32LE(fmtIdx + 12);
        report.byteRate = wav.readUInt32LE(fmtIdx + 16);
        report.bitsPerSample = wav.readUInt16LE(fmtIdx + 22);
        report.expectedByteRate = report.sampleRate * report.channels * (report.bitsPerSample / 8);
        report.byteRateOk = report.byteRate === report.expectedByteRate;
    }

    const dataIdx = wav.indexOf('data', 12, 'ascii');
    if (dataIdx !== -1 && wav.length >= dataIdx + 8) {
        report.dataDeclaredSize = wav.readUInt32LE(dataIdx + 4);
        report.dataAvailable = wav.length - (dataIdx + 8);
        report.dataSizeOk = report.dataDeclaredSize === report.dataAvailable;

        if (report.byteRate) {
            report.durationSec = Number((report.dataAvailable / report.byteRate).toFixed(2));
        }
    }

    let fdBytes = 0;
    for (const value of wav) {
        if (value === 0xfd) {
            fdBytes += 1;
        }
    }

    report.fdBytes = fdBytes;
    report.fdRatioPct = Number(((100 * fdBytes) / Math.max(wav.length, 1)).toFixed(2));
    return report;
}

async function normalizeAudioForTranscription(buffer, {
    sampleRateHertz = 8000,
    channels = 1,
    filters = ['highpass=f=120', 'lowpass=f=3400']
} = {}) {
    const inputBuffer = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer || []);
    if (!inputBuffer.length) {
        throw new Error('Audio buffer is empty.');
    }

    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'yemot-audio-'));
    const inputPath = path.join(tempDir, 'input.wav');
    const outputPath = path.join(tempDir, 'normalized.wav');

    try {
        fs.writeFileSync(inputPath, inputBuffer);

        const args = [
            '-hide_banner',
            '-loglevel',
            'error',
            '-y',
            '-i',
            inputPath,
            '-ac',
            String(channels),
            '-ar',
            String(sampleRateHertz),
            '-c:a',
            'pcm_s16le'
        ];

        if (filters.length > 0) {
            args.push('-af', filters.join(','));
        }

        args.push(outputPath);

        await execFileAsync('ffmpeg', args, { windowsHide: true });
        return fs.readFileSync(outputPath);
    } catch (error) {
        if (error.code === 'ENOENT') {
            return inputBuffer;
        }

        throw new Error(`Failed normalizing audio with ffmpeg: ${error.message}`);
    } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
    }
}

function mapLanguageCodeToWhisperLanguage(languageCode) {
    const code = String(languageCode || '').trim().toLowerCase();
    if (!code) {
        return 'auto';
    }

    if (code.startsWith('he')) {
        return 'he';
    }

    if (code.startsWith('en')) {
        return 'en';
    }

    return code.split('-')[0] || 'auto';
}

function escapeFfmpegFilterValue(value) {
    return String(value || '')
        .replace(/\\/g, '/')
        .replace(/:/g, '\\:')
        .replace(/'/g, "\\'");
}

function parseWhisperJsonTranscript(rawValue) {
    const payload = JSON.parse(rawValue);

    if (typeof payload.text === 'string') {
        return payload.text.trim();
    }

    if (Array.isArray(payload.segments)) {
        return payload.segments
            .map((segment) => String(segment.text || '').trim())
            .filter(Boolean)
            .join(' ')
            .trim();
    }

    if (Array.isArray(payload.transcription)) {
        return payload.transcription
            .map((segment) => String(segment.text || segment.value || '').trim())
            .filter(Boolean)
            .join(' ')
            .trim();
    }

    return '';
}

async function transcribeWithWhisper(buffer, {
    modelPath,
    languageCode,
    useGpu = false,
    queueSeconds = 20
}) {
    if (!modelPath || !fs.existsSync(modelPath)) {
        throw new Error('Whisper model file was not found.');
    }

    const inputBuffer = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer || []);
    if (!inputBuffer.length) {
        throw new Error('Audio buffer is empty.');
    }

    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'yemot-whisper-'));
    const inputPath = path.join(tempDir, 'input.wav');
    const transcriptPath = path.join(tempDir, 'transcript.json');

    try {
        fs.writeFileSync(inputPath, inputBuffer);

        const filter = [
            `whisper=model='${escapeFfmpegFilterValue(path.resolve(modelPath))}'`,
            `language=${mapLanguageCodeToWhisperLanguage(languageCode)}`,
            `destination='${escapeFfmpegFilterValue(transcriptPath)}'`,
            'format=json',
            `queue=${queueSeconds}`,
            `use_gpu=${useGpu ? 'true' : 'false'}`
        ].join(':');

        await execFileAsync(
            'ffmpeg',
            [
                '-hide_banner',
                '-loglevel',
                'error',
                '-y',
                '-i',
                inputPath,
                '-af',
                filter,
                '-f',
                'null',
                '-'
            ],
            { windowsHide: true }
        );

        return parseWhisperJsonTranscript(fs.readFileSync(transcriptPath, 'utf8'));
    } catch (error) {
        throw new Error(`Whisper transcription failed: ${error.message}`);
    } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
    }
}

module.exports = {
    analyzeWavBuffer,
    normalizeAudioForTranscription,
    mapLanguageCodeToWhisperLanguage,
    parseWhisperJsonTranscript,
    transcribeWithWhisper
};
