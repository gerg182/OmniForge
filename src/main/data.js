'use strict';

const { XMLParser, XMLBuilder } = require('fast-xml-parser');
const YAML = require('yaml');

function parseDelimited(text, delimiter) {
  const source = String(text || '').replace(/^\uFEFF/, '');
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (quoted) {
      if (character === '"') {
        if (source[index + 1] === '"') {
          cell += '"';
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        cell += character;
      }
      continue;
    }
    if (character === '"') {
      quoted = true;
    } else if (character === delimiter) {
      row.push(cell);
      cell = '';
    } else if (character === '\n') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else if (character !== '\r') {
      cell += character;
    }
  }
  row.push(cell);
  rows.push(row);

  const cleaned = rows.filter((entry) => entry.some((value) => String(value).trim() !== ''));
  if (cleaned.length === 0) return [];
  const headers = cleaned[0].map((header, index) => String(header).trim() || `column_${index + 1}`);
  return cleaned.slice(1).map((values) => {
    const record = {};
    headers.forEach((header, index) => {
      record[header] = values[index] ?? '';
    });
    return record;
  });
}

function normalizeRecords(value) {
  if (Array.isArray(value)) return value.map((entry) => (entry && typeof entry === 'object' ? entry : { value: entry }));
  if (value && typeof value === 'object') return [value];
  return [{ value }];
}

function parseXml(text) {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    parseTagValue: true,
    trimValues: true
  });
  const parsed = parser.parse(String(text || '').replace(/^\uFEFF/, ''));
  const rootKey = Object.keys(parsed)[0];
  if (!rootKey) return [];
  const root = parsed[rootKey];
  if (Array.isArray(root)) return normalizeRecords(root);
  if (root && typeof root === 'object') {
    const listKey = Object.keys(root).find((key) => Array.isArray(root[key]));
    return normalizeRecords(listKey ? root[listKey] : root);
  }
  return [{ value: root }];
}

function parseData(text, format) {
  const value = String(format || '').toLowerCase();
  if (value === 'csv') return parseDelimited(text, ',');
  if (value === 'tsv') return parseDelimited(text, '\t');
  if (value === 'json') return normalizeRecords(JSON.parse(String(text || '').replace(/^\uFEFF/, '')));
  if (value === 'yaml' || value === 'yml') return normalizeRecords(YAML.parse(String(text || '')));
  if (value === 'xml') return parseXml(text);
  throw new Error(`Unsupported input data format: ${format}`);
}

function collectHeaders(records) {
  const headers = [];
  const seen = new Set();
  for (const record of records) {
    if (!record || typeof record !== 'object') continue;
    for (const key of Object.keys(record)) {
      if (!seen.has(key)) {
        seen.add(key);
        headers.push(key);
      }
    }
  }
  return headers;
}

function stringifyCell(value, delimiter) {
  if (value === null || value === undefined) return '';
  const text = typeof value === 'object' ? JSON.stringify(value) : String(value);
  if (text.includes('"') || text.includes('\n') || text.includes('\r') || text.includes(delimiter)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function serializeDelimited(records, delimiter) {
  const headers = collectHeaders(records);
  const lines = [headers.map((header) => stringifyCell(header, delimiter)).join(delimiter)];
  for (const record of records) {
    lines.push(headers.map((header) => stringifyCell(record?.[header], delimiter)).join(delimiter));
  }
  return `${lines.join('\n')}\n`;
}

function serializeData(records, format) {
  const value = String(format || '').toLowerCase();
  if (value === 'csv') return serializeDelimited(records, ',');
  if (value === 'tsv') return serializeDelimited(records, '\t');
  if (value === 'json') return `${JSON.stringify(records, null, 2)}\n`;
  if (value === 'yaml' || value === 'yml') return YAML.stringify(records);
  if (value === 'xml') {
    const builder = new XMLBuilder({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      format: true,
      suppressEmptyNode: true,
      indentBy: '  '
    });
    return `${builder.build({ records: { record: records } })}\n`;
  }
  throw new Error(`Unsupported output data format: ${format}`);
}

module.exports = {
  parseDelimited,
  parseData,
  serializeData,
  collectHeaders,
  parseXml,
  normalizeRecords
};
