/**
 * Email Alias Generator
 * サイトごとに使い捨てメールアドレスを生成する。
 */

function randomToken(length = 6) {
    const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
    const values = new Uint8Array(length);
    crypto.getRandomValues(values);
    return Array.from(values, (v) => chars[v % chars.length]).join("");
}

function sanitizeDomain(domain) {
    return String(domain || "")
        .replace(/^www\./, "")
        .replace(/[^a-z0-9.-]/gi, "")
        .slice(0, 30);
}

function splitEmail(email) {
    const trimmed = String(email || "").trim();
    const atIndex = trimmed.lastIndexOf("@");
    if (atIndex < 1) {
        return null;
    }
    return {
        local: trimmed.slice(0, atIndex),
        domainPart: trimmed.slice(atIndex + 1)
    };
}

/**
 * ドメイン名ベースのエイリアスを生成。
 * 例: user+amazon.co.jp_a3k9@gmail.com
 */
export function generateDomainAlias(baseEmail, siteDomain) {
    const parts = splitEmail(baseEmail);
    if (!parts) {
        throw new Error("ベースメールアドレスが不正です。");
    }

    const domain = sanitizeDomain(siteDomain);
    const token = randomToken(4);
    const tag = domain ? `${domain}_${token}` : token;
    return `${parts.local}+${tag}@${parts.domainPart}`;
}

/**
 * ランダムなエイリアスを生成。
 * 例: user+r8k3m2x9@gmail.com
 */
export function generateRandomAlias(baseEmail) {
    const parts = splitEmail(baseEmail);
    if (!parts) {
        throw new Error("ベースメールアドレスが不正です。");
    }

    const token = randomToken(8);
    return `${parts.local}+${token}@${parts.domainPart}`;
}
