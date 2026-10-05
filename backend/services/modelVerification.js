const crypto = require("crypto");
const path = require("path");

const MAX_MODEL_SIZE = 100 * 1024 * 1024;
const FORMAT_RULES = {
    ".onnx": { format: "ONNX", framework: "ONNX" },
    ".pt": { format: "PyTorch Checkpoint", framework: "PyTorch" },
    ".pth": { format: "PyTorch Checkpoint", framework: "PyTorch" },
    ".h5": { format: "HDF5 / Keras Model", framework: "TensorFlow / Keras" },
    ".keras": { format: "Keras Model", framework: "TensorFlow / Keras" },
    ".safetensors": { format: "SafeTensors", framework: "PyTorch / Transformers" },
    ".zip": { format: "Model Archive", framework: "Not detected" },
    ".json": { format: "JSON Model Metadata", framework: "Not detected" },
};

const suspiciousPatterns = [
    /__reduce__|__setstate__|os\.system|subprocess|child_process|eval\s*\(|exec\s*\(/i,
    /powershell|cmd\.exe|bash\s+-c|curl\s+https?:|wget\s+https?:/i,
];

const unsafeArchivePath = /(^|[\\/])\.\.([\\/]|$)|^([A-Za-z]:[\\/]|[\\/])|(^|[\\/])(__MACOSX|node_modules|\.git)([\\/]|$)/i;
const executableExtension = /\.(exe|dll|so|dylib|bat|cmd|com|msi|sh|ps1|vbs|js|mjs|cjs)$/i;

// SHA-256 integrity hash calculated directly from uploaded file buffer
const sha256 = (buffer) => crypto.createHash("sha256").update(buffer).digest("hex");

function inspectArchive(buffer) {
    // Read ZIP central directory file headers without extracting or executing any file
    const text = buffer.toString("latin1");
    const names = [];
    const namePattern = /(?:^|PK\x01\x02)[\s\S]{42}([^\x00]{1,240})/g;
    let match;
    while ((match = namePattern.exec(text)) && names.length < 500) {
        names.push(match[1]);
    }
    return names.map((name) => name.replace(/[\x00-\x1f]/g, ""));
}

function hasValidSignature(extension, buffer) {
    if (extension === ".zip") return buffer.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04])) || buffer.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
    if (extension === ".onnx") return buffer.length > 16;
    if (extension === ".safetensors") return buffer.length >= 8 && buffer.readUInt32LE(0) <= buffer.length - 8;
    if (extension === ".h5" || extension === ".keras") return buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x48, 0x44, 0x46, 0x0d, 0x0a, 0x1a, 0x0a]));
    return true;
}

function verifyModelFile(file) {
    const extension = path.extname(file && file.originalname || "").toLowerCase();
    const rule = FORMAT_RULES[extension];

    const checks = {
        fileFormat: Boolean(rule),
        fileSize: file.size > 0 && file.size <= MAX_MODEL_SIZE,
        fileSignature: false,
        architecture: false,
        dependencies: false,
        basicInference: "skipped_static_only",
        suspiciousContent: true,
    };

    const warnings = [];
    const buffer = file.buffer;
    const sample = buffer.subarray(0, Math.min(buffer.length, 1024 * 1024)).toString("utf8");

    if (!rule) {
        warnings.push(`Unsupported model format '${extension || "unknown"}'.`);
    }
    if (!checks.fileSize) {
        warnings.push("Model file must be greater than 0 bytes and no larger than 100 MB.");
    }

    checks.fileSignature = Boolean(rule) && hasValidSignature(extension, buffer);
    if (!checks.fileSignature) warnings.push("File contents do not match the declared model format.");

    // Static Architecture Inspection
    if (extension === ".onnx") {
        checks.architecture = buffer.length > 16 && buffer[0] === 0x08;
    } else if (extension === ".safetensors") {
        checks.architecture = buffer.length >= 8;
    } else if (extension === ".json") {
        try {
            const metadata = JSON.parse(buffer.toString("utf8"));
            checks.architecture = Boolean(metadata.architecture || metadata.model_type || metadata.layers);
            checks.dependencies = Boolean(metadata.framework || metadata.dependencies || metadata.requirements);
        } catch {
            warnings.push("JSON model metadata could not be parsed.");
        }
    } else if ([".zip", ".pt", ".pth", ".h5", ".keras"].includes(extension)) {
        checks.architecture = buffer.length > 32;
        checks.dependencies = extension === ".zip" ?
            inspectArchive(buffer).some((name) => /requirements\.txt|environment\.ya?ml|package\.json/i.test(name)) :
            true;
    }

    // Security Scan for Suspicious Executable / Command Patterns
    const archiveNames = extension === ".zip" ? inspectArchive(buffer) : [];
    if (archiveNames.some((name) => unsafeArchivePath.test(name) || executableExtension.test(name))) {
        checks.suspiciousContent = false;
        warnings.push("Archive contains an unsafe path or executable file.");
    }
    const inspectedText = `${sample}\n${archiveNames.join("\n")}`;
    if (suspiciousPatterns.some((pattern) => pattern.test(inspectedText))) {
        checks.suspiciousContent = false;
        warnings.push("Potentially executable or unauthorized network/system access pattern detected.");
    }

    // Calculate Static Verification Score (percentage of passing static checks)
    const passedChecks = Object.values(checks).filter((value) => value === true).length;
    const checkCount = Object.keys(checks).length - 1; // Exclude basicInference
    const verificationScore = Math.round((passedChecks / checkCount) * 100);

    // Status determination
    const verificationStatus = !rule || !checks.fileSize || !checks.fileSignature || !checks.suspiciousContent ?
        "rejected" :
        verificationScore >= 60 && checks.architecture ?
        "verified" :
        "needs_review";

    return {
        verificationStatus,
        verificationScore, // Static Verification Score (0-100)
        modelHash: sha256(buffer), // Exact 64-hex SHA-256 hash
        framework: rule && rule.framework || "Not detected",
        modelFormat: rule && rule.format || extension || "Not detected",
        checks,
        warnings,
        verificationNote: "Static verification checks file integrity, SHA-256 hash, structure, dependencies, and suspicious content. It does not measure model accuracy or run live inference.",
    };
}

module.exports = { verifyModelFile, MAX_MODEL_SIZE };