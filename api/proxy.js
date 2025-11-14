const fetch = require('node-fetch');
const urlModule = require('url'); // Додаємо вбудований модуль для перевірки URL

module.exports = async (req, res) => {
    const { url, token, key } = req.query;
    if (!url || !token || !key) {
        return res.status(400).send('Missing parameters');
    }

    // Перевірка, чи url є валідним абсолютним URL
    try {
        const parsedUrl = new urlModule.URL(url);
        if (!parsedUrl.protocol || !parsedUrl.hostname) {
            throw new Error('Invalid URL');
        }
    } catch (err) {
        return res.status(400).send('Invalid URL: Must be absolute (e.g., https://example.com)');
    }

    try {
        const response = await fetch(url, {
            headers: {
                Authorization: `OAuth oauth_consumer_key="${key}", oauth_token="${token}"`
            }
        });
        if (!response.ok) {
            throw new Error(`HTTP error ${response.status}`);
        }
        const buffer = await response.buffer();
        res.setHeader('Content-Type', response.headers.get('content-type'));
        res.send(buffer);
    } catch (error) {
        res.status(500).send(`Error: ${error.message}`);
    }
};
