import Image from "next/image";

export default function Home() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 px-4 text-center">
      <Image
        src="/brand/brewfitt-logo.jpg"
        alt="Brewfitt"
        width={2230}
        height={560}
        priority
        className="h-auto w-48 rounded-lg"
      />
      <h1 className="text-2xl font-semibold tracking-tight">Customer &amp; Supplier Portal</h1>
      <p className="max-w-md text-muted-foreground">
        Price lists, quotes, orders, deliveries, invoices and messages with Brewfitt, in one place.
      </p>
    </main>
  );
}
