import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import MarkdownIt from 'markdown-it';

const markdown = new MarkdownIt({
  html: false,
  breaks: false,
  linkify: false,
  typographer: false,
});

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX_POSTS = 20;

export function renderMarkdown(source) {
  return markdown.render(String(source ?? ''));
}

export function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function normalizedDate(value, field, fileName) {
  if (typeof value !== 'string' && !(value instanceof Date)) {
    throw new Error(`${fileName}: ${field} deve ser uma data ISO-8601.`);
  }
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) {
    throw new Error(`${fileName}: ${field} não é uma data válida.`);
  }
  return date.toISOString();
}

function normalizedText(value, field, fileName, maxLength, fallback = '') {
  const text = value == null ? fallback : String(value).trim();
  if (!text) throw new Error(`${fileName}: ${field} não pode ficar vazio.`);
  if (text.length > maxLength) {
    throw new Error(`${fileName}: ${field} excede ${maxLength} caracteres.`);
  }
  return text;
}

export function validatePost(data, fileName = 'post') {
  const title = normalizedText(data.title, 'title', fileName, 120);
  const summary = normalizedText(data.summary, 'summary', fileName, 280);
  const slug = normalizedText(data.slug, 'slug', fileName, 80).toLowerCase();
  if (!SLUG_PATTERN.test(slug)) {
    throw new Error(`${fileName}: slug deve usar apenas letras minúsculas, números e hífens.`);
  }
  const publishedAt = normalizedDate(data.publishedAt, 'publishedAt', fileName);
  const updatedAt = data.updatedAt == null
    ? publishedAt
    : normalizedDate(data.updatedAt, 'updatedAt', fileName);
  if (new Date(updatedAt) < new Date(publishedAt)) {
    throw new Error(`${fileName}: updatedAt não pode ser anterior a publishedAt.`);
  }
  const author = normalizedText(data.author, 'author', fileName, 80, 'Equipe Cadente');
  const tags = data.tags == null ? [] : data.tags;
  if (!Array.isArray(tags) || tags.length > 8) {
    throw new Error(`${fileName}: tags deve ser uma lista com no máximo 8 itens.`);
  }
  const normalizedTags = tags.map((tag) => normalizedText(tag, 'tag', fileName, 32));
  return {
    title,
    summary,
    slug,
    publishedAt,
    updatedAt,
    author,
    tags: normalizedTags,
    draft: data.draft === true,
  };
}

export function loadPosts(contentDir) {
  if (!fs.existsSync(contentDir)) return [];
  const files = fs.readdirSync(contentDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && path.extname(entry.name).toLowerCase() === '.md')
    .map((entry) => path.join(contentDir, entry.name))
    .sort();
  const slugs = new Set();
  const posts = files.map((filePath) => {
    const fileName = path.basename(filePath);
    const parsed = matter(fs.readFileSync(filePath, 'utf8'));
    const metadata = validatePost(parsed.data, fileName);
    if (slugs.has(metadata.slug)) throw new Error(`${fileName}: slug duplicado (${metadata.slug}).`);
    slugs.add(metadata.slug);
    if (!parsed.content.trim()) throw new Error(`${fileName}: conteúdo Markdown vazio.`);
    return {
      ...metadata,
      body: parsed.content.trim(),
      sourcePath: filePath,
    };
  });
  return posts.sort((left, right) => right.publishedAt.localeCompare(left.publishedAt));
}

function normalizedOrigin(origin) {
  return String(origin || 'https://cadente-hub.github.io').replace(/\/+$/, '');
}

export function buildFeed(posts, origin = 'https://cadente-hub.github.io') {
  const siteOrigin = normalizedOrigin(origin);
  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    items: posts
      .filter((post) => !post.draft)
      .slice(0, MAX_POSTS)
      .map((post) => ({
        id: post.slug,
        title: post.title,
        summary: post.summary,
        publishedAt: post.publishedAt,
        updatedAt: post.updatedAt,
        author: post.author,
        tags: post.tags,
        url: `${siteOrigin}/blog/${post.slug}/`,
      })),
  };
}

export const BLOG_MAX_POSTS = MAX_POSTS;
