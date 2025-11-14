const fetch = require('node-fetch');

module.exports = async (req, res) => {
    const { url, token, key } = req.query;
    if (!url || !token || !key) {
        return res.status(400).send('Missing parameters');
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
