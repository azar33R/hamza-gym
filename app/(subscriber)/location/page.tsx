import { GymLocationCard } from "@/components/subscriber/gym-location-card";
import { config } from "@/lib/config";

export default function LocationPage() {
  return <GymLocationCard gym={config.gym} />;
}
