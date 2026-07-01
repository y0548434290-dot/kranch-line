const { getApiLinkApp } = require('./app');

async function main() {
    const app = await getApiLinkApp();
    // Render/אירוח קבוע מזריקים PORT — חובה להאזין עליו. מקומית נופל ל-API_LINK_PORT/3001.
    const port = process.env.PORT || process.env.API_LINK_PORT || 3001;

    app.listen(port, () => {
        console.log(`[server] Listening on port ${port}`);
        console.log(`[server] Order endpoint http://localhost:${port}/yemot/order`);
        console.log(`[server] Status endpoint http://localhost:${port}/yemot/status`);
    });

    // שמירה על השרת ער ב-Render (החינמי): פינג עצמי כל 10 דקות. תעבורה נכנסת
    // מאפסת את טיימר ההירדמות (15 דק'), כך שהשיחה הראשונה אחרי שקט לא סובלת
    // מ-cold start (~50 שניות). רץ רק ב-Render (RENDER מוגדר אוטומטית שם).
    if (process.env.RENDER && process.env.RENDER_EXTERNAL_URL) {
        const pingUrl = `${process.env.RENDER_EXTERNAL_URL.replace(/\/+$/, '')}/health`;
        setInterval(() => {
            fetch(pingUrl).catch(() => {});
        }, 10 * 60 * 1000);
        console.log(`[server] Keep-alive self-ping enabled → ${pingUrl}`);
    }
}

main().catch((err) => {
    console.error('[server] Fatal startup error:', err.message);
    process.exit(1);
});
