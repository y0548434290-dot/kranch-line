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
}

main().catch((err) => {
    console.error('[server] Fatal startup error:', err.message);
    process.exit(1);
});
