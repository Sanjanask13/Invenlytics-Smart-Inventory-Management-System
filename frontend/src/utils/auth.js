const MERCHANT_STORAGE_KEY = "merchant";
const MERCHANT_TOKEN_KEY = "merchant_token";
const STORE_ID_KEY = "store_id";

export function getStoredMerchant() {
  try {
    const rawMerchant = localStorage.getItem(MERCHANT_STORAGE_KEY);
    return rawMerchant ? JSON.parse(rawMerchant) : null;
  } catch (error) {
    return null;
  }
}

export function getMerchantToken() {
  return localStorage.getItem(MERCHANT_TOKEN_KEY);
}

export function getStoredStoreId() {
  return localStorage.getItem(STORE_ID_KEY);
}

export function isMerchantAuthenticated() {
  return Boolean(getMerchantToken() && getStoredMerchant());
}

export function persistMerchantSession(merchant, token) {
  if (!merchant) {
    return;
  }

  const sessionToken =
    token ||
    `merchant-${merchant.merchant_id || merchant.email || Date.now()}`;

  localStorage.setItem(MERCHANT_STORAGE_KEY, JSON.stringify(merchant));
  localStorage.setItem(MERCHANT_TOKEN_KEY, sessionToken);
  if (merchant.store_id) {
    localStorage.setItem(STORE_ID_KEY, merchant.store_id);
  }
}

export function clearMerchantSession() {
  localStorage.removeItem(MERCHANT_STORAGE_KEY);
  localStorage.removeItem(MERCHANT_TOKEN_KEY);
  localStorage.removeItem(STORE_ID_KEY);
}
