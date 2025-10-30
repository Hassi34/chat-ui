#!/usr/bin/env node
import cors from 'cors';
import express from 'express';
import { appendFileSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const port = Number(process.env.PORT ?? 4000);
const logsDir = resolve(__dirname, '../logs');
const logFilePath = join(logsDir, 'login.log');

app.use(cors());
app.use(express.json({ limit: '256kb' }));

app.post('/api/logs', (req, res) => {
  if (!req.body || typeof req.body !== 'object') {
    res.status(400).json({ error: 'Invalid log payload.' });
    return;
  }

  const entry = sanitiseEntry(req.body);
  try {
    mkdirSync(logsDir, { recursive: true });
    appendFileSync(logFilePath, `${formatEntry(entry)}\n`, { encoding: 'utf8' });
  } catch (error) {
    console.error('Failed to write log entry', error);
    res.status(500).json({ error: 'Failed to persist log entry.' });
    return;
  }

  res.status(204).send();
});

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.listen(port, () => {
  console.log(`Logging service listening on http://localhost:${port}`);
});

function sanitiseEntry(entry) {
  const timestamp = typeof entry.timestamp === 'string' ? entry.timestamp : new Date().toISOString();
  const level = typeof entry.level === 'string' ? entry.level.toLowerCase() : 'info';
  const message = typeof entry.message === 'string' ? entry.message : '';
  const context = entry.context && typeof entry.context === 'object' ? entry.context : undefined;

  return { timestamp, level, message, context };
}

function formatEntry(entry) {
  const parts = [
    `[${entry.timestamp}]`,
    `[${entry.level.toUpperCase()}]`,
    entry.message || '(no message)',
  ];

  if (entry.context) {
    try {
      parts.push(JSON.stringify(entry.context));
    } catch (error) {
      parts.push('context_serialisation_failed');
    }
  }

  return parts.join(' ');
}
