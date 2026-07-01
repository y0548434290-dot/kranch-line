const http = require('http');

function post(body) {
    return new Promise((resolve, reject) => {
        const encoded = new URLSearchParams(body).toString();
        const req = http.request({
            hostname: '127.0.0.1',
            port: 3001,
            path: '/yemot/order',
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Length': Buffer.byteLength(encoded)
            }
        }, (res) => {
            let data = '';
            res.on('data', (chunk) => {
                data += chunk;
            });
            res.on('end', () => {
                resolve({ statusCode: res.statusCode, body: data });
            });
        });

        req.on('error', reject);
        req.write(encoded);
        req.end();
    });
}

(async () => {
    const base = {
        ApiCallId: 'sim-order-1',
        ApiPhone: '0500000000',
        ApiDID: '0779709807',
        ApiRealDID: '0779709807',
        ApiExtension: '0/3/1',
        ApiTime: `${Math.floor(Date.now() / 1000)}`
    };

    const step1 = await post(base);
    console.log('STEP1', step1.statusCode, step1.body);

    const step2 = await post({
        ...base,
        val_1: '0501234567'
    });
    console.log('STEP2', step2.statusCode, step2.body);

    const step3 = await post({
        ...base,
        val_1: '0501234567',
        val_2: '1'
    });
    console.log('STEP3', step3.statusCode, step3.body);
})().catch((error) => {
    console.error(error.message);
    process.exit(1);
});
