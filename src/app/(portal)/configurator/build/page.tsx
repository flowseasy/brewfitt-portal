"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CheckCircleIcon,
  CopyIcon,
  FloppyDiskIcon,
  ListChecksIcon,
  MapPinIcon,
  PaperPlaneTiltIcon,
  FileIcon,
  FileImageIcon,
  UploadSimpleIcon,
  XIcon,
} from "@phosphor-icons/react";
import { toast } from "sonner";
import { formatAddress } from "@/components/account/addresses";
import { BillOfMaterials } from "@/components/configurator/bill-of-materials";
import { DispenseEditor } from "@/components/configurator/dispense-editor";
import { ConfiguratorOptionGroup } from "@/components/configurator/option-group";
import { ConfiguratorStepper, type StepKey } from "@/components/configurator/stepper";
import { EmptyState, ErrorState, LoadingState } from "@/components/shared/states";
import { StatusPill } from "@/components/shared/status-pill";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  describePoints,
  fromConfiguration,
  initialState,
  useBillOfMaterials,
  useBuilder,
  useConfiguratorData,
  VENUE_LABEL,
  type BuilderAction,
  type BuilderState,
} from "@/features/configurator/use-configurator";
import { usePersonaKey } from "@/features/session/use-session";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { api, errorMessage, queryKeys } from "@/lib/api";
import { formatDate, formatMoney } from "@/lib/format";
import { hrefFor } from "@/lib/links";
import { cn } from "@/lib/utils";
import type {
  Address,
  Configuration,
  ConfiguratorRules,
  ConfiguratorStepId,
  Money,
  Quote,
  VenueType,
} from "@/types";

export default function BuildPage() {
  useDocumentTitle("Dispense Designer");
  return (
    <Suspense fallback={<LoadingState rows={5} />}>
      <Builder />
    </Suspense>
  );
}

function Builder() {
  const params = useSearchParams();
  const id = params.get("id");
  const duplicateId = params.get("duplicate");
  const data = useConfiguratorData();

  if (
    data.rules.isPending ||
    data.configurations.isPending ||
    data.addresses.isPending ||
    data.priceList.isPending ||
    data.me.isPending
  ) {
    return <LoadingState rows={5} label="Loading the Dispense Designer" />;
  }
  const failed = [data.rules, data.configurations, data.addresses, data.priceList, data.me].find(
    (q) => q.isError,
  );
  if (failed) return <ErrorState error={failed.error} onRetry={() => failed.refetch()} />;

  const rules = data.rules.data!;
  const source = data.configurations.data!.find((c) => c.id === (id ?? duplicateId));
  if ((id || duplicateId) && !source) {
    return (
      <EmptyState
        icon={ListChecksIcon}
        title="This design could not be found"
        description="It may belong to another site or have been removed."
        action={
          <Button asChild variant="outline">
            <Link href="/configurator">Your Dispense Designs</Link>
          </Button>
        }
      />
    );
  }
  const accountId = data.me.data!.account.id;
  const addresses = data.addresses.data!.filter((a) => a.accountId === accountId);

  return (
    <BuilderForm
      key={`${id ?? ""}-${duplicateId ?? ""}`}
      rules={rules}
      existing={id ? source! : null}
      initial={
        source
          ? fromConfiguration(source, !!duplicateId)
          : { ...initialState(rules, addresses.find((a) => a.isDefault)?.id ?? null), name: "" }
      }
      addresses={addresses}
      priceLines={data.priceList.data!.lines}
      vatRate={data.me.data!.vatRate}
      groupRollUp={data.me.data!.persona.kind === "group" && !data.me.data!.persona.activeSiteId}
    />
  );
}

