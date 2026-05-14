import axios from "axios";
import { getMerchantToken, getStoredMerchant, getStoredStoreId } from "../utils/auth";

const API = axios.create({
  baseURL: "http://localhost:5000",
  withCredentials: true
});

API.interceptors.request.use((config) => {
  const merchant = getStoredMerchant();
  const merchantId = merchant?.merchant_id;
  const storeId = merchant?.store_id || getStoredStoreId();
  const token = getMerchantToken();
  const nextConfig = { ...config };

  nextConfig.headers = {
    ...(config.headers || {}),
    ...(merchantId ? { "X-Merchant-Id": String(merchantId) } : {}),
    ...(storeId ? { "X-Store-Id": String(storeId) } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  if (storeId) {
    nextConfig.params = {
      ...(config.params || {}),
      ...(config.params?.store_id ? {} : { store_id: storeId }),
    };

    const method = String(config.method || "get").toLowerCase();
    const canAttachBody = ["post", "put", "patch", "delete"].includes(method);
    if (
      canAttachBody &&
      config.data &&
      typeof config.data === "object" &&
      !Array.isArray(config.data) &&
      !("store_id" in config.data)
    ) {
      nextConfig.data = {
        ...config.data,
        store_id: storeId,
      };
    }
  }

  return nextConfig;
});

export default API;
