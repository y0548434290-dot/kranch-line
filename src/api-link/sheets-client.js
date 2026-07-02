const { GoogleAuth } = require('google-auth-library');
const fs = require('fs');
const path = require('path');
const { ORDER_COLUMNS, RECORDING_TRANSCRIPTION_FIELDS } = require('./order-schema');
const { sendOrderConfirmationEmail } = require('./order-mailer');
const { normalizeRecordingPath, looksLikeRecordingReference } = require('./yemot-recordings');

const SHEET_NAME = 'הזמנות';

const LEGACY_ROW_LAYOUTS = {
    30: [
        'orderNumber',
        'createdAt',
        'approvedAt',
        'callId',
        'callerPhone',
        'enteredPhone',
        'idNumber',
        'pickupCity',
        'pickupArea',
        'pickupLabel',
        'productModel',
        'booksQuantity',
        'notebooksQuantity',
        'wantsHebrewName',
        'hebrewNameRecording',
        'hebrewNameRecordingTranscript',
        'hebrewNameRecordingNormalized',
        'hebrewNameRecordingConfidence',
        'hebrewNameRecordingNeedsReview',
        'hebrewNameRecordingStatus',
        'hebrewNameRecordingError',
        'hebrewFont',
        'hasEnglishLetters',
        'englishLettersRecording',
        'productsSummary',
        'quantitiesSummary',
        'orderSummaryText',
        'email',
        'orderSource',
        'status'
    ],
    48: [
        'orderNumber',
        'createdAt',
        'approvedAt',
        'callId',
        'callerPhone',
        'enteredPhone',
        'idNumber',
        'pickupCity',
        'pickupArea',
        'pickupLabel',
        'productModel',
        'booksQuantity',
        'notebooksQuantity',
        'wantsHebrewName',
        'hebrewNameRecording',
        'hebrewNameRecordingTranscript',
        'hebrewNameRecordingNormalized',
        'hebrewNameRecordingConfidence',
        'hebrewNameRecordingNeedsReview',
        'hebrewNameRecordingStatus',
        'hebrewNameRecordingError',
        'hebrewFont',
        'hasEnglishLetters',
        'englishLettersRecording',
        'englishLettersRecordingTranscript',
        'englishLettersRecordingNormalized',
        'englishLettersRecordingConfidence',
        'englishLettersRecordingNeedsReview',
        'englishLettersRecordingStatus',
        'englishLettersRecordingError',
        'englishBooksQuantity',
        'englishNotebooksQuantity',
        'wantsEnglishName',
        'englishNameLanguage',
        'englishNameRecording',
        'englishNameRecordingTranscript',
        'englishNameRecordingNormalized',
        'englishNameRecordingConfidence',
        'englishNameRecordingNeedsReview',
        'englishNameRecordingStatus',
        'englishNameRecordingError',
        'englishFont',
        'productsSummary',
        'quantitiesSummary',
        'orderSummaryText',
        'email',
        'orderSource',
        'status'
    ]
};

class OrdersSheetClient {
    constructor() {
        this.auth = null;
        this.spreadsheetId = null;
        this.initialized = false;
        this.columnLayout = ORDER_COLUMNS.map((column) => column.key);
        this.headerCount = ORDER_COLUMNS.length;
        this.emailSyncTimer = null;
        this.emailSyncInProgress = false;
        this.emailStatePath = path.resolve(__dirname, '..', '..', 'logs', 'api-link-email-state.json');
        this.emailState = { sent: {} };
    }

    async initialize() {
        const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
        const credentials = this.loadCredentials();

        if (!credentials || !spreadsheetId) {
            throw new Error('Google Sheets credentials are required. Missing Google credentials or GOOGLE_SHEETS_SPREADSHEET_ID.');
        }

        this.auth = new GoogleAuth({
            credentials,
            scopes: ['https://www.googleapis.com/auth/spreadsheets']
        });
        this.spreadsheetId = spreadsheetId;
        this.initialized = true;

        await this.ensureHeaders();
        await this.loadEmailState();
        console.log('[Sheets] Connected successfully');
        return true;
    }

