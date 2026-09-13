import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  BLOG_MAX_POSTS,
  buildFeed,
  loadPosts,
  renderMarkdown,
  validatePost,
} from './content.mjs';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptDir, '../..');
const posts = loadPosts(path.join(root, 'content/blog'));
assert.ok(posts.length > 0, 'o blog precisa ter pelo menos uma publicação');

const feed = buildFeed(posts, 'https://cadente-hub.github.io');
assert.equal(feed.schemaVersion, 1);
assert.equal(feed.items.length, Math.min(BLOG_MAX_POSTS, posts.filter((post) => !post.draft).length));
assert.ok(feed.items.every((item) => item.url.startsWith('https://cadente-hub.github.io/blog/')));
assert.ok(fs.existsSync(path.join(root, 'assets/favicon-32.png')));
assert.ok(fs.existsSync(path.join(root, 'assets/logo-symbol.svg')));

assert.throws(() => validatePost({
  title: 'Título',
  summary: 'Resumo',
  slug: 'Slug inválido',
  publishedAt: '2026-01-01T00:00:00Z',
}, 'fixture.md'), /slug/);
assert.ok(renderMarkdown('<script>alert(1)</script>').includes('&lt;script&gt;'));
const unicodePost = {
  title: 'á'.repeat(120), summary: '🚀'.repeat(140), slug: 'unicode',
  publishedAt: '2026-01-01T00:00:00Z',
};
assert.doesNotThrow(() => validatePost(unicodePost));
assert.throws(() => validatePost({ ...unicodePost, title: unicodePost.title + 'á' }), /title/);
assert.throws(() => validatePost({ ...unicodePost, summary: unicodePost.summary + 'x' }), /summary/);
const archive = Array.from({ length: BLOG_MAX_POSTS + 10 }, (_, index) => ({
  ...validatePost(unicodePost), slug: `post-${index}`, draft: index < 5,
}));
assert.deepEqual(buildFeed(archive).items.map((item) => item.id),
  archive.filter((post) => !post.draft).slice(0, BLOG_MAX_POSTS).map((post) => post.slug));
console.log(`blog tests passed (${posts.length} source posts, ${feed.items.length} feed items)`);
