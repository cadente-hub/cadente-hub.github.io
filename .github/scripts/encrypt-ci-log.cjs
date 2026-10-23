'use strict';

const fs = require('node:fs');
const crypto = require('node:crypto');
const path = require('node:path');

// Only this ciphertext goes to the public artifact store. Neither diagnostic
// contents nor private credential values are printed by this script.
function encryptLog(publicKeyPem, plaintext) {
  const publicKey = crypto.createPublicKey(publicKeyPem);
  if (publicKey.asymmetricKeyType !== 'rsa' ||
      publicKey.asymmetricKeyDetails.modulusLength < 3072) {
    throw new Error('diagnostic encryption requires an RSA key of at least 3072 bits');
  }
  const key = crypto.randomBytes(32);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const wrappedKey = crypto.publicEncrypt({
    key: publicKey,
    padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
    oaepHash: 'sha256',
  }, key);
  key.fill(0);
  return {
    version: 1,
    algorithm: 'RSA-OAEP-SHA256+A256GCM',
    key: wrappedKey.toString('base64'),
    iv: iv.toString('base64'),
    tag: cipher.getAuthTag().toString('base64'),
    ciphertext: ciphertext.toString('base64'),
  };
}

if (require.main === module) {
  try {
    const publicKey = Buffer.from(process.env.DIAGNOSTIC_PUBLIC_KEY || '', 'base64');
    const input = path.join(process.env.RUNNER_TEMP, 'ci-build.log');
    const output = path.join(process.env.RUNNER_TEMP, 'ci-diagnostic.enc.json');
    const envelope = encryptLog(publicKey, fs.readFileSync(input));
    fs.writeFileSync(output, JSON.stringify(envelope), { mode: 0o600 });
    console.log('Encrypted diagnostic prepared.');
  } catch {
    console.error('Could not encrypt diagnostic; no plaintext artifact was created.');
    process.exitCode = 1;
  }
}

module.exports = { encryptLog };
