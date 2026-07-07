import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SignupForm } from "@/components/auth/signup-form";
import { getT } from "@/lib/i18n/server";

export default async function SignupPage() {
  const t = await getT();
  return (
    <Card className="w-full max-w-sm border-border bg-card">
      <CardHeader>
        <CardTitle className="text-zinc-50">{t("auth.create_account")}</CardTitle>
        <CardDescription>
          {t("auth.signup_desc")}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <SignupForm />
        <p className="mt-6 text-center text-sm text-zinc-400">
          {t("auth.has_account")}{" "}
          <Link
            href="/login"
            className="font-medium text-primary hover:text-lime-400"
          >
            {t("auth.sign_in")}
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