    loadCredentials() {
        const bundledCredentialsPath = path.resolve(__dirname, '..', '..', 'config', 'google-credentials.json');
        if (fs.existsSync(bundledCredentialsPath)) {
            return this.parseCredentials(fs.readFileSync(bundledCredentialsPath, 'utf8'), bundledCredentialsPath);
        }

        if (process.env.GOOGLE_SHEETS_CREDENTIALS_JSON) {
            return this.parseCredentials(process.env.GOOGLE_SHEETS_CREDENTIALS_JSON, 'GOOGLE_SHEETS_CREDENTIALS_JSON');
        }

        if (process.env.GOOGLE_SHEETS_CLIENT_EMAIL && process.env.GOOGLE_SHEETS_PRIVATE_KEY) {
            return {
                type: 'service_account',
                client_email: process.env.GOOGLE_SHEETS_CLIENT_EMAIL,
                private_key: this.normalizePrivateKey(process.env.GOOGLE_SHEETS_PRIVATE_KEY)
            };
        }

        const credentialsPath = process.env.GOOGLE_SHEETS_CREDENTIALS_PATH;
        if (!credentialsPath) {
            return null;
        }

        const fullPath = path.resolve(__dirname, '..', '..', credentialsPath);
        if (!fs.existsSync(fullPath)) {
            throw new Error(`Google credentials file was not found at ${fullPath}.`);
        }

        return this.parseCredentials(fs.readFileSync(fullPath, 'utf8'), fullPath);
    }

    parseCredentials(rawValue, sourceLabel) {
        try {
            const credentials = JSON.parse(rawValue);
            if (credentials.private_key) {
                credentials.private_key = this.normalizePrivateKey(credentials.private_key);
            }
            return credentials;
        } catch (error) {
            throw new Error(`Failed parsing Google credentials from ${sourceLabel}: ${error.message}`);
        }
    }

    normalizePrivateKey(privateKey) {
        let normalized = String(privateKey || '');

        if (
            (normalized.startsWith('"') && normalized.endsWith('"')) ||
            (normalized.startsWith("'") && normalized.endsWith("'"))
        ) {
            normalized = normalized.slice(1, -1);
        }

        normalized = normalized.replace(/\r\n/g, '\n');
        normalized = normalized.replace(/\\n/g, '\n');

        if (!normalized.endsWith('\n')) {
            normalized += '\n';
        }

        return normalized;
    }

    async ensureHeaders() {
        this.assertInitialized();

        const minimumEndColumn = this.columnLetter(ORDER_COLUMNS.length - 1);
        const expected = ORDER_COLUMNS.map((column) => column.header);
        const res = await this.getSheetValues(`${SHEET_NAME}!A1:ZZ1`);
        const existing = (res.values && res.values[0]) || [];

        if (existing.length === 0) {
            await this.updateSheetValues(`${SHEET_NAME}!A1:${minimumEndColumn}1`, [expected], {
                valueInputOption: 'RAW'
            });
            this.setColumnLayout(expected);
            return;
        }

        const headers = [...existing];
        const missingHeaders = expected.filter((header) => !headers.includes(header));
        if (missingHeaders.length > 0) {
            const emptyIndexes = headers
                .map((header, index) => (String(header || '').trim() ? null : index))
                .filter((index) => index !== null);
            const fillCount = Math.min(emptyIndexes.length, missingHeaders.length);

            for (let index = 0; index < fillCount; index += 1) {
                headers[emptyIndexes[index]] = missingHeaders[index];
            }

            if (fillCount > 0) {
                await this.updateSheetValues(`${SHEET_NAME}!A1:${this.columnLetter(headers.length - 1)}1`, [headers], {
                    valueInputOption: 'RAW'
                });
            }

            const stillMissing = missingHeaders.slice(fillCount);
            if (stillMissing.length > 0) {
                const startIndex = headers.length;
                const headersToAppend = stillMissing;
                headers.push(...headersToAppend);

                await this.ensureSheetColumnCapacity(headers.length);
                await this.updateSheetValues(
                    `${SHEET_NAME}!${this.columnLetter(startIndex)}1:${this.columnLetter(headers.length - 1)}1`,
                    [headersToAppend],
                    { valueInputOption: 'RAW' }
                );
            }
        }

        this.setColumnLayout(headers);
    }

