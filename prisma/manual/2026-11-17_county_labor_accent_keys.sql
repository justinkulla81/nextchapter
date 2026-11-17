-- CountyLabor.nameKey for counties with accented names was loaded before countyKey() stripped accents, so the letter was lost
-- ("Doña Ana" -> "doa ana", "Mayagüez" -> "mayagez"). Rewritten to the accent-free spelling (17 rows: NM Doña Ana, 16 PR municipios).
-- Applied 2026-11-17.
UPDATE "CountyLabor"
SET "nameKey" = regexp_replace(translate(lower(name), 'áéíóúüñ', 'aeiouun'), ' county$', '')
WHERE name ~ '[^\x01-\x7F]';
