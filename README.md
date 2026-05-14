# Government Services QA

Reusable Next.js dashboard for quality assurance on government services data. It is designed to work across ministries and service code formats because ministry names, service codes, and service text come from the uploaded Excel workbook rather than from hardcoded values.

## What is included

- Next.js App Router project
- Plain CSS, not Tailwind
- Excel normalization script
- Normalized service seed data in `data/services.json`
- Postgres database integration through `DATABASE_URL`
- Automatic table creation/migration and first-load seeding
- Autosaved edits with audit logging
- Save/validated workflow
- Corrected JSON export
- Arabic/English interface toggle with RTL/LTR layout changes
- Records sidebar on the left in English and on the right in Arabic

## Data model

The normalized records use this shape:

```json
{
  "service_code": "",
  "ministry": "",
  "service_name": "",
  "directorate": "",
  "sub_directorate": "",
  "required_documents": "",
  "fees": "",
  "notes": ""
}
```

The database stores both source values and current editable values in the `services` table:

```text
source_service_code
source_ministry
source_service_name
source_directorate
source_sub_directorate
source_required_documents
source_fees
source_notes
service_code
ministry
service_name
directorate
sub_directorate
required_documents
fees
notes
```

The app also creates:

```text
qa_reviews
audit_log
```

## Editable fields

Only these fields are editable in the main editor, in this order:

1. Service name / اسم الخدمة
2. Directorate / المديرية
3. Sub Directorate / المديرية الفرعية
4. Required documents / المستندات المطلوبة
5. Fees / الرسوم
6. Notes / ملاحظات

`service_code` and `ministry` are kept in the database, API responses, search, and corrected JSON export, but they are not editable in the main editor.

Only editable input fields have colored borders. Other cards, panels, stats, pills, and layout containers use neutral borders.

## Excel normalization

1. Put the Excel file here:

```text
source/services.xlsx
```

2. Run:

```bash
npm run normalize
```

The script reads:

```text
source/services.xlsx
```

and writes:

```text
data/services.json
```

The script trims header names, treats headers like `Title ` and `Title` as the same, treats `Required Docs ` and `Required Docs` as the same, converts empty Excel cells to empty strings, and preserves Arabic text and line breaks.

If a workbook has one worksheet, that worksheet is used. If it has multiple worksheets, the script scores the worksheets by service-like headers such as code, ministry, title, directorate, required documents, fees, and notes, then uses the best match.

## Local setup

Install dependencies:

```bash
npm install
```

Normalize the Excel source:

```bash
npm run normalize
```

Create `.env.local` from the example:

```bash
cp .env.example .env.local
```

Add a Neon Postgres connection string:

```bash
DATABASE_URL="postgresql://USER:PASSWORD@HOST.neon.tech/neondb?sslmode=require"
```

Run the app:

```bash
npm run dev
```

Open the local Next.js URL shown in the terminal.

## Database behavior

The API route is:

```text
/api/database
```

On first load, the route automatically:

1. Creates or migrates the `services`, `qa_reviews`, and `audit_log` tables.
2. Seeds `services` from `data/services.json` when the `services` table is empty.
3. Creates pending review rows in `qa_reviews`.
4. Returns current records to the dashboard.

As users type, edits autosave to Postgres with a debounce. Pressing **Save / حفظ** marks the current record as saved/validated.

## Vercel + Neon deployment

1. Create a Neon Postgres database.
2. Copy the Neon connection string with SSL enabled.
3. Push this project to GitHub.
4. Import the repository into Vercel.
5. In Vercel, open the project settings and add this environment variable:

```bash
DATABASE_URL="postgresql://USER:PASSWORD@HOST.neon.tech/neondb?sslmode=require"
```

6. Deploy.
7. On first page load, the app creates/migrates tables and seeds from `data/services.json`.

## Reusing this across ministries

To reuse the dashboard for another ministry or service set:

1. Replace `source/services.xlsx` with the new workbook.
2. Run `npm run normalize`.
3. Review `data/services.json`.
4. Deploy or redeploy.

The app does not depend on a fixed ministry name or a fixed service code prefix. It searches and exports the generic fields `service_code`, `ministry`, `service_name`, `directorate`, `sub_directorate`, `required_documents`, `fees`, and `notes`.

## Git commands for an existing local repo

Replace `/path/to/existing/local/repo` and `/path/to/government-services-dashboard.zip` with your paths:

```bash
rm -rf /tmp/government-services-dashboard
mkdir -p /tmp/government-services-dashboard
unzip /path/to/government-services-dashboard.zip -d /tmp/government-services-dashboard
cd /path/to/existing/local/repo
rsync -av /tmp/government-services-dashboard/ ./
git add .
git -c user.name="zeinomsar" -c user.email="zeinomsar@users.noreply.github.com" commit -m "Add reusable government services QA dashboard"
git push origin main
```