    async googleSheetsRequest(endpoint, { method = 'GET', query = {}, body = null } = {}) {
        this.assertInitialized();

        const client = await this.auth.getClient();
        const tokenResponse = await client.getAccessToken();
        const token = typeof tokenResponse === 'string' ? tokenResponse : tokenResponse?.token;
        if (!token) {
            throw new Error('Failed to acquire Google Sheets access token.');
        }

        const url = new URL(`https://sheets.googleapis.com/v4/spreadsheets/${this.spreadsheetId}${endpoint}`);
        Object.entries(query).forEach(([key, value]) => {
            if (value !== undefined && value !== null && value !== '') {
                url.searchParams.set(key, String(value));
            }
        });

        const response = await fetch(url, {
            method,
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: body ? JSON.stringify(body) : undefined
        });

        const text = await response.text();
        const data = text ? JSON.parse(text) : {};
        if (!response.ok) {
            throw new Error(data.error?.message || `Google Sheets request failed with status ${response.status}`);
        }

        return data;
    }

    async getSheetValues(range) {
        return this.googleSheetsRequest(`/values/${encodeURIComponent(range)}`);
    }

    async updateSheetValues(range, values, { valueInputOption = 'RAW' } = {}) {
        return this.googleSheetsRequest(`/values/${encodeURIComponent(range)}`, {
            method: 'PUT',
            query: { valueInputOption },
            body: { values }
        });
    }

    async ensureSheetColumnCapacity(requiredColumnCount) {
        const metadata = await this.googleSheetsRequest('', {
            query: {
                fields: 'sheets(properties(sheetId,title,gridProperties(columnCount)))'
            }
        });
        const sheet = (metadata.sheets || []).find((item) => item.properties?.title === SHEET_NAME);
        if (!sheet) {
            throw new Error(`Sheet "${SHEET_NAME}" was not found.`);
        }

        const currentColumnCount = Number(sheet.properties?.gridProperties?.columnCount || 0);
        if (currentColumnCount >= requiredColumnCount) {
            return;
        }

        await this.googleSheetsRequest(':batchUpdate', {
            method: 'POST',
            body: {
                requests: [
                    {
                        appendDimension: {
                            sheetId: sheet.properties.sheetId,
                            dimension: 'COLUMNS',
                            length: requiredColumnCount - currentColumnCount
                        }
                    }
                ]
            }
        });
    }

    async appendSheetValues(range, values, {
        valueInputOption = 'RAW',
        insertDataOption = 'INSERT_ROWS'
    } = {}) {
        return this.googleSheetsRequest(`/values/${encodeURIComponent(range)}:append`, {
            method: 'POST',
            query: { valueInputOption, insertDataOption },
            body: { values }
        });
    }

    setColumnLayout(headers) {
        const headerToKey = new Map(ORDER_COLUMNS.map((column) => [column.header, column.key]));
        this.columnLayout = headers.map((header) => headerToKey.get(header) || null);
        this.headerCount = headers.length;
    }

    async saveApprovedOrder(order) {
        this.assertInitialized();

        this.prepareOrderForSave(order);
        const row = this.orderToRow(order);
        const response = await this.appendSheetValues(`${SHEET_NAME}!A:A`, [row], {
            valueInputOption: 'RAW',
            insertDataOption: 'INSERT_ROWS'
        });

        await this.sendConfirmationIfNeeded(order, { source: 'new-order' });
        if (typeof this.afterSaveHook === 'function') {
            try {
                await this.afterSaveHook({
                    order,
                    updatedRange: response.updates?.updatedRange || null
                });
            } catch (error) {
                console.error(`[transcription] afterSaveHook failed: ${error.message}`);
            }
        }
        return response.updates?.updatedRange || null;
    }