function BuilderForm({
  rules,
  existing,
  initial,
  addresses,
  priceLines,
  vatRate,
  groupRollUp,
}: {
  rules: ConfiguratorRules;
  existing: Configuration | null;
  initial: BuilderState;
  addresses: Address[];
  priceLines: { productId: string; price: Money; product: import("@/types").Product }[];
  vatRate: number;
  groupRollUp: boolean;
}) {
  const router = useRouter();
  const key = usePersonaKey();
  const queryClient = useQueryClient();
  const reduce = useReducedMotion();
  const { state, removed, dispatch } = useBuilder(rules, () => initial);
  const [step, setStep] = useState<StepKey>("venue");
  const [visited, setVisited] = useState<Set<StepKey>>(
    new Set(existing ? ["venue", "dispense", "font", "cooling", "gas", "ancillaries"] : []),
  );
  const [dirty, setDirty] = useState(!existing);
  const [bomOpen, setBomOpen] = useState(false);
  const [quoted, setQuoted] = useState<Quote | null>(null);
  const liveRef = useRef<HTMLParagraphElement>(null);
  const readOnly = existing?.status === "quoted";

  const prices = useMemo(
    () => new Map(priceLines.map((l) => [l.productId, l.price])),
    [priceLines],
  );
  const products = useMemo(
    () => new Map(priceLines.map((l) => [l.productId, l.product])),
    [priceLines],
  );
  const bom = useBillOfMaterials(state, rules, priceLines);
  const errors = bom?.errors ?? {};

  useEffect(() => {
    if (removed.length) toast.info(`Removed because they no longer fit: ${removed.join(", ")}`);
  }, [removed]);

  const act = (a: BuilderAction) => {
    if (readOnly) return;
    setDirty(true);
    dispatch(a);
  };

  const steps: StepKey[] = [...rules.steps.map((s) => s.id), "review"];
  const index = steps.indexOf(step);
  const go = (to: StepKey) => {
    // A step shows what is missing once you have moved on from it, not on arrival.
    setVisited((v) => new Set([...v, step, ...(to === "review" ? steps : [])]));
    setStep(to);
    requestAnimationFrame(() => document.getElementById("step-heading")?.focus());
  };

  const newSite = state?.selections.venue.newSite;
  const nameError =
    state && state.name.trim().length < 3
      ? "Give the design a name of at least 3 characters"
      : state &&
          !state.siteAddressId &&
          newSite &&
          [newSite.label, newSite.line1, newSite.town, newSite.postcode].some((v) => !v?.trim())
        ? "Complete the new site's name, address, town and postcode"
        : null;

  const save = useMutation({
    mutationFn: async (): Promise<Configuration> => {
      if (!state) throw new Error("Nothing to save");
      const input = {
        name: state.name.trim(),
        venueType: state.venueType,
        siteAddressId: state.siteAddressId,
        selections: state.selections,
      };
      return existing
        ? api.configurator.update(existing.id, input)
        : api.configurator.create(input);
    },
    onSuccess: (config) => {
      setDirty(false);
      void queryClient.invalidateQueries({ queryKey: queryKeys.configurations(key) });
      if (!existing) router.replace(`/configurator/build?id=${config.id}`);
    },
    onError: (error) =>
      toast.error("The design could not be saved", { description: errorMessage(error) }),
  });

  const requestQuote = useMutation({
    mutationFn: async () => {
      const config = dirty || !existing ? await save.mutateAsync() : existing;
      return api.configurator.requestQuote(config.id);
    },
    onSuccess: (quote) => {
      setQuoted(quote);
      for (const k of [
        queryKeys.configurations(key),
        queryKeys.quotes(key),
        queryKeys.threads(key),
      ])
        void queryClient.invalidateQueries({ queryKey: k });
    },
    onError: (error) =>
      toast.error("The quote request could not be sent", { description: errorMessage(error) }),
  });

  if (!state || !bom) return <LoadingState rows={4} />;

  if (quoted) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        role="status"
        className="mx-auto max-w-xl rounded-3xl border bg-card p-8 text-center"
      >
        <CheckCircleIcon weight="fill" className="mx-auto size-14 text-success" aria-hidden />
        <h1 className="mt-4 text-2xl font-semibold tracking-tight">
          Quote {quoted.number} is ready
        </h1>
        <p className="mt-2 text-muted-foreground">
          {state.name}: {quoted.lines.length} lines, {formatMoney(quoted.total)} including VAT,
          valid until {formatDate(quoted.validUntil)}. Accept it to place the order; your account
          manager can answer questions in the quote conversation.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Button asChild>
            <Link href={hrefFor("quote", quoted.id)}>Review and accept</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/configurator">Your Dispense Designs</Link>
          </Button>
        </div>
      </motion.div>
    );
  }

  const stepMeta = rules.steps.find((s) => s.id === step);
  const complete = Object.keys(errors).length === 0 && !nameError;
  // The name and new-site details belong to the first step.
  const stepErrors = nameError
    ? { ...errors, venue: [...(errors.venue ?? []), nameError] }
    : errors;

  return (
    <div className="pb-20 lg:pb-0">
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <Link
          href="/configurator"
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeftIcon className="size-4" aria-hidden />
          Your Dispense Designs
        </Link>
        {existing ? (
          <StatusPill tone={existing.status === "quoted" ? "success" : "neutral"}>
            {existing.status === "quoted" ? "Quoted" : "Draft"}
          </StatusPill>
        ) : null}
        <div className="ml-auto flex gap-2">
          {existing ? (
            <Button asChild variant="outline" size="sm">
              <Link href={`/configurator/build?duplicate=${existing.id}`}>
                <CopyIcon aria-hidden />
                Duplicate
              </Link>
            </Button>
          ) : null}
          {!readOnly ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => (nameError ? (go("venue"), toast.error(nameError)) : save.mutate())}
              disabled={save.isPending || (!dirty && !!existing)}
            >
              <FloppyDiskIcon aria-hidden />
              {save.isPending ? "Saving…" : dirty ? "Save draft" : "Saved"}
            </Button>
          ) : null}
        </div>
      </div>

      {readOnly ? (
        <div className="mb-5 rounded-2xl border border-info/30 bg-info-subtle p-4 text-sm">
          This design has been quoted
          {existing?.quoteId ? (
            <>
              {" "}
              (
              <Link
                href={hrefFor("quote", existing.quoteId)}
                className="font-medium text-primary hover:underline"
              >
                view quote
              </Link>
              )
            </>
          ) : null}
          . Duplicate it to make changes.
        </div>
      ) : null}
      {groupRollUp ? (
        <div className="mb-5 rounded-2xl border border-info/30 bg-info-subtle p-4 text-sm">
          You are viewing all sites. Choose a site with the site switcher to save a design for it.
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[200px_minmax(0,1fr)_320px]">
        <div className="lg:sticky lg:top-20 lg:self-start">
          <ConfiguratorStepper
            rules={rules}
            current={step}
            onSelect={go}
            errors={stepErrors}
            visited={visited}
          />
        </div>

        <div className="min-w-0">
          {/* The next step renders immediately; only its entrance is animated, so navigation never waits on an exit. */}
          <motion.div
            key={step}
            initial={reduce ? false : { opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.18 }}
          >
            <h1
              id="step-heading"
              tabIndex={-1}
              className="text-2xl font-semibold tracking-tight outline-none"
            >
              {step === "review" ? "Review and request a quote" : stepMeta?.title}
            </h1>
            <p className="mt-1 mb-5 text-muted-foreground">
              {step === "review"
                ? "Check the system and its parts, then send it to Brewfitt."
                : stepMeta?.description}
            </p>

            <fieldset disabled={readOnly} className="space-y-4">
              {step === "venue" ? (
                <VenueStep
                  state={state}
                  addresses={addresses}
                  dispatch={act}
                  nameError={visited.has("dispense") ? nameError : null}
                />
              ) : null}
              {step === "dispense" ? (
                <DispenseEditor
                  points={state.selections.dispense.points}
                  rules={rules}
                  dispatch={act}
                />
              ) : null}
              {step !== "venue" && step !== "review"
                ? rules.groups
                    .filter((g) => g.stepId === step)
                    .map((g) => (
                      <ConfiguratorOptionGroup
                        key={g.id}
                        group={g}
                        rules={rules}
                        state={state}
                        dispatch={act}
                        prices={prices}
                      />
                    ))
                : null}
              {step === "cooling" ? (
                <PythonLength state={state} rules={rules} dispatch={act} />
              ) : null}
              {step === "font" ? (
                <>
                  <Branding value={state.selections.font.branding} dispatch={act} />
                  <Artwork files={state.selections.font.artwork} dispatch={act} />
                </>
              ) : null}
              {step === "review" ? (
                <Review
                  state={state}
                  rules={rules}
                  errors={errors}
                  nameError={nameError}
                  addresses={addresses}
                  onEdit={go}
                />
              ) : null}
            </fieldset>

            {step !== "review" &&
            errors[step as ConfiguratorStepId]?.length &&
            visited.has(step) ? (
              <ul role="alert" className="mt-4 space-y-1 rounded-xl bg-warning-subtle p-3 text-sm">
                {errors[step as ConfiguratorStepId]!.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            ) : null}

            <div className="mt-6 flex items-center justify-between gap-3">
              <Button
                variant="outline"
                onClick={() => go(steps[Math.max(0, index - 1)]!)}
                disabled={index === 0}
              >
                <ArrowLeftIcon aria-hidden />
                Back
              </Button>
              {step === "review" ? (
                <Button
                  size="lg"
                  className="rounded-full"
                  disabled={readOnly || groupRollUp || !complete || requestQuote.isPending}
                  onClick={() => requestQuote.mutate()}
                >
                  <PaperPlaneTiltIcon aria-hidden />
                  {requestQuote.isPending ? "Sending…" : "Request quote"}
                </Button>
              ) : (
                <Button onClick={() => go(steps[index + 1]!)}>
                  Next
                  <ArrowRightIcon aria-hidden />
                </Button>
              )}
            </div>
          </motion.div>
        </div>

        <aside aria-label="Bill of materials and price" className="hidden lg:block">
          <div className="sticky top-20 rounded-2xl border bg-card p-5">
            <BillOfMaterials
              lines={bom.lines}
              total={bom.total}
              vatRate={vatRate}
              products={products}
              errors={errors}
              compact
            />
          </div>
        </aside>
      </div>

      <p ref={liveRef} className="sr-only" aria-live="polite">
        Running total {formatMoney(bom.total)} before VAT
      </p>

      <div className="fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-30 border-t bg-background/95 px-4 py-2.5 backdrop-blur lg:hidden">
        <button
          type="button"
          onClick={() => setBomOpen(true)}
          className="flex w-full items-center justify-between gap-3"
          aria-haspopup="dialog"
        >
          <span className="text-left">
            <span className="block text-xs text-muted-foreground">
              {bom.lines.length} parts · before VAT
            </span>
            <span className="block text-lg font-semibold tabular-nums">
              {formatMoney(bom.total)}
            </span>
          </span>
          <span className="flex items-center gap-1 rounded-full border px-3 py-1.5 text-sm font-medium">
            <ListChecksIcon aria-hidden />
            Parts
          </span>
        </button>
      </div>
      <Sheet open={bomOpen} onOpenChange={setBomOpen}>
        <SheetContent
          side="bottom"
          className="max-h-[85dvh] overflow-y-auto rounded-t-3xl px-4 pb-8"
        >
          <SheetHeader className="px-0">
            <SheetTitle>Parts and price</SheetTitle>
            <SheetDescription>{state.name || "This design"}</SheetDescription>
          </SheetHeader>
          <BillOfMaterials
            lines={bom.lines}
            total={bom.total}
            vatRate={vatRate}
            products={products}
            errors={errors}
          />
        </SheetContent>
      </Sheet>
    </div>
  );
}

function VenueStep({
  state,
  addresses,
  dispatch,
  nameError,
}: {
  state: BuilderState;
  addresses: Address[];
  dispatch: (a: BuilderAction) => void;
  nameError: string | null;
}) {
  const newSite = state.selections.venue.newSite;
  const setNew = (patch: Partial<NonNullable<typeof newSite>>) =>
    dispatch({
      type: "newSite",
      newSite: {
        label: "New site",
        line1: "",
        line2: null,
        town: "",
        county: null,
        postcode: "",
        country: "GB",
        isDefault: false,
        deliveryNotes: null,
        ...newSite,
        ...patch,
      },
    });

  return (
    <>
      <div className="rounded-2xl border bg-card p-4 sm:p-5">
        <label htmlFor="config-name" className="font-medium">
          Design name
        </label>
        <p className="text-sm text-muted-foreground">
          So you and Brewfitt can find it, for example “Main bar refit”.
        </p>
        <input
          id="config-name"
          value={state.name}
          onChange={(e) => dispatch({ type: "name", name: e.target.value })}
          aria-invalid={!!nameError || undefined}
          aria-describedby={nameError ? "config-name-error" : undefined}
          className="mt-2 h-10 w-full rounded-md border bg-background px-3 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 aria-invalid:border-destructive sm:text-sm"
        />
        {nameError ? (
          <p id="config-name-error" className="mt-1 text-sm text-destructive">
            {nameError}
          </p>
        ) : null}
      </div>

      <fieldset className="rounded-2xl border bg-card p-4 sm:p-5">
        <legend className="mb-3 font-medium">Venue type</legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {(Object.keys(VENUE_LABEL) as VenueType[]).map((v) => (
            <label
              key={v}
              className={cn(
                "flex cursor-pointer items-center justify-center rounded-xl border px-3 py-3 text-center text-sm transition focus-within:ring-3 focus-within:ring-ring/40",
                state.venueType === v
                  ? "border-primary bg-brand-subtle/60 font-medium"
                  : "hover:border-primary/40",
              )}
            >
              <input
                type="radio"
                name="venueType"
                value={v}
                checked={state.venueType === v}
                onChange={() => dispatch({ type: "venue", venueType: v })}
                className="sr-only"
              />
              {VENUE_LABEL[v]}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="rounded-2xl border bg-card p-4 sm:p-5">
        <legend className="mb-3 font-medium">Site</legend>
        <div className="space-y-2">
          {addresses.map((a) => (
            <label
              key={a.id}
              className={cn(
                "flex cursor-pointer gap-3 rounded-xl border p-3 transition focus-within:ring-3 focus-within:ring-ring/40",
                state.siteAddressId === a.id
                  ? "border-primary bg-brand-subtle/60"
                  : "hover:border-primary/40",
              )}
            >
              <input
                type="radio"
                name="site"
                checked={state.siteAddressId === a.id}
                onChange={() => dispatch({ type: "site", siteAddressId: a.id })}
                className="sr-only"
              />
              <MapPinIcon className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden />
              <span className="text-sm">
                <span className="block font-medium">{a.label}</span>
                <span className="block text-muted-foreground">{formatAddress(a).join(", ")}</span>
              </span>
            </label>
          ))}
          <label
            className={cn(
              "flex cursor-pointer gap-3 rounded-xl border p-3 transition focus-within:ring-3 focus-within:ring-ring/40",
              newSite && !state.siteAddressId
                ? "border-primary bg-brand-subtle/60"
                : "hover:border-primary/40",
            )}
          >
            <input
              type="radio"
              name="site"
              checked={!!newSite && !state.siteAddressId}
              onChange={() =>
                dispatch({
                  type: "site",
                  siteAddressId: null,
                  newSite: newSite ?? {
                    label: "New site",
                    line1: "",
                    line2: null,
                    town: "",
                    county: null,
                    postcode: "",
                    country: "GB",
                    isDefault: false,
                    deliveryNotes: null,
                  },
                })
              }
              className="sr-only"
            />
            <MapPinIcon className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden />
            <span className="text-sm font-medium">A new site</span>
          </label>
        </div>
        {newSite && !state.siteAddressId ? (
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {(
              [
                ["label", "Site name"],
                ["line1", "Address line 1"],
                ["town", "Town or city"],
                ["postcode", "Postcode"],
              ] as const
            ).map(([field, label]) => (
              <div key={field}>
                <label htmlFor={`new-${field}`} className="text-sm font-medium">
                  {label}
                </label>
                <input
                  id={`new-${field}`}
                  value={(newSite[field] as string | null) ?? ""}
                  onChange={(e) => setNew({ [field]: e.target.value })}
                  className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 sm:text-sm"
                />
              </div>
            ))}
            <p className="text-xs text-muted-foreground sm:col-span-2">
              Brewfitt adds the site to your account when the quote is confirmed.
            </p>
          </div>
        ) : null}
      </fieldset>
    </>
  );
}

function PythonLength({
  state,
  rules,
  dispatch,
}: {
  state: BuilderState;
  rules: ConfiguratorRules;
  dispatch: (a: BuilderAction) => void;
}) {
  const needed = rules.options.some(
    (o) => o.groupId === "g-python" && o.compatibility.venueTypes?.includes(state.venueType),
  );
  if (!needed) return null;
  const m = state.selections.cooling.pythonMetres;
  return (
    <div className="rounded-2xl border bg-card p-4 sm:p-5">
      <label htmlFor="python" className="font-medium">
        Python length
      </label>
      <p className="text-sm text-muted-foreground">
        The run from the cellar cooler to the furthest font, between {rules.limits.minPythonMetres}{" "}
        and {rules.limits.maxPythonMetres} metres.
      </p>
      <div className="mt-3 flex items-center gap-4">
        <input
          id="python"
          type="range"
          min={rules.limits.minPythonMetres}
          max={rules.limits.maxPythonMetres}
          step={1}
          value={m}
          onChange={(e) => dispatch({ type: "python", metres: Number(e.target.value) })}
          className="flex-1 accent-[var(--primary)]"
          aria-valuetext={`${m} metres`}
        />
        <div className="flex items-center gap-1">
          <input
            type="number"
            min={rules.limits.minPythonMetres}
            max={rules.limits.maxPythonMetres}
            value={m}
            onChange={(e) => dispatch({ type: "python", metres: Number(e.target.value) || 0 })}
            aria-label="Python length in metres"
            className="h-10 w-20 rounded-md border bg-background px-2 text-right tabular-nums"
          />
          <span className="text-sm text-muted-foreground">m</span>
        </div>
      </div>
    </div>
  );
}

function Branding({
  value,
  dispatch,
}: {
  value: string | null;
  dispatch: (a: BuilderAction) => void;
}) {
  return (
    <div className="rounded-2xl border bg-card p-4 sm:p-5">
      <label htmlFor="branding" className="font-medium">
        Branding
      </label>
      <p className="text-sm text-muted-foreground">
        Brands to show on the fonts and badges. Brewfitt will ask for artwork when quoting.
      </p>
      <input
        id="branding"
        value={value ?? ""}
        onChange={(e) => dispatch({ type: "branding", branding: e.target.value || null })}
        placeholder="For example: house lager and guest cider badges"
        className="mt-2 h-10 w-full rounded-md border bg-background px-3 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 sm:text-sm"
      />
    </div>
  );
}

const ARTWORK_TYPES = ".pdf,.ai,.eps,.svg,.png,.jpg,.jpeg";
const MAX_ARTWORK = 20;

/** Artwork files for fonts and badges, added several at a time by picking or dropping. */
function Artwork({ files, dispatch }: { files: string[]; dispatch: (a: BuilderAction) => void }) {
  const [dragging, setDragging] = useState(false);
  const add = (list: FileList | null) => {
    if (!list?.length) return;
    const names = [...list].map((f) => f.name);
    const next = [...new Set([...files, ...names])];
    if (next.length > MAX_ARTWORK)
      toast.error(`Add up to ${MAX_ARTWORK} artwork files`, {
        description: "Combine smaller files into a PDF or send the rest to your account manager.",
      });
    dispatch({ type: "artwork", artwork: next.slice(0, MAX_ARTWORK) });
  };

  return (
    <div className="rounded-2xl border bg-card p-4 sm:p-5">
      <p id="artwork-label" className="font-medium">
        Artwork
      </p>
      <p className="text-sm text-muted-foreground">
        Logos and badge designs for the fonts. Vector files (AI, EPS, SVG or PDF) print best; add as
        many as you need.
      </p>
      <label
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          add(e.dataTransfer.files);
        }}
        className={cn(
          "mt-3 flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed p-6 text-center transition focus-within:ring-3 focus-within:ring-ring/40 hover:border-primary/50 hover:bg-accent/40",
          dragging && "border-primary bg-brand-subtle/50",
        )}
      >
        <UploadSimpleIcon className="size-6 text-primary" aria-hidden />
        <span className="text-sm font-medium">Drop artwork files here or choose files</span>
        <span className="text-xs text-muted-foreground">
          PDF, AI, EPS, SVG, PNG or JPG · up to {MAX_ARTWORK} files
        </span>
        <input
          type="file"
          multiple
          accept={ARTWORK_TYPES}
          aria-labelledby="artwork-label"
          className="sr-only"
          onChange={(e) => {
            add(e.target.files);
            e.target.value = "";
          }}
        />
      </label>
      {files.length ? (
        <ul className="mt-3 space-y-1.5" aria-label="Artwork files">
          {files.map((name) => (
            <li
              key={name}
              className="flex items-center gap-2.5 rounded-lg border bg-background px-3 py-2 text-sm"
            >
              {/\.(png|jpe?g|svg)$/i.test(name) ? (
                <FileImageIcon className="size-5 shrink-0 text-muted-foreground" aria-hidden />
              ) : (
                <FileIcon className="size-5 shrink-0 text-muted-foreground" aria-hidden />
              )}
              <span className="min-w-0 flex-1 truncate">{name}</span>
              <button
                type="button"
                onClick={() =>
                  dispatch({ type: "artwork", artwork: files.filter((f) => f !== name) })
                }
                className="flex size-7 items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground"
                aria-label={`Remove ${name}`}
              >
                <XIcon className="size-4" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <p className="mt-2 text-xs text-muted-foreground" aria-live="polite">
        {files.length
          ? `${files.length} ${files.length === 1 ? "file" : "files"} added. Saved with the design and sent with the quote request.`
          : "In this preview only file names are saved."}
      </p>
    </div>
  );
}

function Review({
  state,
  rules,
  errors,
  nameError,
  addresses,
  onEdit,
}: {
  state: BuilderState;
  rules: ConfiguratorRules;
  errors: Partial<Record<ConfiguratorStepId, string[]>>;
  nameError: string | null;
  addresses: Address[];
  onEdit: (s: StepKey) => void;
}) {
  const chosen = (stepId: ConfiguratorStepId) =>
    rules.groups
      .filter((g) => g.stepId === stepId)
      .flatMap((g) =>
        rules.options
          .filter(
            (o) =>
              o.groupId === g.id &&
              [
                ...state.selections.dispense.optionIds,
                ...state.selections.font.optionIds,
                ...state.selections.cooling.optionIds,
                ...state.selections.gas.optionIds,
                ...state.selections.ancillaries.optionIds,
              ].includes(o.id),
          )
          .map((o) => `${g.label}: ${o.label}`),
      );
  const site = addresses.find((a) => a.id === state.siteAddressId);
  const rows: { step: ConfiguratorStepId; title: string; lines: string[] }[] = [
    {
      step: "venue",
      title: "Venue and site",
      lines: [
        state.name || "Unnamed design",
        VENUE_LABEL[state.venueType],
        site
          ? `${site.label}, ${site.town}`
          : state.selections.venue.newSite
            ? `New site: ${[state.selections.venue.newSite.line1, state.selections.venue.newSite.town].filter(Boolean).join(", ")}`
            : "No site chosen",
      ],
    },
    {
      step: "dispense",
      title: "Dispense points",
      lines: [describePoints(state.selections.dispense.points), ...chosen("dispense")],
    },
    {
      step: "font",
      title: "Font and branding",
      lines: [
        ...chosen("font"),
        ...(state.selections.font.branding ? [`Branding: ${state.selections.font.branding}`] : []),
        ...(state.selections.font.artwork.length
          ? [`Artwork: ${state.selections.font.artwork.join(", ")}`]
          : []),
      ],
    },
    {
      step: "cooling",
      title: "Cooling",
      lines: [...chosen("cooling"), `Python run: ${state.selections.cooling.pythonMetres} m`],
    },
    { step: "gas", title: "Gas", lines: chosen("gas") },
    { step: "ancillaries", title: "Ancillaries", lines: chosen("ancillaries") },
  ];
  return (
    <div className="space-y-3">
      {nameError || Object.keys(errors).length ? (
        <div role="alert" className="rounded-xl bg-warning-subtle p-3 text-sm">
          <p className="font-medium">Complete these before requesting a quote</p>
          <ul className="mt-1 list-disc pl-5">
            {nameError ? <li>{nameError}</li> : null}
            {Object.entries(errors).flatMap(([s, list]) =>
              list!.map((e) => <li key={`${s}-${e}`}>{e}</li>),
            )}
          </ul>
        </div>
      ) : null}
      {rows.map((r) => (
        <section key={r.step} className="flex items-start gap-3 rounded-2xl border bg-card p-4">
          <div className="min-w-0 flex-1">
            <h2 className="flex items-center gap-2 font-medium">
              {r.title}
              {errors[r.step]?.length ? (
                <StatusPill tone="warning">Needs attention</StatusPill>
              ) : null}
            </h2>
            <ul className="mt-1 text-sm text-muted-foreground">
              {(r.lines.length ? r.lines : ["Nothing selected"]).map((l) => (
                <li key={l}>{l}</li>
              ))}
            </ul>
          </div>
          <Button variant="ghost" size="sm" onClick={() => onEdit(r.step)}>
            Change
          </Button>
        </section>
      ))}
    </div>
  );
}
