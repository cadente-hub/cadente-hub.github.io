'use strict';

// A build log holds fragments of the private source, so it never reaches a public log or artifact in
// clear. The job that compiles third-party crates encrypts it with the public key in the repository
// (.github/ci-log-key.pub.pem); a separate job that compiles nothing decrypts it with
// CI_LOG_PRIVATE_KEY and stores it in the private repository. Neither command prints the contents.
//
//   node ci-log-crypto.cjs encrypt <public-key.pem> <log> <envelope.json>
//   CI_LOG_PRIVATE_KEY=<pem> node ci-log-crypto.cjs decrypt <envelope.json> <log>

const fs = require('node:fs');
const crypto = require('node:crypto');

const OAEP = { padding: crypto.constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' };

function encryptLog(publicKeyPem, plaintext) {
  const publicKey = crypto.createPublicKey(publicKeyPem);
  if (publicKey.asymmetricKeyType !== 'rsa' ||
      publicKey.asymmetricKeyDetails.modulusLength < 3072) {
    throw new Error('log encryption requires an RSA key of at least 3072 bits');
  }
  const key = crypto.randomBytes(32);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const wrappedKey = crypto.publicEncrypt({ key: publicKey, ...OAEP }, key);
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

function decryptLog(privateKeyPem, envelope) {
  if (envelope.version !== 1 || envelope.algorithm !== 'RSA-OAEP-SHA256+A256GCM') {
    throw new Error('unknown log envelope');
  }
  const key = crypto.privateDecrypt({ key: privateKeyPem, ...OAEP },
    Buffer.from(envelope.key, 'base64'));
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(envelope.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(envelope.tag, 'base64'));
  const plaintext = Buffer.concat([decipher.update(Buffer.from(envelope.ciphertext, 'base64')),
    decipher.final()]);
  key.fill(0);
  return plaintext;
}

if (require.main === module) {
  const [command, ...args] = process.argv.slice(2);
  try {
    if (command === 'encrypt' && args.length === 3) {
      const [publicKeyFile, input, output] = args;
      const envelope = encryptLog(fs.readFileSync(publicKeyFile), fs.readFileSync(input));
      fs.writeFileSync(output, JSON.stringify(envelope), { mode: 0o600 });
    } else if (command === 'decrypt' && args.length === 2) {
      const [input, output] = args;
      const privateKey = process.env.CI_LOG_PRIVATE_KEY || '';
      const plaintext = decryptLog(privateKey, JSON.parse(fs.readFileSync(input, 'utf8')));
      fs.writeFileSync(output, plaintext, { mode: 0o600 });
    } else {
      throw new Error('usage');
    }
  } catch {
    // The message could quote the input; only the outcome is printed.
    console.error(`ci-log-crypto: ${command || 'no command'} failed`);
    process.exitCode = 1;
  }
}

module.exports = { encryptLog, decryptLog };