    prepareOrderForSave(order) {
        Object.entries(RECORDING_TRANSCRIPTION_FIELDS).forEach(([recordingKey, fieldConfig]) => {
            if (!order[recordingKey]) {
                order[fieldConfig.statusKey] = order[fieldConfig.statusKey] || 'skipped';
                order[fieldConfig.finalKey] = order[fieldConfig.finalKey] || '';
                order[fieldConfig.verificationStatusKey] = order[fieldConfig.verificationStatusKey] || 'no-recording';
                return;
            }

            if (!looksLikeRecordingReference(order[recordingKey])) {
                order[fieldConfig.statusKey] = order[fieldConfig.statusKey] || 'skipped';
                order[fieldConfig.transcriptKey] = order[fieldConfig.transcriptKey] || '';
                order[fieldConfig.normalizedKey] = order[fieldConfig.normalizedKey] || '';
                order[fieldConfig.finalKey] = order[fieldConfig.finalKey] || '';
                order[fieldConfig.confidenceKey] = order[fieldConfig.confidenceKey] || '';
                order[fieldConfig.needsReviewKey] = order[fieldConfig.needsReviewKey] || '';
                order[fieldConfig.verificationStatusKey] = order[fieldConfig.verificationStatusKey] || 'not-audio';
                order[fieldConfig.errorKey] = order[fieldConfig.errorKey] || '';
                return;
            }

            order[fieldConfig.statusKey] = order[fieldConfig.statusKey] || 'pending';
            order[fieldConfig.transcriptKey] = order[fieldConfig.transcriptKey] || '';
            order[fieldConfig.normalizedKey] = order[fieldConfig.normalizedKey] || '';
            order[fieldConfig.finalKey] = order[fieldConfig.finalKey] || '';
            order[fieldConfig.confidenceKey] = order[fieldConfig.confidenceKey] || '';
            order[fieldConfig.needsReviewKey] = order[fieldConfig.needsReviewKey] || '';
            order[fieldConfig.verificationStatusKey] = order[fieldConfig.verificationStatusKey] || 'pending';
            order[fieldConfig.errorKey] = order[fieldConfig.errorKey] || '';
        });
    }

    async findOrderByNumber(orderNumber) {
        this.assertInitialized();

        // השוואה חסינה: משאירים רק ספרות ומורידים אפסים מובילים, כדי שמספר הזמנה
        // שנשמר בלי אפס מוביל (למשל "20732216") יימצא גם כשהמתקשרת מקישה את המלא
        // ("020732216"), ולהיפך. שלוחת הסטטוס דורשת לפחות 6 ספרות, אז אין התאמות ריקות.
        const normalize = (value) => String(value == null ? '' : value).replace(/\D/g, '').replace(/^0+/, '');
        const target = normalize(orderNumber);
        if (!target) {
            return null;
        }

        const orders = await this.listOrders();
        return orders.find((order) => normalize(order.orderNumber) === target) || null;
    }

    async listOrders() {
        this.assertInitialized();

        const range = `${SHEET_NAME}!A2:${this.columnLetter(this.headerCount - 1)}`;
        const response = await this.getSheetValues(range);

        return (response.values || []).map((row) => this.rowToOrder(row));
    }

    async listOrdersWithRowNumbers() {
        this.assertInitialized();

        const range = `${SHEET_NAME}!A2:${this.columnLetter(this.headerCount - 1)}`;
        const response = await this.getSheetValues(range);
        const orders = [];

        (response.values || []).forEach((values, index) => {
            const hasAnyValue = values.some((value) => String(value || '').trim() !== '');
            if (!hasAnyValue) {
                return;
            }

            orders.push(this.rowToOrder(values, index + 2));
        });

        return orders;
    }

    async updateOrderFields(rowNumber, updates) {
        this.assertInitialized();

        const endColumn = this.columnLetter(this.headerCount - 1);
        const range = `${SHEET_NAME}!A${rowNumber}:${endColumn}${rowNumber}`;
        const current = await this.getSheetValues(range);

        const existingRow = (current.values && current.values[0]) || [];
        const existingOrder = this.rowToOrder(existingRow);
        const mergedOrder = {
            ...existingOrder,
            ...updates
        };
        const values = this.orderToRow(mergedOrder);
        let hasAnyValue = false;

        this.columnLayout.forEach((key) => {
            if (!key || !Object.prototype.hasOwnProperty.call(updates, key)) {
                return;
            }

            hasAnyValue = true;
        });

        if (!hasAnyValue) {
            return null;
        }

        await this.updateSheetValues(range, [values], { valueInputOption: 'RAW' });

        return range;
    }

    // כתיבת תא בודד לפי מפתח עמודה — בלי לשכתב את כל השורה,
    // כדי לא לדרוס עריכה ידנית שמתבצעת בגיליון באותו רגע.
    async updateOrderCell(rowNumber, key, value) {
        this.assertInitialized();

        const index = this.columnLayout.indexOf(key);
        if (index === -1) {
            throw new Error(`Unknown column key: ${key}`);
        }

        const column = this.columnLetter(index);
        const range = `${SHEET_NAME}!${column}${rowNumber}`;
        await this.updateSheetValues(range, [[this.formatCellValue(key, value)]], { valueInputOption: 'RAW' });
        return range;
    }

