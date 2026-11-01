'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const test = require('node:test');
const { encryptLog, decryptLog } = require('./ci-log-crypto.cjs');

const pair = () => {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 3072 });
  return {
    publicPem: publicKey.export({ type: 'spki', format: 'pem' }),
    privatePem: privateKey.export({ type: 'pkcs8', format: 'pem' }),
  };
};

test('only the holder of the private key recovers the complete log', () => {
  const recipient = pair();
  const original = Buffer.from('private compiler output\nUnicode: ação\n');
  const envelope = encryptLog(recipient.publicPem, original);
  assert.ok(!JSON.stringify(envelope).includes('private compiler output'));
  assert.deepEqual(decryptLog(recipient.privatePem, envelope), original);
  assert.throws(() => decryptLog(pair().privatePem, envelope));
  const tampered = { ...envelope, tag: Buffer.alloc(16).toString('base64') };
  assert.throws(() => decryptLog(recipient.privatePem, tampered));
});

test('rejects weak recipient keys and unknown envelopes', () => {
  const weak = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  assert.throws(() => encryptLog(weak.publicKey.export({ type: 'spki', format: 'pem' }),
    Buffer.from('log')), /at least 3072 bits/);
  assert.throws(() => decryptLog(pair().privatePem, { version: 2 }), /unknown log envelope/);
});

test('the command line round-trips a file and prints none of it', () => {
  const recipient = pair();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ci-log-'));
  const files = Object.fromEntries(['pub.pem', 'in.log', 'env.json', 'out.log']
    .map((name) => [name, path.join(dir, name)]));
  fs.writeFileSync(files['pub.pem'], recipient.publicPem);
  fs.writeFileSync(files['in.log'], 'secret line\n');
  const script = path.join(__dirname, 'ci-log-crypto.cjs');
  const encrypted = execFileSync('node', [script, 'encrypt', files['pub.pem'], files['in.log'],
    files['env.json']], { encoding: 'utf8' });
  const decrypted = execFileSync('node', [script, 'decrypt', files['env.json'], files['out.log']],
    { encoding: 'utf8', env: { ...process.env, CI_LOG_PRIVATE_KEY: recipient.privatePem } });
  assert.equal(encrypted + decrypted, '');
  assert.equal(fs.readFileSync(files['out.log'], 'utf8'), 'secret line\n');
  assert.equal(fs.statSync(files['out.log']).mode & 0o777, 0o600);
  fs.rmSync(dir, { recursive: true });
});

test('the committed public key is one this module accepts', () => {
  const pem = fs.readFileSync(path.join(__dirname, '..', 'ci-log-key.pub.pem'));
  assert.ok(encryptLog(pem, Buffer.from('log')).ciphertext);
});
