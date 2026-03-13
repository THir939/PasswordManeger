import webCrypto from "expo-standard-web-crypto";

let initialized = false;

export function ensureMobileCryptoReady() {
    if (initialized) {
        return globalThis.crypto;
    }

    if (!globalThis.crypto?.getRandomValues) {
        globalThis.crypto = webCrypto;
    }

    if (!globalThis.crypto?.getRandomValues) {
        throw new Error("端末の安全な乱数 API を初期化できませんでした。");
    }

    initialized = true;
    return globalThis.crypto;
}
