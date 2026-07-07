import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { LoginForm } from "@/components/auth/login-form";
import { getT } from "@/lib/i18n/server";

export default async function LoginPage() {
  const t = await getT();
  return (
    <Card className="w-full max-w-sm border-border bg-card">
      <CardHeader>
        <CardTitle className="text-zinc-50">{t("auth.welcome_title")}</CardTitle>
        <CardDescription>{t("auth.welcome_sub")}</CardDescription>
      </CardHeader>
      <CardContent>
        <LoginForm />
        <p className="mt-6 text-center text-sm text-zinc-400">
          {t("auth.no_account")}{" "}
          <Link
            href="/signup"
            className="font-medium text-primary hover:text-lime-400"
          >
            {t("auth.sign_up")}
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