    async getPendingTranscriptionOrders(limit = 10) {
        const orders = await this.listOrdersWithRowNumbers();
        return orders.filter((order) => this.orderNeedsTranscription(order)).slice(0, limit);
    }

    orderNeedsTranscription(order) {
        return Object.entries(RECORDING_TRANSCRIPTION_FIELDS).some(([recordingKey, fieldConfig]) => {
            if (!order[recordingKey] || !looksLikeRecordingReference(order[recordingKey])) {
                return false;
            }

            const status = String(order[fieldConfig.statusKey] || '').trim().toLowerCase();
            if (status === 'completed' || status === 'processing') {
                return false;
            }

            // אם כבר יש ערך כלשהו ב"בדיקה נדרשת" — ההקלטה כבר עובדה פעם אחת (כן/לא, או מספר ישן
            // בשורות לא-מיושרות). לא מתמללים שוב אוטומטית כדי לא לבזבז קריאות API. תמלול-מחדש ידני מאפס שדה זה.
            if (String(order[fieldConfig.needsReviewKey] || '').trim()) {
                return false;
            }

            // העמודות transcript/status כבר לא נשמרות בגיליון — ההכרעה היא לפי "סופי מאושר":
            // הקלטה חדשה (שטרם עובדה) דורשת תמלול כל עוד אין לה ערך סופי מאושר.
            return !String(order[fieldConfig.finalKey] || '').trim();
        });
    }

    startEmailSync(intervalMs = Number(process.env.API_LINK_EMAIL_SYNC_INTERVAL_MS || 60000)) {
        if (this.emailSyncTimer) {
            return;
        }

        this.syncPendingEmailConfirmations().catch((error) => {
            console.error(`[mail] Initial sheet email sync failed: ${error.message}`);
        });

        this.emailSyncTimer = setInterval(() => {
            this.syncPendingEmailConfirmations().catch((error) => {
                console.error(`[mail] Sheet email sync failed: ${error.message}`);
            });
        }, intervalMs);

        if (typeof this.emailSyncTimer.unref === 'function') {
            this.emailSyncTimer.unref();
        }

        console.log(`[mail] Sheet email sync started (${intervalMs}ms)`);
    }

    async syncPendingEmailConfirmations() {
        this.assertInitialized();

        if (this.emailSyncInProgress) {
            return;
        }

        this.emailSyncInProgress = true;
        try {
            const orders = await this.listOrders();
            let sentCount = 0;

            for (const order of orders) {
                const result = await this.sendConfirmationIfNeeded(order, { source: 'sheet-sync' });
                if (result.sent) {
                    sentCount += 1;
                }
            }

            if (sentCount > 0) {
                console.log(`[mail] Sent ${sentCount} confirmation email(s) from sheet sync`);
            }
        } finally {
            this.emailSyncInProgress = false;
        }
    }

    async sendConfirmationIfNeeded(order, options = {}) {
        const normalizedEmail = String(order.email || '').trim().toLowerCase();
        if (!normalizedEmail) {
            return { sent: false, reason: 'missing-email' };
        }

        const key = this.buildEmailStateKey({
            ...order,
            email: normalizedEmail
        });

        if (this.emailState.sent[key]) {
            return { sent: false, reason: 'already-sent' };
        }

        try {
            const mailResult = await sendOrderConfirmationEmail({
                ...order,
                email: normalizedEmail
            });

            if (mailResult.sent) {
                this.emailState.sent[key] = {
                    sentAt: new Date().toISOString(),
                    orderNumber: order.orderNumber || '',
                    email: normalizedEmail,
                    source: options.source || 'unknown'
                };
                await this.saveEmailState();
            }

            console.log(`[mail] Confirmation result for ${order.orderNumber || 'unknown'}: ${JSON.stringify(mailResult)}`);
            return mailResult;
        } catch (error) {
            console.error(`[mail] Failed sending confirmation for ${order.orderNumber || 'unknown'}: ${error.message}`);
            return { sent: false, reason: 'send-failed', error: error.message };
        }
    }

