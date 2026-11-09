import type { Coordinates, KyivDistrict } from "@/lib/types";

/** Approximate centroids for Kyiv districts — used as manual-location fallback. */
export const DISTRICT_CENTROIDS: Record<KyivDistrict, Coordinates> = {
  podil: { latitude: 50.4662, longitude: 30.5152 },
  pechersk: { latitude: 50.4253, longitude: 30.5403 },
  obolon: { latitude: 50.5151, longitude: 30.4983 },
  pozniaky: { latitude: 50.4022, longitude: 30.6294 },
  osokorky: { latitude: 50.3972, longitude: 30.6103 },
  troieshchyna: { latitude: 50.5122, longitude: 30.6013 },
  holosiiv: { latitude: 50.3782, longitude: 30.5103 },
  solomianka: { latitude: 50.4302, longitude: 30.4603 },
  nyvky: { latitude: 50.4582, longitude: 30.4183 },
  sviatoshyn: { latitude: 50.4582, longitude: 30.3553 },
};

export const KYIV_CENTER: Coordinates = { latitude: 50.4501, longitude: 30.5234 };
