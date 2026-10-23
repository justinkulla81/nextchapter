# Monthly report: standing requirements and additions (from Version 1.72)

Add these to the existing monthly steps. They apply from the **October 2026 edition** onward. The September 2026 edition is the first and is not retrofitted.

## 1. Required in every edition: the change record

- **Reference period:** calendar month, 1st to last day. State three dates separately:
  - the reference period
  - the publication date
  - the date through which source data were available

  Never mix partial-month data with full-month data without saying so.
- **"What changed this edition" table:** one row per material change, with these columns:

  `Change | Type | Previous edition | Current edition | Reason | Historical impact`

  Types:
  1. section added
  2. section removed or shortened
  3. data source
  4. measurement
  5. methodology
  6. revision or correction
  7. interpretation (claims strengthened, weakened or removed; terminology; caveats)
- **Method changes:** write them as old method → new method → reason → effect on history.
  - If history changes, publish the revised series and mark the break.
  - If it doesn't, say so explicitly.
  - Never present a recalculated history as if it had always been computed that way.
- **Replication log:** add a detailed entry to the repository's `CHANGELOG.md`, following `methodology/change_record_standard.md`.

## 2. New monthly measures

- **"Beyond unemployment" white-collar panel:**
  - Run `code/10_hidden_displacement.py` for the new month, pooled January to the current month, compared with the same months of the prior year and 2019.
  - Switch margins of error to the BLS characteristic-specific variance parameters (the PF tables for part-time for economic reasons, multiple jobholders and self-employed), and record that switch in the change table.
- **Use-case watch:**
  - Grow to 8 cases.
  - Log one setback or reversal for every success claim.
  - Update the CES series.
- **Attribution gap:** add New York WARN AI-checkbox counts next to Challenger and SEC Item 2.05.

## 3. Quarterly

- **Three-speed scorecard**, one status per row: supported / consistent but unproven / not observed / not measurable. Inputs:
  - METR or vendor benchmarks (flag vendor-run)
  - Census business AI-use survey (BTOS): start the series at Nov 2025 because of the question break
  - St. Louis Fed hours saved
  - Stanford, Richmond Fed and Yale studies
  - our own CPS measures
- **Hours saved vs hours worked:** St. Louis Fed Real-Time Population Survey share of all hours saved, next to CES average and aggregate weekly hours by industry.
- **Nativity breakdown:** three-month pooled.

## 3b. Quarterly: productivity (from Version 1.72)
- Download the San Francisco Fed quarterly TFP file (frbsf.org, "Total Factor Productivity"; xlsx, updated about five weeks after each GDP release). Record the vintage date.
- Report output per hour, TFP, utilization-adjusted TFP, hours and capital services; compute contributions (capital deepening = alpha × (dk − dhours); labor quality = (1 − alpha) × dLQ). Update data/sf_fed_tfp_decomposition.csv.
- Also cite BLS Productivity and Costs (quarterly) and BLS total factor productivity (annual, March; major industries, December).
- Interpretation rules: quarterly utilization-adjusted TFP is noisy and revised, so lead with four-quarter and annual figures; never attribute TFP changes to AI; compare with the 2004–2019 average (0.49%).
- Check outside commentary (e.g., Apollo, Goldman, Fed notes) against the data before citing, and label anything dated after the reference period.

## 4. Do not

- Build a synthetic "hidden displacement" index. Show the components.
- Claim a capability-to-labor lag. No study estimates one.
- Present benchmark leaps as job forecasts.
