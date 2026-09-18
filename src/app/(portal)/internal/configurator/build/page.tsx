"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CompositeWorkspace } from "@/components/internal/composite-workspace";
import { ErrorState, LoadingState, RecordIdGate } from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import { useCompositeBuild, useCompositeSettings } from "@/features/internal/use-composite";

/** Composite Configurator workspace for one build (decision 14). */
export default function CompositeBuildPage() {
  return (
    <Suspense fallback={<LoadingState rows={6} />}>
      <RecordIdGate backHref="/internal/configurator" backLabel="Back to the Configurator">
        <BuildLoader />
      </RecordIdGate>
    </Suspense>
  );
}

function BuildLoader() {
  const id = useSearchParams().get("id") ?? "";
  const build = useCompositeBuild(id);
  const settings = useCompositeSettings();

  if (build.isPending || settings.isPending)
    return <LoadingState rows={6} label="Loading the costing sheet" />;
  if (build.isError || settings.isError)
    return (
      <div className="space-y-4">
        <ErrorState
          error={build.error ?? settings.error}
          onRetry={() => {
            void build.refetch();
            void settings.refetch();
          }}
        />
        <Button asChild variant="outline">
          <Link href="/internal/configurator">Back to the Configurator</Link>
        </Button>
      </div>
    );
  // Keyed so switching build (e.g. after Duplicate) starts a fresh draft.
  return <CompositeWorkspace key={build.data.id} initial={build.data} settings={settings.data} />;
}
