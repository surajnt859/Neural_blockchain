const axios = require('axios');
const jwt = require('jsonwebtoken');

(async() => {
    try {
        const API = process.env.API_URL || 'http://localhost:5000';
        let secret = process.env.JWT_SECRET || 'fallback_secret';
        // If a backend .env exists, prefer that secret to create a valid token
        try {
            const fs = require('fs');
            const path = require('path');
            const envPath = path.join(__dirname, '..', '.env');
            if (fs.existsSync(envPath)) {
                const env = fs.readFileSync(envPath, 'utf8');
                const match = env.match(/^JWT_SECRET=(.*)$/m);
                if (match) {
                    const fileSecret = match[1].trim();
                    if (fileSecret) {
                        // override secret
                        // console.log('Using JWT_SECRET from backend .env');
                        secret = fileSecret;
                    }
                }
            }
        } catch (e) {
            // ignore
        }
        // For demo, if JWT_SECRET is not set in env, create a token using the same fallback_secret

        const payload = {
            id: 'demo-user-1',
            username: 'demo',
            email: 'demo@example.com',
            walletAddress: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
        };

        const token = jwt.sign(payload, secret, { expiresIn: '7d' });
        console.log('Using JWT secret length:', String((secret || '').length));
        console.log('Generated token preview:', token.slice(0, 20) + '...');

        const body = {
            name: `Demo Model ${Date.now()}`,
            description: 'Programmatic demo listing created by agent',
            ipfsHash: `QmDemo${Date.now()}`,
            price: 0,
            txHash: '0x' + Buffer.from(String(Date.now())).toString('hex').padEnd(64, '0'),
            contractModelId: '1',
            tags: ['demo', 'agent'],
        };

        console.log('Posting demo listing to', `${API}/api/models`);
        const res = await axios.post(`${API}/api/models`, body, {
            headers: { Authorization: `Bearer ${token}` },
            timeout: 10000,
        });

        console.log('Response status:', res.status);
        console.log('Response data:', JSON.stringify(res.data, null, 2));
    } catch (err) {
        try {
            console.error('Demo listing failed - full error:');
            console.error(err && err.response ? err.response.data : err && err.message ? err.message : err);
            console.error('Axios error details:', JSON.stringify(err, Object.getOwnPropertyNames(err), 2));
        } catch (e) {
            console.error('Failed to print error details:', e.message || e);
        }
        process.exit(1);
    }
})();