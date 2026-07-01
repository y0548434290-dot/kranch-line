require('./env-loader');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

async function maybeFill(page, selectors, value) {
    for (const selector of selectors) {
        const locator = page.locator(selector);
        if (await locator.count()) {
            const target = locator.first();
            if (await target.isVisible().catch(() => false)) {
                await target.fill(value);
                return true;
            }
        }
    }
    return false;
}

async function waitAndFill(page, selectors, value, timeout = 30000) {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
        for (const selector of selectors) {
            const locator = page.locator(selector).first();
            if (await locator.count().catch(() => 0)) {
                if (await locator.isVisible().catch(() => false)) {
                    await locator.fill(value);
                    return true;
                }
            }
        }
        await page.waitForTimeout(250);
    }
    return false;
}

async function maybeClick(page, selectors) {
    for (const selector of selectors) {
        const locator = page.locator(selector);
        if (await locator.count()) {
            const target = locator.first();
            if (await target.isVisible().catch(() => false)) {
                await target.click();
                return true;
            }
        }
    }
    return false;
}

async function main() {
    const username = process.env.NOTEBOOKLM_USERNAME;
    const password = process.env.NOTEBOOKLM_PASSWORD;
    const notebookUrl = process.env.NOTEBOOKLM_NOTEBOOK_URL;

    if (!username || !password || !notebookUrl) {
        throw new Error('Missing NotebookLM credentials or URL in environment.');
    }

    const browser = await chromium.launch({
        channel: 'msedge',
        headless: true
    });

    const context = await browser.newContext();
    const page = await context.newPage();

    try {
        await page.goto(notebookUrl, { waitUntil: 'domcontentloaded', timeout: 120000 });

        await waitAndFill(page, ['input[type="email"]', 'input[type="text"]', '#identifierId'], username, 60000);
        await maybeClick(page, ['#identifierNext button', 'button:has-text("Next")']);
        await page.waitForLoadState('domcontentloaded', { timeout: 60000 }).catch(() => {});

        await waitAndFill(page, ['input[name="Passwd"]', 'input[type="password"]'], password, 60000);
        await maybeClick(page, ['#passwordNext button', 'button:has-text("Next")']);
        await page.waitForTimeout(10000);
        await page.waitForLoadState('domcontentloaded', { timeout: 60000 }).catch(() => {});

        const text = await page.locator('body').innerText({ timeout: 30000 });
        const outPath = path.resolve(__dirname, 'logs', 'notebooklm-dump.txt');
        fs.writeFileSync(outPath, text, 'utf8');
        console.log(outPath);
        console.log(text.slice(0, 5000));
    } finally {
        await browser.close();
    }
}

main().catch((error) => {
    console.error(error.stack || error.message);
    process.exit(1);
});
