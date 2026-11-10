# VetNear v1.25 — official Kyiv districts and a 3D district map

## Fixed: districts
- The app used a mix of neighbourhoods (Позняки, Осокорки, Троєщина, Нивки…)
  as "districts"; Shevchenkivskyi and Dniprovskyi did not exist at all.
- Now the ten official districts: Голосіївський, Дарницький, Деснянський,
  Дніпровський, Оболонський, Печерський, Подільський, Святошинський,
  Солом'янський, Шевченківський.
- All 67 places were reassigned by testing their coordinates against the
  OpenStreetMap district boundaries. Result: Дарницький 14, Оболонський 13,
  Голосіївський 10, Деснянський 8, Святошинський 6, Дніпровський 5,
  Подільський 4, Шевченківський 4, Солом'янський 2, Печерський 1.
- Four places were assigned by address instead, because their stored
  coordinates are only approximate — **please verify these**:
  - MasterZoo (Теремки), вул. Самійла Кішки, 10/1 → Голосіївський
  - MasterZoo (Республіка), Кільцева дорога, 1 → Голосіївський
  - MasterZoo (Sky Mall), просп. Романа Шухевича, 2т → Дніпровський
  - MasterZoo (Lavina), вул. Берковецька, 6Д → Святошинський
- Two more sit close to a district border and are worth a look:
  Алден-Вет (Нивки), вул. Мрії, 30 → Святошинський;
  Альфа-Вет, вул. Топольова, 3 → Голосіївський.
- Old links keep working: `/city/kyiv/district/nyvky` redirects to
  `/city/kyiv/district/shevchenkivskyi`, `?district=pozniaky` filters
  Дарницький, and district values saved in a browser are mapped on read.
- `scripts/build-verified-places.mjs`, the Google Places import script, the
  review CSV, the import template and docs use the new slugs.
  `scripts/gen-data.mjs` (legacy synthetic generator) is marked as outdated.

## New: 3D district map
- `DistrictMap3D`: a small tilted map of Kyiv built from the real district
  boundaries (© OpenStreetMap contributors). Every district is an extruded
  piece in its own colour; hover or focus lifts it and shows a name tag with
  the number of places; click selects it. Chips under the map do the same
  for touch and keyboard.
- Used on the home page ("Оберіть свій район"), in the nearby filters, and
  in the add-place and lost-found forms next to the existing select.
