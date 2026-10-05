const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

(async() => {
    try {
        const envPath = path.join(__dirname, '..', '.env');
        let mongoUri = process.env.MONGODB_URI;
        if (fs.existsSync(envPath)) {
            const env = fs.readFileSync(envPath, 'utf8');
            const m = env.match(/^MONGODB_URI=(.*)$/m);
            if (m) mongoUri = mongoUri || m[1].trim();
        }
        if (!mongoUri) throw new Error('MONGODB_URI not found');

        await mongoose.connect(mongoUri);
        console.log('Connected to MongoDB');

        const Purchase = require('../models/Purchase');
        const Model = require('../models/Model');

        // find a demo model to purchase
        const demoModel = await Model.findOne({ tags: { $in: ['demo', 'agent'] } }) || await Model.findOne({ ownerWallet: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266' });
        if (!demoModel) throw new Error('No demo model found to mark purchase');

        const purchase = new Purchase({
            id: Date.now().toString(),
            modelId: demoModel.id,
            contractModelId: demoModel.contractModelId || '1',
            buyerUserId: 'demo-user-1',
            buyerWallet: '0x8626f6940E2eb28930eFb4CeF49B2d1F2C9C1199',
            sellerWallet: demoModel.ownerWallet || '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
            paymentMethod: 'ETH',
            paymentAmount: String(Math.round((demoModel.price || 0) * 1e18)),
            transactionHash: '0x' + Buffer.from(String(Date.now())).toString('hex').padEnd(64, '0'),
            verificationStatus: 'verified',
            verificationTime: new Date(),
            ipfsCID: demoModel.ipfsHash,
            modelHash: demoModel.modelHash || null,
            createdAt: new Date(),
        });

        await purchase.save();
        console.log('Purchase saved:', purchase.transactionHash);

        // update model downloads and purchases
        demoModel.purchases = demoModel.purchases || [];
        if (!demoModel.purchases.includes('demo-user-1')) demoModel.purchases.push('demo-user-1');
        demoModel.downloads = (demoModel.downloads || 0) + 1;
        await demoModel.save();
        console.log('Model updated with purchase and downloads incremented');

        await mongoose.disconnect();
        console.log('Done');
    } catch (e) {
        console.error('Failed:', e.message || e);
        process.exit(1);
    }
})();