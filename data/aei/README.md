# AEI exposure vintages

`vintages/` holds each retrieved copy of Anthropic's `job_exposure.csv` (Anthropic Economic Index,
data licensed CC BY; https://huggingface.co/datasets/Anthropic/EconomicIndex). `manifest.json`
records the hash and retrieval date of each. `npm run aei:report` adds a vintage only when the file
has changed, so the monthly comparison shows real changes in exposure by occupation.

Monthly outputs go in `report-YYYY-MM/` (committed with the edition). See `docs/AEI_SECTION.md`.
