"use client";

import { useEffect } from "react";
import { attachClinicalMotion } from "./clinical-motion-controller";

/** React lifecycle only. The controller never owns a clinical action or state. */
export function ClinicalMotion() {
  useEffect(() => {
    const root = document.querySelector<HTMLElement>(".app-shell");
    if (!root) return;
    return attachClinicalMotion(root);
  }, []);
  return null;
}
