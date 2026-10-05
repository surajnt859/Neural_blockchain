const crypto = require("crypto");

function normalizeText(value) {
    return String(value || "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .trim();
}

function createArchitectureHash({ architecture, framework, modelFormat }) {
    const normalized = [
        normalizeText(architecture),
        normalizeText(framework),
        normalizeText(modelFormat),
    ].filter(Boolean).join("|");
    return normalized ? crypto.createHash("sha256").update(normalized).digest("hex") : null;
}

function tokenSet(value) {
    return new Set(normalizeText(value).split(/\s+/).filter((token) => token.length > 2));
}

function jaccardSimilarity(left, right) {
    const a = tokenSet(left);
    const b = tokenSet(right);
    if (a.size === 0 && b.size === 0) return 0;
    const intersection = [...a].filter((token) => b.has(token)).length;
    return intersection / (a.size + b.size - intersection);
}

function metadataSimilarity(candidate, existing) {
    const fields = [
        [candidate.name, existing.name, 0.4],
        [candidate.description, existing.description, 0.25],
        [candidate.category, existing.category, 0.2],
        [(candidate.tags || []).join(" "), (existing.tags || []).join(" "), 0.15],
    ];
    return fields.reduce((score, [left, right, weight]) => (
        score + jaccardSimilarity(left, right) * weight
    ), 0);
}

function scorePotentialDuplicates(candidate, existingModels) {
    return existingModels.map((existing) => {
        const exactHash = Boolean(candidate.modelHash && existing.modelHash &&
            candidate.modelHash.toLowerCase() === existing.modelHash.toLowerCase());
        const architectureMatch = Boolean(candidate.architectureHash &&
            existing.architectureHash &&
            candidate.architectureHash === existing.architectureHash);
        const metadataScore = metadataSimilarity(candidate, existing);
        const versionLineage = Boolean(candidate.parentModelId &&
            [existing.id, existing.parentModelId, existing.baseModelId].includes(candidate.parentModelId) ||
            existing.parentModelId === candidate.id ||
            (candidate.baseModelId && existing.baseModelId === candidate.baseModelId));
        const score = exactHash ? 1 : (
            (architectureMatch ? 0.55 : 0) +
            metadataScore * 0.3 +
            (versionLineage ? 0.15 : 0)
        );

        return {
            modelId: existing.id,
            name: existing.name,
            score: Number(score.toFixed(3)),
            exactHash,
            architectureMatch,
            metadataSimilarity: Number(metadataScore.toFixed(3)),
            versionLineage,
            needsReview: exactHash || score >= 0.65,
        };
    }).filter((match) => match.needsReview)
        .sort((left, right) => right.score - left.score);
}

module.exports = { createArchitectureHash, scorePotentialDuplicates };
