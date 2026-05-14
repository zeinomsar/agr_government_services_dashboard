# Source Excel folder

Place the Excel workbook at:

```text
source/services.xlsx
```

Then run this from the project root:

```bash
npm run normalize
```

The normalization script inspects the workbook, selects the worksheet that contains service-style columns, trims header names, preserves Arabic text and multiline cells, and writes the normalized output to:

```text
data/services.json
```
