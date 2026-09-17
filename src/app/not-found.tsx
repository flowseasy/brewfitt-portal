import Link from "next/link";
import { BrandLogo } from "@/components/shared/brand-logo";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-4 text-center">
      <BrandLogo className="h-8" />
      <h1 className="mt-8 text-2xl font-semibold tracking-tight">This page does not exist</h1>
      <p className="mt-2 max-w-sm text-muted-foreground">The link may be out of date, or the record may not be on your account.</p>
      <Button asChild className="mt-6 rounded-full">
        <Link href="/dashboard">Back to your dashboard</Link>
      </Button>
    </main>
  );
}
