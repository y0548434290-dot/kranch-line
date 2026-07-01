require('./env-loader');
const fs = require('fs');
const path = require('path');
const YemotApiWrapper = require('./src/ivr/yemot-api-wrapper');

const ROOT = path.join(__dirname, 'ivr_build');

function toRemotePath(localPath) {
    const relative = path.relative(ROOT, localPath).replace(/\\/g, '/');
    return relative === 'ext.ini' ? 'ext.ini' : relative;
}

async function uploadExtFiles(api, dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
            await uploadExtFiles(api, fullPath);
            continue;
        }

        if (entry.name !== 'ext.ini') {
            continue;
        }

        const remotePath = toRemotePath(fullPath);
        const remoteDir = path.dirname(remotePath).replace(/\\/g, '/').replace(/^\.$/, '');
        const extPath = remoteDir ? `/${remoteDir}` : '/';
        const contents = fs.readFileSync(fullPath, 'utf8');

        if (remoteDir) {
            await api.create_ext(extPath);
        }

        await api.upload_txt_file(remotePath, contents);
        console.log(`Uploaded ${remotePath}`);
    }
}

async function main() {
    const api = new YemotApiWrapper();
    await api.connect(
        process.env.YEMOT_USERNAME,
        process.env.YEMOT_PASSWORD,
        process.env.YEMOT_SERVER
    );

    try {
        await uploadExtFiles(api, ROOT);
        console.log('Uploaded all ivr_build ext.ini files successfully.');
    } finally {
        await api.disconnect();
    }
}

main().catch((error) => {
    console.error(error.message || error);
    process.exit(1);
});
