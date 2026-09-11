# CRM source import

One-time-ish migration of the five legacy spreadsheets into the admin CRM.

## 1. Convert the .xlsx sources to CSV

The importer reads CSV only, so the repo needs no spreadsheet dependency.
Produce these files in one directory:

| file               | from                                                   | sheet                      |
| ------------------ | ------------------------------------------------------ | -------------------------- |
| `funding.csv`      | `NextChapter_Funding_v8_*.csv`                          | (already CSV — copy it)    |
| `bd.csv`           | `NextChapter_BD_Partnerships_*.xlsx`                    | `All Partnerships`         |
| `policy.csv`       | `NextChapter_Research_PolicyLandscape_*.xlsx`           | `Landscape`                |
| `studies.csv`      | `NextChapter_Research_PolicyLandscape_*.xlsx`           | `Key Studies & White Papers` |
| `outplacement.csv` | `NextChapter_Outplacement_Lead_Tracker.xlsx`            | `Lead Tracker`             |
| `networking.csv`   | `NextChapter_Networking_CRM_*.xlsx`                     | `Contacts`                 |
| `linkedin.csv`     | LinkedIn data export                                    | `Connections.csv`          |

Only the master sheet of each workbook is used. The per-category sheets in the
BD and Policy workbooks are filtered views of the master and would double-count.

## 2. Dry run, then commit

```
npm run crm:import -- --dir /path/to/csvs            # prints the merge report, writes nothing
npm run crm:import -- --dir /path/to/csvs --commit
```

Idempotent. Organizations upsert on `canonicalNameNormalized`, people on
`linkedinSlug` (falling back to `normalizedKey`, then exact name), affiliations
on `(person, org, title)`, and an opportunity is skipped when one already
exists for the same pipeline and counterparty.

## 3. Dedupe

```
npm run crm:dedupe             # dry run
npm run crm:dedupe -- --commit
```

`normalizeOrgName` does not strip `LP`/`LLP`/`GP` and does not collapse a
trailing parenthetical, so `Owl Ventures` and `Owl Ventures, LP` import as two
organizations. **That function is intentionally not changed** — production
`Company` matching depends on it and loosening it would merge genuinely
distinct companies app-wide. The dedupe pass applies a stricter key to CRM
rows only, and merges under two conservative rules:

- identical after stripping a trailing legal form
- identical after removing a trailing parenthetical

Anything else (`Bloomberg` vs `Bloomberg Beta`, `Coursera` vs `Coursera / Guild`)
is left alone — those are different entities.

## Known data-quality notes

- `Confidential` is a real organization row with several affiliations. It is a
  placeholder from the source export, not a company; worth cleaning by hand.
- A few companies carry employment state in the name (`Google (departed Apr 2026)`).
  The dedupe pass folds those into the parent company.
- Only 3% of LinkedIn connections expose an email, so most people import with
  none. Addresses arrive later from Gmail sync, not from the contact list.
