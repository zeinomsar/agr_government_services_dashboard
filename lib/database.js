import fs from 'fs/promises';
import path from 'path';
import postgres from 'postgres';

const EDITABLE_FIELDS = [
  'service_name',
  'directorate',
  'sub_directorate',
  'required_documents',
  'fees',
  'notes'
];

const CURRENT_FIELDS = [
  'service_code',
  'ministry',
  ...EDITABLE_FIELDS
];

const SOURCE_FIELDS = CURRENT_FIELDS.map((field) => `source_${field}`);

const ALL_SERVICE_COLUMNS = [
  ...SOURCE_FIELDS,
  ...CURRENT_FIELDS
];

function getConnection() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error('DATABASE_URL is not set. Add a Neon Postgres connection string before starting the app.');
  }

  if (!globalThis.__governmentServicesSql) {
    const useSsl = !databaseUrl.includes('sslmode=disable');

    globalThis.__governmentServicesSql = postgres(databaseUrl, {
      ssl: useSsl ? 'require' : false,
      max: 1,
      idle_timeout: 20,
      connect_timeout: 30,
      prepare: false
    });
  }

  return globalThis.__governmentServicesSql;
}

function cleanValue(value) {
  if (value === undefined || value === null) return '';
  return String(value);
}

function normalizeSeedRecord(record) {
  return {
    service_code: cleanValue(record.service_code),
    ministry: cleanValue(record.ministry),
    service_name: cleanValue(record.service_name),
    directorate: cleanValue(record.directorate),
    sub_directorate: cleanValue(record.sub_directorate),
    required_documents: cleanValue(record.required_documents),
    fees: cleanValue(record.fees),
    notes: cleanValue(record.notes)
  };
}

async function loadSeedData() {
  const seedPath = path.join(process.cwd(), 'data', 'services.json');
  const contents = await fs.readFile(seedPath, 'utf8');
  const parsed = JSON.parse(contents);

  if (!Array.isArray(parsed)) {
    throw new Error('data/services.json must contain an array of service records.');
  }

  return parsed.map(normalizeSeedRecord);
}

