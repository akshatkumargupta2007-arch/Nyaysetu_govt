# Gov geography data (GA3)

Prototype data. Nothing here is an official government publication.

| File | What | Status |
|---|---|---|
| `states.json` | 36 states/UTs, Hindi + English names, short codes | LGD codes **not verified** (`verified:false`) |
| `districts.json` | Durg (CG), Bengaluru Urban (KA) | **VERIFY** district + LGD codes |
| `cities.json` | `cg.bhilai`, `ka.bengaluru` (ids match the citizen tenant ids) | centroids approximate |
| `category_l1.json` | the 13 top-level complaint groups, hi/en | matches the citizen taxonomy |
| `india_states.topojson` | base map for the heat map, 36 shapes, ~0.8 MB | see below |

## India base map: source and caveats
- Source: DataMeet `datameet/maps` `states.geojson` (public GitHub repo), simplified with topojson-simplify.
  Properties reduced to `{code, name}`; codes match `states.json`.
- It shows J&K with Gilgit-Baltistan and Aksai Chin (lon 72.5-80.3, lat 32.3-37.1) and Arunachal Pradesh in full,
  which matches India's official depiction as far as I can tell.
- **VERIFY against Survey of India before any public use.** Known gaps: the file predates the 2019 split, so
  Ladakh is not drawn separately (it is inside the J&K shape), and Dadra & Nagar Haveli and Daman & Diu are two
  separate shapes that both carry code `DD`.
