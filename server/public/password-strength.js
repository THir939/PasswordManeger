const SYMBOLS = "!@#$%^&*()-_=+[]{};:,.?/";
const KEYBOARD_ROWS = ["qwertyuiop", "asdfghjkl", "zxcvbnm", "1234567890"];
const COMMON_PATTERNS = [
  "password",
  "passw0rd",
  "qwerty",
  "letmein",
  "admin",
  "welcome",
  "iloveyou",
  "abc123",
  "123456",
  "12345678",
  "111111",
  "000000"
];

function hasStraightSequence(value, minLength = 4) {
  if (value.length < minLength) {
    return false;
  }

  let asc = 1;
  let desc = 1;

  for (let index = 1; index < value.length; index += 1) {
    const prevCode = value.charCodeAt(index - 1);
    const currentCode = value.charCodeAt(index);

    if (currentCode === prevCode + 1) {
      asc += 1;
    } else {
      asc = 1;
    }

    if (currentCode === prevCode - 1) {
      desc += 1;
    } else {
      desc = 1;
    }

    if (asc >= minLength || desc >= minLength) {
      return true;
    }
  }

  return false;
}

function hasKeyboardWalk(value, minLength = 4) {
  return KEYBOARD_ROWS.some((row) => {
    const reversed = [...row].reverse().join("");
    for (let length = minLength; length <= row.length; length += 1) {
      for (let index = 0; index <= row.length - length; index += 1) {
        const chunk = row.slice(index, index + length);
        const reverseChunk = reversed.slice(index, index + length);
        if (value.includes(chunk) || value.includes(reverseChunk)) {
          return true;
        }
      }
    }
    return false;
  });
}

function buildFeedback(payload) {
  const feedback = [];

  if (payload.length < 14) {
    feedback.push("14文字以上にすると安全性が上がります。");
  }
  if (!payload.hasLower || !payload.hasUpper || !payload.hasNumber || !payload.hasSymbol) {
    feedback.push("英大文字・英小文字・数字・記号を混ぜると推測されにくくなります。");
  }
  if (payload.hasTripleRepeat || payload.hasRepeatedChunk) {
    feedback.push("同じ文字や語句の繰り返しを減らしてください。");
  }
  if (payload.hasSequence || payload.hasKeyboardPattern) {
    feedback.push("連番やキーボード配列の並びは避けてください。");
  }
  if (payload.hasCommonPattern) {
    feedback.push("よく使われる単語を含まない文字列に変更してください。");
  }

  if (!feedback.length) {
    feedback.push("このパスワードは十分に強力です。");
  }

  return feedback;
}

export function passwordStrength(password) {
  const value = String(password || "");

  if (!value) {
    return {
      score: 0,
      complexity: "very-weak",
      feedback: ["パスワードを入力してください。"]
    };
  }

  const lower = value.toLowerCase();
  const hasLower = /[a-z]/.test(value);
  const hasUpper = /[A-Z]/.test(value);
  const hasNumber = /\d/.test(value);
  const hasSymbol = /[^a-zA-Z0-9]/.test(value);
  const varietyCount = [hasLower, hasUpper, hasNumber, hasSymbol].filter(Boolean).length;
  const poolSize = (hasLower ? 26 : 0) + (hasUpper ? 26 : 0) + (hasNumber ? 10 : 0) + (hasSymbol ? SYMBOLS.length : 0);
  const entropyBits = Number((value.length * Math.log2(Math.max(poolSize, 1))).toFixed(1));
  const uniqueRatio = Number((new Set(value).size / value.length).toFixed(2));

  const hasTripleRepeat = /(.)\1{2,}/.test(value);
  const hasRepeatedChunk = /(.{2,})\1+/.test(value);
  const hasSequence = hasStraightSequence(lower);
  const hasKeyboardPattern = hasKeyboardWalk(lower);
  const hasCommonPattern = COMMON_PATTERNS.some((token) => lower.includes(token));

  const lengthScore = Math.min(30, value.length * 2);
  const varietyScore = varietyCount * 10;
  const entropyScore = Math.min(35, entropyBits * 0.6);

  let penalties = 0;
  if (value.length < 10) penalties += 15;
  else if (value.length < 14) penalties += 8;
  if (hasTripleRepeat) penalties += 12;
  if (hasRepeatedChunk) penalties += 10;
  if (hasSequence) penalties += 12;
  if (hasKeyboardPattern) penalties += 12;
  if (hasCommonPattern) penalties += 18;
  if (uniqueRatio < 0.55 && value.length >= 8) penalties += 10;
  if (varietyCount <= 1 && value.length >= 8) penalties += 15;

  const score = Math.max(0, Math.min(100, Math.round(lengthScore + varietyScore + entropyScore - penalties)));
  const complexity = score >= 90 ? "very-strong" : score >= 75 ? "strong" : score >= 55 ? "fair" : score >= 35 ? "weak" : "very-weak";
  const feedback = buildFeedback({
    length: value.length,
    hasLower,
    hasUpper,
    hasNumber,
    hasSymbol,
    hasTripleRepeat,
    hasRepeatedChunk,
    hasSequence,
    hasKeyboardPattern,
    hasCommonPattern
  });

  return {
    score,
    complexity,
    feedback
  };
}
