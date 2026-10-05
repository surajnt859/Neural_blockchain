const crypto = require("crypto");

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;

function getMasterKey() {
    const encoded = process.env.MODEL_ENCRYPTION_SECRET;
    if (!encoded) {
        throw new Error("MODEL_ENCRYPTION_SECRET must be configured before paid model uploads are enabled.");
    }

    const key = Buffer.from(encoded, "base64");
    if (key.length !== 32 || key.toString("base64") !== encoded) {
        throw new Error("MODEL_ENCRYPTION_SECRET must be a base64-encoded 32-byte secret.");
    }
    return key;
}

function encryptModelBuffer(buffer) {
    if (!Buffer.isBuffer(buffer)) throw new TypeError("Model content must be a Buffer.");

    const contentKey = crypto.randomBytes(32);
    const contentIv = crypto.randomBytes(IV_LENGTH);
    const contentCipher = crypto.createCipheriv(ALGORITHM, contentKey, contentIv);
    const encryptedData = Buffer.concat([contentCipher.update(buffer), contentCipher.final()]);

    const wrapIv = crypto.randomBytes(IV_LENGTH);
    const keyCipher = crypto.createCipheriv(ALGORITHM, getMasterKey(), wrapIv);
    const wrappedKey = Buffer.concat([keyCipher.update(contentKey), keyCipher.final()]);

    return {
        encryptedData,
        contentIv: contentIv.toString("hex"),
        contentAuthTag: contentCipher.getAuthTag().toString("hex"),
        wrappedKey: wrappedKey.toString("base64"),
        wrapIv: wrapIv.toString("hex"),
        wrapAuthTag: keyCipher.getAuthTag().toString("hex"),
        keyHash: crypto.createHash("sha256").update(contentKey).digest("hex"),
        contentHash: crypto.createHash("sha256").update(buffer).digest("hex"),
        encryptedHash: crypto.createHash("sha256").update(encryptedData).digest("hex"),
    };
}

function unwrapModelKey({ wrappedKey, wrapIv, wrapAuthTag }) {
    const decipher = crypto.createDecipheriv(
        ALGORITHM,
        getMasterKey(),
        Buffer.from(wrapIv, "hex")
    );
    decipher.setAuthTag(Buffer.from(wrapAuthTag, "hex"));
    return Buffer.concat([
        decipher.update(Buffer.from(wrappedKey, "base64")),
        decipher.final(),
    ]);
}

function decryptModelBuffer(encryptedBuffer, contentKey, contentIv, contentAuthTag) {
    const decipher = crypto.createDecipheriv(
        ALGORITHM,
        Buffer.from(contentKey),
        Buffer.from(contentIv, "hex")
    );
    decipher.setAuthTag(Buffer.from(contentAuthTag, "hex"));
    return Buffer.concat([decipher.update(encryptedBuffer), decipher.final()]);
}

module.exports = { encryptModelBuffer, unwrapModelKey, decryptModelBuffer };
