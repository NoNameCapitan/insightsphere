import { TileIcon } from "@/components/icons/ServiceIcons";

// Medical-record icons: clay tiles from public/visuals/icons.
type Props = { className?: string };

export function VaccinationIcon({ className }: Props) {
  return <TileIcon name="vaccine" className={className} />;
}

export function TreatmentIcon({ className }: Props) {
  return <TileIcon name="treatment" className={className} />;
}

export function VisitIcon({ className }: Props) {
  return <TileIcon name="visit" className={className} />;
}

export function WeightIcon({ className }: Props) {
  return <TileIcon name="weight" className={className} />;
}

export function DocumentIcon({ className }: Props) {
  return <TileIcon name="document" className={className} />;
}

export function ReminderIcon({ className }: Props) {
  return <TileIcon name="reminder" className={className} />;
}

export function MicrochipIcon({ className }: Props) {
  return <TileIcon name="microchip" className={className} />;
}
