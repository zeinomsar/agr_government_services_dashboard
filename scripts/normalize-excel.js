const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const SOURCE_FILE = path.join(PROJECT_ROOT, 'source', 'services.xlsx');
const OUTPUT_FILE = path.join(PROJECT_ROOT, 'data', 'services.json');

const OUTPUT_FIELDS = [
  'service_code',
  'ministry',
  'service_name',
  'directorate',
  'sub_directorate',
  'required_documents',
  'fees',
  'notes'
];

const COLUMN_SYNONYMS = {
  service_code: [
    'Code',
    'Service Code',
    'service_code',
    'Normalized Service Code',
    'Aggregate Service Code'
  ],
  ministry: [
    'Ministry',
    'Name of ministry',
    'Ministry Name'
  ],
  service_name: [
    'Title',
    'Title of document',
    'Name of transaction',
    'Service name',
    'Transaction name'
  ],
  directorate: [
    'Directorate',
    'Department',
    'Directorate Name',
    'Name of directorate'
  ],
  sub_directorate: [
    'Sub Directorate',
    'Sub department',
    'Subdepartment',
    'Sub-department',
    'Sub Sub department'
  ],
  required_documents: [
    'Required Docs',
    'Required Documents',
    'Required documents / attachments',
    'Required documents/attachments',
    'Required documents attachments',
    'Required attachments',
    'Documents'
  ],
  fees: [
    'Fees',
    'Fee'
  ],
  notes: [
    'Notes',
    'Note'
  ]
};

function normalizeHeader(value) {
  return String(value ?? '')
    .replace(/^\uFEFF/, '')
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/[/:]+/g, ' ')
    .replace(/\s+/g, ' ');
}

function cellToString(value) {
  if (value === undefined || value === null) return '';
  return String(value);
}

function getRows(workbook, sheetName) {
  const worksheet = workbook.Sheets[sheetName];
  if (!worksheet) return [];

  return XLSX.utils.sheet_to_json(worksheet, {
    header: 1,
    defval: '',
    blankrows: false,
    raw: false
  });
}

function headerScore(row) {
  const headers = row.map(normalizeHeader);
  let score = 0;

  for (const synonyms of Object.values(COLUMN_SYNONYMS)) {
    const normalizedSynonyms = synonyms.map(normalizeHeader);
    if (headers.some((header) => normalizedSynonyms.includes(header))) {
      score += 1;
    }
  }

  return score;
}

function findHeaderRow(rows) {
  let bestIndex = 0;
  let bestScore = -1;
  const scanLimit = Math.min(rows.length, 25);

  for (let index = 0; index < scanLimit; index += 1) {
    const score = headerScore(rows[index] || []);
    if (score > bestScore) {
      bestScore = score;
      bestIndex = index;
    }
  }

  return { index: bestIndex, score: bestScore };
}

function selectWorksheet(workbook) {
  if (workbook.SheetNames.length === 0) {
    throw new Error('The workbook has no worksheets.');
  }

  if (workbook.SheetNames.length === 1) {
    const sheetName = workbook.SheetNames[0];
    const rows = getRows(workbook, sheetName);
    return { sheetName, rows, headerInfo: findHeaderRow(rows) };
  }

  let best = null;

  for (const sheetName of workbook.SheetNames) {
    const rows = getRows(workbook, sheetName);
    const headerInfo = findHeaderRow(rows);
    const candidate = { sheetName, rows, headerInfo };

    if (!best || headerInfo.score > best.headerInfo.score) {
      best = candidate;
    }
  }

  return best;
}

function findColumnIndex(headers, fieldName) {
  const normalizedHeaders = headers.map(normalizeHeader);
  const aliases = COLUMN_SYNONYMS[fieldName].map(normalizeHeader);

  for (const alias of aliases) {
    const exactIndex = normalizedHeaders.findIndex((header) => header === alias);
    if (exactIndex !== -1) return exactIndex;
  }

  for (const alias of aliases) {
    const containsIndex = normalizedHeaders.findIndex((header) => alias && header.includes(alias));
    if (containsIndex !== -1) return containsIndex;
  }

  return -1;
}

function normalizeRecords(rows, headerIndex) {
  const headerRow = rows[headerIndex] || [];
  const headers = headerRow.map((header) => String(header ?? '').trim());
  const columnMap = Object.fromEntries(
    OUTPUT_FIELDS.map((field) => [field, findColumnIndex(headers, field)])
  );

  const records = rows.slice(headerIndex + 1).map((row) => {
    const record = {};

    for (const field of OUTPUT_FIELDS) {
      const columnIndex = columnMap[field];
      record[field] = columnIndex === -1 ? '' : cellToString(row[columnIndex]);
    }

    return record;
  }).filter((record) => OUTPUT_FIELDS.some((field) => record[field] !== ''));

  return { headers, columnMap, records };
}

function main() {
  if (!fs.existsSync(SOURCE_FILE)) {
    throw new Error(`Excel source file not found: ${SOURCE_FILE}`);
  }

  const workbook = XLSX.readFile(SOURCE_FILE, {
    cellDates: false,
    bookVBA: false
  });

  const { sheetName, rows, headerInfo } = selectWorksheet(workbook);
  const { headers, columnMap, records } = normalizeRecords(rows, headerInfo.index);

  fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
  fs.writeFileSync(OUTPUT_FILE, `${JSON.stringify(records, null, 2)}\n`, 'utf8');

  const mappedColumns = Object.fromEntries(
    OUTPUT_FIELDS.map((field) => [field, columnMap[field] === -1 ? null : headers[columnMap[field]]])
  );
  const missingFields = OUTPUT_FIELDS.filter((field) => columnMap[field] === -1);

  console.log(`Selected worksheet: ${sheetName}`);
  console.log(`Header row: ${headerInfo.index + 1}`);
  console.log(`Mapped columns: ${JSON.stringify(mappedColumns, null, 2)}`);
  if (missingFields.length > 0) {
    console.warn(`Missing optional/expected columns: ${missingFields.join(', ')}`);
  }
  console.log(`Wrote ${records.length} records to ${path.relative(PROJECT_ROOT, OUTPUT_FILE)}`);
}

main();
