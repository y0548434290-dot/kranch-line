require('../../env-loader');
const express = require('express');
const path = require('path');
const { YemotRouter } = require('yemot-router2');

const OrdersSheetClient = require('./sheets-client');
const { handleOrderCall, handleStatusCall, handleEntryCall } = require('./order-flow');
const { validateWebOrder, createWebOrder } = require('./web-order');
const { downloadRecording } = require('./yemot-recordings');
const TranscriptionService = require('./transcription-service');
const TzintukService = require('./tzintuk-service');

let appPromise = null;

async function createApiLinkApp() {
    const app = express();
    app.use(express.urlencoded({ extended: true }));
    app.use(express.json());
    app.use('/form-assets', express.static(path.join(__dirname, 'public')));

    const sheets = new OrdersSheetClient();
    await sheets.initialize();
    const tzintuk = new TzintukService(sheets);
    const transcriptionService = new TranscriptionService();
    let transcriptionInProgress = false;

    const processPendingTranscriptions = async (limit = 10) => {
        if (transcriptionInProgress) {
            return { skipped: true, reason: 'already-running' };
        }

        transcriptionInProgress = true;
        try {
            return await transcriptionService.processPendingOrders(sheets, { limit });
        } finally {
            transcriptionInProgress = false;
        }
    };

    sheets.afterSaveHook = async ({ order, updatedRange }) => {
        if (!sheets.orderNeedsTranscription(order)) {
            return;
        }

        const rowNumber = extractRowNumber(updatedRange);
        if (!rowNumber) {
            return;
        }

        // התמלול רץ מיד עם כניסת השורה, אבל לא חוסם את השיחה/הבקשה.
        // keepAliveUntil מבטיח שב-Vercel הפונקציה תישאר חיה עד שהתמלול יסתיים (מיידי ואמין),
        // והסריקה התקופתית (Cron) נשארת רק כרשת ביטחון למקרי קצה.
        const backgroundJob = Promise.resolve()
            .then(() => transcriptionService.processOrder(sheets, {
                ...order,
                _rowNumber: rowNumber
            }, {
                retryOptions: {
                    attempts: Number(process.env.TRANSCRIPTION_AUTO_ATTEMPTS || 2),
                    initialDelayMs: Number(process.env.TRANSCRIPTION_AUTO_INITIAL_DELAY_MS || 10000),
                    retryDelayMs: Number(process.env.TRANSCRIPTION_AUTO_RETRY_DELAY_MS || 10000)
                }
            }))
            .catch((error) => {
                console.error(`[transcription] background processOrder failed: ${error.message}`);
            });

        keepAliveUntil(backgroundJob);
    };

    if (!process.env.VERCEL && process.env.API_LINK_ENABLE_EMAIL_SYNC !== 'no') {
        sheets.startEmailSync();
    }

    if (!process.env.VERCEL && process.env.API_LINK_ENABLE_TZINTUK !== 'no') {
        tzintuk.start(Number(process.env.API_LINK_TZINTUK_POLL_MS || 40000));
    }

    if (!process.env.VERCEL && process.env.API_LINK_ENABLE_TRANSCRIPTION_SYNC !== 'no') {
        const transcriptionIntervalMs = Number(process.env.API_LINK_TRANSCRIPTION_SYNC_INTERVAL_MS || 120000);
        setInterval(() => {
            processPendingTranscriptions().catch((error) => {
                console.error(`[transcription] Background sync failed: ${error.message}`);
            });
        }, transcriptionIntervalMs).unref?.();
    }

    const router = YemotRouter({
        printLog: true,
        defaults: {
            removeInvalidChars: true,
            read: {
                removeInvalidChars: true
            },
            id_list_message: {
                removeInvalidChars: true
            }
        },
        timeout: '30m',
        uncaughtErrorHandler: (error, call) => {
            console.error(`[server] Call ${call.callId} failed: ${error.stack}`);
            return call.id_list_message([
                { type: 'text', data: 'אירעה תקלה זמנית. אנא נסי שוב מאוחר יותר' }
            ], { removeInvalidChars: true });
        }
    });

    router.events.on('new_call', (call) => {
        console.log(`[server] New call ${call.callId}`);
    });

    router.events.on('call_hangup', (call) => {
        console.log(`[server] Call ended ${call.callId}`);
    });

    router.all('/entry', async (call) => handleEntryCall(call, sheets, tzintuk));
    router.all('/order', async (call) => handleOrderCall(call, sheets));
    router.all('/status', async (call) => handleStatusCall(call, sheets));

    app.use('/yemot', router);

    app.get('/', (req, res) => {
        res.redirect('/order-form');
    });

    app.get('/order-form', (req, res) => {
        res.sendFile(path.join(__dirname, 'public', 'order-form.html'));
    });

    app.get('/order-thanks', (req, res) => {
        res.sendFile(path.join(__dirname, 'public', 'order-thanks.html'));
    });

    app.get('/recording', async (req, res) => {
        try {
            const { path: recordingPath } = req.query;
            const recording = await downloadRecording(recordingPath);
            res.setHeader('Content-Type', 'audio/wav');
            res.setHeader('Content-Disposition', `inline; filename="${recording.fileName}"`);
            return res.send(recording.buffer);
        } catch (error) {
            console.error(`[recording] Failed: ${error.stack || error.message || error}`);
            return res.status(404).json({ success: false, error: 'Recording not found' });
        }
    });

    app.get('/internal/process-transcriptions', async (req, res) => {
        try {
            // אבטחה: מאפשרים הפעלה ע"י Vercel Cron (Authorization: Bearer CRON_SECRET)
            // או ע"י טוקן ידני (TRANSCRIPTION_PROCESS_TOKEN). אם לא הוגדר אף מנגנון — פתוח (תאימות לאחור).
            const cronSecret = process.env.CRON_SECRET;
            const expectedToken = process.env.TRANSCRIPTION_PROCESS_TOKEN;
            const authHeader = req.get('authorization') || '';
            const receivedToken = req.get('x-transcription-token') || req.query.token;

            const isVercelCron = !!cronSecret && authHeader === `Bearer ${cronSecret}`;
            const isValidToken = !!expectedToken && receivedToken === expectedToken;
            const securityConfigured = !!cronSecret || !!expectedToken;
            if (securityConfigured && !isVercelCron && !isValidToken) {
                return res.status(401).json({ success: false, error: 'Unauthorized' });
            }

            const limit = Number(req.query.limit || 10);
            const result = await processPendingTranscriptions(limit);
            return res.json({ success: true, ...result });
        } catch (error) {
            console.error(`[transcription] Manual run failed: ${error.stack || error.message || error}`);
            return res.status(500).json({ success: false, error: error.message });
        }
    });

    app.post('/web-order', async (req, res) => {
        try {
            const errors = validateWebOrder(req.body);
            if (errors.length > 0) {
                return res.status(400).json({ success: false, errors });
            }

            const order = createWebOrder(req.body);
            const savedRange = await sheets.saveApprovedOrder(order);
            return res.json({
                success: true,
                orderNumber: order.orderNumber,
                savedRange,
                thankYouUrl: `/order-thanks?orderNumber=${encodeURIComponent(order.orderNumber)}&hasEmail=${order.email ? '1' : '0'}`
            });
        } catch (error) {
            console.error(`[web-order] Failed: ${error.stack || error.message || error}`);
            return res.status(500).json({
                success: false,
                error: 'אירעה תקלה בשמירת ההזמנה'
            });
        }
    });

    app.get('/health', (req, res) => {
        res.setHeader('Cache-Control', 'no-store');
        res.json({
            status: 'ok',
            sheets: sheets.initialized ? 'connected' : 'disconnected',
            timestamp: new Date().toISOString()
        });
    });

    return app;
}

function getApiLinkApp() {
    if (!appPromise) {
        appPromise = createApiLinkApp().catch((error) => {
            appPromise = null;
            throw error;
        });
    }

    return appPromise;
}

module.exports = {
    createApiLinkApp,
    getApiLinkApp
};

function extractRowNumber(updatedRange) {
    const match = String(updatedRange || '').match(/(\d+):[A-Z]+(\d+)$/i);
    if (!match) {
        return null;
    }

    return Number(match[1]);
}

// משאיר את הפונקציה של Vercel חיה עד שהמשימה ברקע מסתיימת (waitUntil),
// בלי לעכב את התשובה ללקוח. מחוץ ל-Vercel (מקומי) — המשימה פשוט ממשיכה ברקע.
function keepAliveUntil(promise) {
    try {
        const requestContext = globalThis[Symbol.for('@vercel/request-context')];
        const context = typeof requestContext?.get === 'function' ? requestContext.get() : null;
        if (context && typeof context.waitUntil === 'function') {
            context.waitUntil(promise);
        }
    } catch (error) {
        console.error(`[transcription] keepAliveUntil unavailable: ${error.message}`);
    }

    return promise;
}
