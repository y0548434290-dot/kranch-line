const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const { Pool } = require('pg');
const YemotSystem = require('./yemot-system');
const winston = require('winston');
require('../env-loader');

const app = express();
const PORT = process.env.PORT || 3000;

// לוגר ראשי
const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.printf(({ timestamp, level, message }) => {
            return `${timestamp} [${level.toUpperCase()}]: ${message}`;
        })
    ),
    transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: 'logs/app.log' })
    ]
});

// חיבור למסד נתונים
const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

// אתחול מערכת Yemot
let yemotSystem;

async function initializeSystem() {
    try {
        yemotSystem = new YemotSystem();
        await yemotSystem.initialize(pool);
        logger.info('מערכת Yemot אותחלה בהצלחה');
    } catch (error) {
        logger.error('שגיאה באתחול מערכת Yemot:', error.message);
        process.exit(1);
    }
}

// Middleware
app.use(helmet());
app.use(compression());
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 דקות
    max: 100, // 100 בקשות ל-IP
    message: 'יותר מדי בקשות, אנא נסה שוב מאוחר יותר'
});
app.use('/api/', limiter);

// Routes

// בריאות המערכת
app.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        version: '1.0.0'
    });
});

// סטטיסטיקות המערכת
app.get('/api/stats', async (req, res) => {
    try {
        const stats = await yemotSystem.getSystemStats();
        res.json({
            success: true,
            data: stats
        });
    } catch (error) {
        logger.error('שגיאה בקבלת סטטיסטיקות:', error.message);
        res.status(500).json({
            success: false,
            error: 'שגיאה בקבלת סטטיסטיקות'
        });
    }
});

// יצירת הזמנה חדשה
app.post('/api/orders', async (req, res) => {
    try {
        const orderData = req.body;
        const result = await yemotSystem.createOrder(orderData);

        res.json({
            success: true,
            data: result
        });
    } catch (error) {
        logger.error('שגיאה ביצירת הזמנה:', error.message);
        res.status(500).json({
            success: false,
            error: 'שגיאה ביצירת הזמנה'
        });
    }
});

// עדכון סטטוס הזמנה
app.put('/api/orders/:orderId/status', async (req, res) => {
    try {
        const { orderId } = req.params;
        const { status, changedBy } = req.body;

        await yemotSystem.updateOrderStatus(orderId, status, { changedBy });

        res.json({
            success: true,
            message: 'סטטוס עודכן בהצלחה'
        });
    } catch (error) {
        logger.error('שגיאה בעדכון סטטוס:', error.message);
        res.status(500).json({
            success: false,
            error: 'שגיאה בעדכון סטטוס'
        });
    }
});

// קבלת סטטוס הזמנה
app.get('/api/orders/:orderId/status', async (req, res) => {
    try {
        const { orderId } = req.params;
        const status = await yemotSystem.getOrderStatus(orderId);

        if (!status) {
            return res.status(404).json({
                success: false,
                error: 'הזמנה לא נמצאה'
            });
        }

        res.json({
            success: true,
            data: { status }
        });
    } catch (error) {
        logger.error('שגיאה בקבלת סטטוס:', error.message);
        res.status(500).json({
            success: false,
            error: 'שגיאה בקבלת סטטוס'
        });
    }
});

// יצירת לקוח חדש
app.post('/api/customers', async (req, res) => {
    try {
        const customerData = req.body;
        const result = await yemotSystem.createCustomer(customerData);

        res.json({
            success: true,
            data: result
        });
    } catch (error) {
        logger.error('שגיאה ביצירת לקוח:', error.message);
        res.status(500).json({
            success: false,
            error: 'שגיאה ביצירת לקוח'
        });
    }
});

// סנכרון מלא
app.post('/api/sync', async (req, res) => {
    try {
        const result = await yemotSystem.fullSync();

        res.json({
            success: true,
            data: result
        });
    } catch (error) {
        logger.error('שגיאה בסנכרון:', error.message);
        res.status(500).json({
            success: false,
            error: 'שגיאה בסנכרון'
        });
    }
});

// יצירת שלוחת מעקב
app.post('/api/orders/:orderId/tracking', async (req, res) => {
    try {
        const { orderId } = req.params;
        const result = await yemotSystem.createOrderTrackingExtension(orderId);

        res.json({
            success: true,
            data: result
        });
    } catch (error) {
        logger.error('שגיאה ביצירת שלוחת מעקב:', error.message);
        res.status(500).json({
            success: false,
            error: 'שגיאה ביצירת שלוחת מעקב'
        });
    }
});

// טיפול בשגיאות
app.use((err, req, res, next) => {
    logger.error('שגיאה לא מטופלת:', err);
    res.status(500).json({
        success: false,
        error: 'שגיאה פנימית בשרת'
    });
});

// טיפול בבקשות לא קיימות
app.use('*', (req, res) => {
    res.status(404).json({
        success: false,
        error: 'נתיב לא נמצא'
    });
});

// סגירת חיבורים בעת יציאה
process.on('SIGINT', async () => {
    logger.info('מקבל אות SIGINT, סוגר חיבורים...');
    if (yemotSystem) {
        await yemotSystem.shutdown();
    }
    await pool.end();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    logger.info('מקבל אות SIGTERM, סוגר חיבורים...');
    if (yemotSystem) {
        await yemotSystem.shutdown();
    }
    await pool.end();
    process.exit(0);
});

// הפעלת השרת
async function startServer() {
    try {
        await initializeSystem();

        app.listen(PORT, () => {
            logger.info(`שרת פועל על פורט ${PORT}`);
        });
    } catch (error) {
        logger.error('שגיאה בהפעלת השרת:', error.message);
        process.exit(1);
    }
}

startServer();

module.exports = app;