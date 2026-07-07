"use client";

import { useState } from "react";
import { MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/client";
import { CheckInModal } from "@/components/subscriber/check-in-modal";

// The massive "I'm at the Gym" CTA on the dashboard. Opens the PIN modal.
export function CheckInTrigger() {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);

  return (
    <div className="flex flex-col items-center gap-3 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-lime-500/30">
        <MapPin className="h-7 w-7" />
      </span>
      <div>
        <p className="font-semibold text-zinc-50">{t("checkin.ready")}</p>
        <p className="text-sm text-zinc-400">
          {t("checkin.use_pin")}
        </p>
      </div>
      <Button
        size="lg"
        onClick={() => setOpen(true)}
        className="mt-1 w-full py-6 text-base"
      >
        {t("checkin.at_gym")}
      </Button>
      <CheckInModal
        open={open}
        onOpenChange={setOpen}
        onSuccess={() => {
          /* router.refresh() inside the modal flips the dashboard CTA */
        }}
      />
    </div>
  );
}
