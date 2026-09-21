import { SriLankaSmsProvider } from '../src/services/notification/sms/srilanka.provider';

console.log('--- Testing Sri Lanka Phone Number Normalization & Validation ---');
const provider = new SriLankaSmsProvider();

const testCases = [
  { input: '0771234567', expectedNormalized: '94771234567', expectedValid: true },
  { input: '0711234567', expectedNormalized: '94711234567', expectedValid: true },
  { input: '0761234567', expectedNormalized: '94761234567', expectedValid: true },
  { input: '0751234567', expectedNormalized: '94751234567', expectedValid: true },
  { input: '0701234567', expectedNormalized: '94701234567', expectedValid: true },
  { input: '0721234567', expectedNormalized: '94721234567', expectedValid: true },
  { input: '0741234567', expectedNormalized: '94741234567', expectedValid: true },
  { input: '0781234567', expectedNormalized: '94781234567', expectedValid: true },
  { input: '+94771234567', expectedNormalized: '94771234567', expectedValid: true },
  { input: '0094771234567', expectedNormalized: '94771234567', expectedValid: true },
  { input: '771234567', expectedNormalized: '94771234567', expectedValid: true },
  { input: '94771234567', expectedNormalized: '94771234567', expectedValid: true },
  { input: '077 123 4567', expectedNormalized: '94771234567', expectedValid: true },
  { input: '+94 (77) 123-4567', expectedNormalized: '94771234567', expectedValid: true },
  // Invalid numbers
  { input: '0112345678', expectedNormalized: '94112345678', expectedValid: false }, // Landline
  { input: '07712345', expectedNormalized: '947712345', expectedValid: false }, // Too short
  { input: '0731234567', expectedNormalized: '94731234567', expectedValid: false }, // 073 invalid prefix
  { input: 'abc', expectedNormalized: '', expectedValid: false }
];

let allPassed = true;
for (const tc of testCases) {
  const normalized = provider.normalizePhoneNumber(tc.input);
  const isValid = provider.validatePhoneNumber(tc.input);

  const normPass = normalized === tc.expectedNormalized;
  const validPass = isValid === tc.expectedValid;

  if (!normPass || !validPass) {
    console.error(`❌ FAIL: Input "${tc.input}" -> Normalized: "${normalized}" (expected "${tc.expectedNormalized}"), Valid: ${isValid} (expected ${tc.expectedValid})`);
    allPassed = false;
  } else {
    console.log(`✅ PASS: "${tc.input}" -> "${normalized}" (Valid: ${isValid})`);
  }
}

if (!allPassed) {
  process.exit(1);
}
console.log('🎉 All Sri Lanka phone normalization & validation tests PASSED!');