    buildEmailStateKey(order) {
        const orderId = String(order.orderNumber || order.idNumber || order.callId || '').trim();
        const email = String(order.email || '').trim().toLowerCase();
        return `${orderId}::${email}`;
    }

    async loadEmailState() {
        if (process.env.VERCEL) {
            this.emailState = { sent: {} };
            return;
        }

        const dir = path.dirname(this.emailStatePath);
        fs.mkdirSync(dir, { recursive: true });

        if (!fs.existsSync(this.emailStatePath)) {
            this.emailState = { sent: {} };
            return;
        }

        try {
            this.emailState = JSON.parse(fs.readFileSync(this.emailStatePath, 'utf8'));
            if (!this.emailState || typeof this.emailState !== 'object' || !this.emailState.sent) {
                this.emailState = { sent: {} };
            }
        } catch (error) {
            console.error(`[mail] Failed loading email sync state: ${error.message}`);
            this.emailState = { sent: {} };
        }
    }

    async saveEmailState() {
        if (process.env.VERCEL) {
            return;
        }

        const dir = path.dirname(this.emailStatePath);
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(this.emailStatePath, JSON.stringify(this.emailState, null, 2), 'utf8');
    }

    rowToOrder(row, rowNumber = null) {
        const order = {};
        const layout = this.getColumnLayoutForRow(row);

        layout.forEach((key, index) => {
            if (!key) {
                return;
            }

            order[key] = row[index] || '';
        });

        ORDER_COLUMNS.forEach((column) => {
            if (!Object.prototype.hasOwnProperty.call(order, column.key)) {
                order[column.key] = '';
            }
        });

        if (rowNumber) {
            order._rowNumber = rowNumber;
        }
        return order;
    }

    orderToRow(order) {
        return this.columnLayout.map((key) => (key ? this.formatCellValue(key, order[key] || '') : ''));
    }

    getColumnLayoutForRow(row) {
        if (this.columnLayout && this.columnLayout.length > 0) {
            return this.columnLayout;
        }

        const legacyLayout = LEGACY_ROW_LAYOUTS[row.length];
        if (legacyLayout) {
            return legacyLayout;
        }

        return ORDER_COLUMNS.map((column) => column.key);
    }

    formatCellValue(key, value) {
        // תא צ'קבוקס בגיליון חייב לקבל בוליאני אמיתי (לא המחרוזת "TRUE") —
        // אחרת שכתוב-שורה מלא (updateOrderFields) הופך אותו לטקסט ושובר את התיבה.
        if (key === 'tzintukRequested') {
            return value === true || /^true$/i.test(String(value).trim());
        }

        if (!this.isRecordingField(key)) {
            return value;
        }

        if (!looksLikeRecordingReference(value)) {
            return value;
        }

        const normalizedPath = normalizeRecordingPath(value);
        if (!normalizedPath) {
            return '';
        }

        const publicUrl = this.getPublicBaseUrl();
        if (!publicUrl) {
            return normalizedPath;
        }

        const href = `${publicUrl}/recording?path=${encodeURIComponent(normalizedPath)}`;
        return href;
    }

    isRecordingField(key) {
        return [
            'lastNameRecording',
            'hebrewNameRecording',
            'englishLettersRecording',
            'englishNameRecording'
        ].includes(key);
    }

    getPublicBaseUrl() {
        if (process.env.API_PUBLIC_URL) {
            return process.env.API_PUBLIC_URL.replace(/\/+$/, '');
        }

        if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
            return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL.replace(/^https?:\/\//, '').replace(/\/+$/, '')}`;
        }

        if (process.env.VERCEL_URL) {
            return `https://${process.env.VERCEL_URL.replace(/^https?:\/\//, '').replace(/\/+$/, '')}`;
        }

        return '';
    }

    columnLetter(index) {
        let dividend = index + 1;
        let column = '';

        while (dividend > 0) {
            const modulo = (dividend - 1) % 26;
            column = String.fromCharCode(65 + modulo) + column;
            dividend = Math.floor((dividend - modulo) / 26);
        }

        return column;
    }

    assertInitialized() {
        if (!this.initialized || !this.auth || !this.spreadsheetId) {
            throw new Error('Google Sheets client is not initialized.');
        }
    }
}

module.exports = OrdersSheetClient;
