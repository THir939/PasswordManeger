const LOWERCASE = "abcdefghijkmnopqrstuvwxyz";
const UPPERCASE = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const NUMBERS = "23456789";
const SYMBOLS = "!@#$%^&*()-_=+[]{};:,.?/";

function randomInt(max) {
  const bytes = new Uint32Array(1);
  crypto.getRandomValues(bytes);
  return bytes[0] % max;
}

function shuffle(array) {
  for (let index = array.length - 1; index > 0; index -= 1) {
    const target = randomInt(index + 1);
    [array[index], array[target]] = [array[target], array[index]];
  }

  return array;
}

export function generatePassword(config = {}) {
  const length = Math.max(8, Math.min(128, Number(config.length) || 20));
  const useLowercase = config.lowercase !== false;
  const useUppercase = config.uppercase !== false;
  const useNumbers = config.numbers !== false;
  const useSymbols = Boolean(config.symbols);

  const pools = [];
  if (useLowercase) pools.push(LOWERCASE);
  if (useUppercase) pools.push(UPPERCASE);
  if (useNumbers) pools.push(NUMBERS);
  if (useSymbols) pools.push(SYMBOLS);

  if (pools.length === 0) {
    pools.push(LOWERCASE, UPPERCASE, NUMBERS);
  }

  const mandatory = pools.map((pool) => pool[randomInt(pool.length)]);
  const allChars = pools.join("");
  const remainingLength = Math.max(0, length - mandatory.length);
  const chars = [...mandatory];

  for (let index = 0; index < remainingLength; index += 1) {
    chars.push(allChars[randomInt(allChars.length)]);
  }

  return shuffle(chars).join("");
}

export function passwordStrength(password) {
  const lengthScore = Math.min(40, password.length * 2);
  const hasLower = /[a-z]/.test(password) ? 15 : 0;
  const hasUpper = /[A-Z]/.test(password) ? 15 : 0;
  const hasNumber = /\d/.test(password) ? 15 : 0;
  const hasSymbol = /[^a-zA-Z0-9]/.test(password) ? 15 : 0;

  const repeatedPenalty = /(.)\1{2,}/.test(password) ? 12 : 0;
  const sequentialPenalty = /(0123|1234|2345|3456|abcd|qwer|asdf|zxcv)/i.test(password)
    ? 12
    : 0;

  const score = Math.max(
    0,
    Math.min(100, lengthScore + hasLower + hasUpper + hasNumber + hasSymbol - repeatedPenalty - sequentialPenalty)
  );

  let label = "Weak";
  if (score >= 80) label = "Strong";
  else if (score >= 60) label = "Good";
  else if (score >= 40) label = "Fair";

  return { score, label };
}
