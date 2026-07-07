import Link from "next/link";
import { ArrowLeft, MapPin, Clock, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/client";

type Gym = {
  name: string;
  address: string;
  hours: string;
  mapsUrl: string;
};

export function GymLocationCard({ gym }: { gym: Gym }) {
  const { t } = useI18n();
  return (
    <div className="flex min-h-screen flex-col bg-background px-4 py-10">
      <div className="mx-auto w-full max-w-md">
        <Link
          href="/dashboard"
          className="mb-6 inline-flex items-center gap-2 text-sm text-zinc-400 transition-colors hover:text-zinc-50"
        >
          <ArrowLeft className="h-4 w-4" /> {t("common.back")}
        </Link>

        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          {/* Map header band */}
          <div className="relative flex h-32 items-center justify-center bg-gradient-to-br from-zinc-800 to-zinc-900">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-lime-500/30">
              <MapPin className="h-6 w-6" />
            </span>
          </div>

          <div className="p-6">
            <h1 className="text-xl font-bold text-zinc-50">{gym.name}</h1>

            <div className="mt-4 space-y-3 text-sm">
              <div className="flex items-start gap-3">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <p className="text-zinc-300">{gym.address}</p>
              </div>
              <div className="flex items-start gap-3">
                <Clock className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <p className="text-zinc-300">{gym.hours}</p>
              </div>
            </div>

            <Button asChild size="lg" className="mt-6 w-full">
              <a href={gym.mapsUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4" /> {t("gym.open_maps")}
              </a>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