async function migrate(sql) {
  await sql`
    CREATE TABLE IF NOT EXISTS services (
      id BIGSERIAL PRIMARY KEY,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  for (const column of ALL_SERVICE_COLUMNS) {
    await sql`ALTER TABLE services ADD COLUMN IF NOT EXISTS ${sql(column)} TEXT NOT NULL DEFAULT ''`;
  }

  await sql`
    CREATE TABLE IF NOT EXISTS qa_reviews (
      id BIGSERIAL PRIMARY KEY,
      service_id BIGINT NOT NULL REFERENCES services(id) ON DELETE CASCADE,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS qa_reviews_service_id_idx
    ON qa_reviews(service_id)
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS audit_log (
      id BIGSERIAL PRIMARY KEY,
      service_id BIGINT REFERENCES services(id) ON DELETE SET NULL,
      action TEXT NOT NULL,
      field_name TEXT,
      old_value TEXT,
      new_value TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
}

async function seedIfNeeded(sql) {
  const [countRow] = await sql`SELECT COUNT(*)::INT AS count FROM services`;
  const count = Number(countRow?.count || 0);

  if (count > 0) {
    await sql`
      INSERT INTO qa_reviews (service_id, status)
      SELECT services.id, 'pending'
      FROM services
      WHERE NOT EXISTS (
        SELECT 1 FROM qa_reviews WHERE qa_reviews.service_id = services.id
      )
    `;
    return;
  }

  const seedRecords = await loadSeedData();

  await sql.begin(async (tx) => {
    for (const record of seedRecords) {
      const [inserted] = await tx`
        INSERT INTO services (
          source_service_code,
          source_ministry,
          source_service_name,
          source_directorate,
          source_sub_directorate,
          source_required_documents,
          source_fees,
          source_notes,
          service_code,
          ministry,
          service_name,
          directorate,
          sub_directorate,
          required_documents,
          fees,
          notes
        ) VALUES (
          ${record.service_code},
          ${record.ministry},
          ${record.service_name},
          ${record.directorate},
          ${record.sub_directorate},
          ${record.required_documents},
          ${record.fees},
          ${record.notes},
          ${record.service_code},
          ${record.ministry},
          ${record.service_name},
          ${record.directorate},
          ${record.sub_directorate},
          ${record.required_documents},
          ${record.fees},
          ${record.notes}
        )
        RETURNING id
      `;

      await tx`
        INSERT INTO qa_reviews (service_id, status)
        VALUES (${inserted.id}, 'pending')
      `;

      await tx`
        INSERT INTO audit_log (service_id, action, field_name, old_value, new_value)
        VALUES (${inserted.id}, 'seed', NULL, NULL, 'seeded from data/services.json')
      `;
    }
  });
}

export async function ensureDatabase() {
  const sql = getConnection();
  await migrate(sql);
  await seedIfNeeded(sql);
  return sql;
}

function formatRecord(row) {
  return {
    id: Number(row.id),
    source_service_code: cleanValue(row.source_service_code),
    source_ministry: cleanValue(row.source_ministry),
    source_service_name: cleanValue(row.source_service_name),
    source_directorate: cleanValue(row.source_directorate),
    source_sub_directorate: cleanValue(row.source_sub_directorate),
    source_required_documents: cleanValue(row.source_required_documents),
    source_fees: cleanValue(row.source_fees),
    source_notes: cleanValue(row.source_notes),
    service_code: cleanValue(row.service_code),
    ministry: cleanValue(row.ministry),
    service_name: cleanValue(row.service_name),
    directorate: cleanValue(row.directorate),
    sub_directorate: cleanValue(row.sub_directorate),
    required_documents: cleanValue(row.required_documents),
    fees: cleanValue(row.fees),
    notes: cleanValue(row.notes),
    status: cleanValue(row.status || 'pending'),
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

async function getRecord(sql, serviceId) {
  const [row] = await sql`
    SELECT
      services.*,
      COALESCE(qa_reviews.status, 'pending') AS status
    FROM services
    LEFT JOIN qa_reviews ON qa_reviews.service_id = services.id
    WHERE services.id = ${serviceId}
  `;

  return row ? formatRecord(row) : null;
}

export async function getRecords() {
  const sql = await ensureDatabase();
  const rows = await sql`
    SELECT
      services.*,
      COALESCE(qa_reviews.status, 'pending') AS status
    FROM services
    LEFT JOIN qa_reviews ON qa_reviews.service_id = services.id
    ORDER BY services.id ASC
  `;

  return rows.map(formatRecord);
}

export async function updateServiceField(serviceId, fieldName, value) {
  if (!EDITABLE_FIELDS.includes(fieldName)) {
    throw new Error(`Field is not editable: ${fieldName}`);
  }

  const id = Number(serviceId);
  if (!Number.isInteger(id) || id <= 0) {
    throw new Error('Invalid service id.');
  }

  const nextValue = cleanValue(value);
  const sql = await ensureDatabase();
  const [current] = await sql`SELECT * FROM services WHERE id = ${id}`;

  if (!current) {
    throw new Error('Service record not found.');
  }

  const oldValue = cleanValue(current[fieldName]);

  if (oldValue === nextValue) {
    return getRecord(sql, id);
  }

  await sql.begin(async (tx) => {
    await tx`
      UPDATE services
      SET ${tx(fieldName)} = ${nextValue}, updated_at = NOW()
      WHERE id = ${id}
    `;

    await tx`
      INSERT INTO qa_reviews (service_id, status)
      VALUES (${id}, 'edited')
      ON CONFLICT (service_id)
      DO UPDATE SET
        status = CASE
          WHEN qa_reviews.status = 'flagged' THEN qa_reviews.status
          ELSE 'edited'
        END,
        updated_at = NOW()
    `;

    await tx`
      INSERT INTO audit_log (service_id, action, field_name, old_value, new_value)
      VALUES (${id}, 'field_update', ${fieldName}, ${oldValue}, ${nextValue})
    `;
  });

  return getRecord(sql, id);
}

export async function saveServiceReview(serviceId) {
  const id = Number(serviceId);
  if (!Number.isInteger(id) || id <= 0) {
    throw new Error('Invalid service id.');
  }

  const sql = await ensureDatabase();
  const [current] = await sql`SELECT id FROM services WHERE id = ${id}`;

  if (!current) {
    throw new Error('Service record not found.');
  }

  await sql.begin(async (tx) => {
    await tx`
      INSERT INTO qa_reviews (service_id, status)
      VALUES (${id}, 'saved')
      ON CONFLICT (service_id)
      DO UPDATE SET status = 'saved', updated_at = NOW()
    `;

    await tx`
      INSERT INTO audit_log (service_id, action, field_name, old_value, new_value)
      VALUES (${id}, 'validated', NULL, NULL, 'saved')
    `;
  });

  return getRecord(sql, id);
}

export function correctedRecord(record) {
  return {
    service_code: cleanValue(record.service_code),
    ministry: cleanValue(record.ministry),
    service_name: cleanValue(record.service_name),
    directorate: cleanValue(record.directorate),
    sub_directorate: cleanValue(record.sub_directorate),
    required_documents: cleanValue(record.required_documents),
    fees: cleanValue(record.fees),
    notes: cleanValue(record.notes)
  };
}
