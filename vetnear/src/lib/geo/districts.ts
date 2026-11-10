import type { Coordinates, KyivDistrict } from "@/lib/types";

/** Area centroids of Kyiv's ten districts (from OSM boundaries) — manual-location fallback. */
export const DISTRICT_CENTROIDS: Record<KyivDistrict, Coordinates> = {
  holosiivskyi: { latitude: 50.3324, longitude: 30.5547 },
  darnytskyi: { latitude: 50.4018, longitude: 30.6952 },
  desnianskyi: { latitude: 50.5225, longitude: 30.6838 },
  dniprovskyi: { latitude: 50.4606, longitude: 30.6269 },
  obolonskyi: { latitude: 50.5397, longitude: 30.4322 },
  pecherskyi: { latitude: 50.4272, longitude: 30.5483 },
  podilskyi: { latitude: 50.4945, longitude: 30.4401 },
  sviatoshynskyi: { latitude: 50.4723, longitude: 30.3279 },
  solomianskyi: { latitude: 50.4239, longitude: 30.452 },
  shevchenkivskyi: { latitude: 50.4634, longitude: 30.4608 },
};

export const KYIV_CENTER: Coordinates = { latitude: 50.4501, longitude: 30.5234 };
