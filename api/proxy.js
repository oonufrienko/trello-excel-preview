const fetch = require('node-fetch');
const urlModule = require('url');

module.exports = async (req, res) => {
    const { url, token, key } = req.query;
    if (!url || !token || !key) {
        return res.status(400).send('Missing parameters');
    }

    try {
        const parsedUrl = new urlModule.URL(url);
        if (!parsedUrl.protocol || !parsedUrl.hostname) {
            throw new Error('Invalid URL');
        }
    } catch (err) {
        return res.status(400).send('Invalid URL: Must be absolute');
    }

    try {
        console.log('Proxy fetch URL:', url);
        console.log('Proxy token:', token); // Дебаг: токен
        const response = await fetch(url, {
            headers: {
                Authorization: `OAuth oauth_consumer_key="${key}", oauth_token="${token}"`
            }
        });
        console.log('Proxy response status:', response.status);
        if (!response.ok) {
            const text = await response.text();
            console.error('Proxy response body:', text);
            throw new Error(`HTTP error ${response.status} - ` + text);
        }
        const buffer = await response.buffer();
        console.log('Proxy buffer size:', buffer.length);
        res.setHeader('Content-Type', response.headers.get('content-type'));
        res.send(buffer);
    } catch (error) {
        console.error('Proxy error:', error.message);
        res.status(500).send(`Error: ` + error.message);
    }
};
