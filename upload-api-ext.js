require('./env-loader');
const YemotApiWrapper = require('./src/ivr/yemot-api-wrapper');

function buildApiIni(targetUrl) {
    return [
        'type=api',
        `api_link=${targetUrl}`,
        'api_url_post=yes',
        'api_hangup_send=yes'
    ].join('\n');
}

async function upload() {
    const publicUrl = process.env.API_PUBLIC_URL;
    if (!publicUrl) {
        throw new Error('Missing API_PUBLIC_URL. Provide a public base URL before uploading API ext.ini files.');
    }

    const cleanBaseUrl = publicUrl.replace(/\/+$/, '');
    const api = new YemotApiWrapper();
    await api.connect(
        process.env.YEMOT_USERNAME,
        process.env.YEMOT_PASSWORD,
        process.env.YEMOT_SERVER
    );

    try {
        await api.create_ext('/0/3/1');
        await api.create_ext('/0/5');
        await api.upload_txt_file('0/3/1/ext.ini', buildApiIni(`${cleanBaseUrl}/yemot/order`));
        await api.upload_txt_file('0/5/ext.ini', buildApiIni(`${cleanBaseUrl}/yemot/status`));
        console.log('Uploaded API ext.ini files successfully.');
    } finally {
        await api.disconnect();
    }
}

upload().catch((error) => {
    console.error(error.message);
    process.exit(1);
});
