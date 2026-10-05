const { ethers } = require("ethers");

// NeuralToken.sol uses standard ERC20 with 10**18 in MAX_SUPPLY (18 decimals).
const NEURAL_DECIMALS = 18;

/**
 * Returns true when the stored value is an integer in base units (wei / token smallest unit).
 * Legacy migrated records may store human-readable decimals (e.g. "0.05").
 */
function isBaseUnitAmount(paymentAmount) {
  const raw = String(paymentAmount ?? "").trim();
  if (!raw || raw === "0") return false;
  if (raw.includes(".")) return false;
  try {
    const value = BigInt(raw);
    // Sub-wei fractional ETH is not representable as an integer base-unit string.
    return value >= 10n ** 12n;
  } catch {
    return false;
  }
}

/**
 * Convert stored paymentAmount to human-readable units for dashboard display.
 * Does not mutate stored data.
 */
function toDisplayPaymentAmount(paymentAmount, paymentMethod) {
  const method = paymentMethod === "NEURAL" ? "NEURAL" : "ETH";
  const raw = paymentAmount ?? "0";

  if (method === "ETH") {
    if (isBaseUnitAmount(raw)) {
      return Number(ethers.formatEther(String(raw)));
    }
    return Number(raw) || 0;
  }

  if (isBaseUnitAmount(raw)) {
    return Number(ethers.formatUnits(String(raw), NEURAL_DECIMALS));
  }
  return Number(raw) || 0;
}

module.exports = {
  NEURAL_DECIMALS,
  isBaseUnitAmount,
  toDisplayPaymentAmount,
};
