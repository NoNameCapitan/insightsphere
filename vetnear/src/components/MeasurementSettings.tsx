"use client";
import { useEffect, useState } from "react";
import { MEASUREMENT_OPTOUT_KEY, setMeasurementOptOut } from "@/lib/measurement/client";
export function MeasurementSettings() {
  const [disabled, setDisabled] = useState(false); const [message, setMessage] = useState("");
  useEffect(() => { try { setDisabled(localStorage.getItem(MEASUREMENT_OPTOUT_KEY) === "1"); } catch { setMessage("Налаштування недоступне: браузер обмежив локальне сховище. Збір воронки вимкнений."); } }, []);
  return <div className="mt-4"><label className="flex min-h-11 items-start gap-3"><input type="checkbox" checked={disabled} onChange={e => { const value = e.target.checked; if (setMeasurementOptOut(value)) { setDisabled(value); setMessage(value ? "Збір воронки вимкнено на цьому пристрої." : "Налаштування збережено."); } else setMessage("Не вдалося зберегти налаштування."); }} className="mt-1 h-5 w-5" /><span>Вимкнути знеособлену статистику пошуку й контактних дій на цьому пристрої</span></label><p role="status" className="mt-2 text-sm">{message}</p></div>;
}
