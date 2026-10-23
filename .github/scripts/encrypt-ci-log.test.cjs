'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const test = require('node:test');
const { encryptLog } = require('./encrypt-ci-log.cjs');

test('only the recipient can authenticate and recover the complete diagnostic', () => {
  const recipient = crypto.generateKeyPairSync('rsa', { modulusLength: 3072 });
  const publicKey = recipient.publicKey.export({ type: 'spki', format: 'pem' });
  const original = Buffer.from('private compiler output\nUnicode: ação\n');
  const envelope = encryptLog(publicKey, original);
  const recover = (candidate) => {
    const key = crypto.privateDecrypt({
      key: recipient.privateKey,
      padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: 'sha256',
    }, Buffer.from(candidate.key, 'base64'));
    const decipher = crypto.createDecipheriv('aes-256-gcm', key,
      Buffer.from(candidate.iv, 'base64'));
    decipher.setAuthTag(Buffer.from(candidate.tag, 'base64'));
    return Buffer.concat([decipher.update(Buffer.from(candidate.ciphertext, 'base64')),
      decipher.final()]);
  };
  assert.deepEqual(recover(envelope), original);
  const modified = { ...envelope, tag: Buffer.alloc(16).toString('base64') };
  assert.throws(() => recover(modified));
  const otherRecipient = crypto.generateKeyPairSync('rsa', { modulusLength: 3072 });
  assert.throws(() => crypto.privateDecrypt({ key: otherRecipient.privateKey,
    oaepHash: 'sha256', padding: crypto.constants.RSA_PKCS1_OAEP_PADDING },
    Buffer.from(envelope.key, 'base64')));
});

test('rejects unsupported or weak recipient keys', () => {
  const weak = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  assert.throws(() => encryptLog(weak.publicKey.export({ type: 'spki', format: 'pem' }),
    Buffer.from('diagnostic')), /at least 3072 bits/);
});
