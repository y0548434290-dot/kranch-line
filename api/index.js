const { getApiLinkApp } = require('../src/api-link/app');

module.exports = async function handler(req, res) {
    const app = await getApiLinkApp();
    return app(req, res);
};
