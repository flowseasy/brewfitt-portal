"use client";

import { useRouter } from "next/navigation";
import { BuildingsIcon, CaretUpDownIcon, CheckIcon } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useMe, usePersona } from "@/features/session/use-session";
import { usePersonaStore } from "@/stores/persona-store";

/** Group contacts see every site with roll-up totals and can switch into any site. */
export function SiteSwitcher() {
  const router = useRouter();
  const persona = usePersona();
  const me = useMe();
  const setActiveSite = usePersonaStore((s) => s.setActiveSite);

  if (persona.kind !== "group" || !me.data?.group) return null;
  const { account: group, sites } = me.data.group;
  const current = sites.find((s) => s.id === persona.activeSiteId);

  const choose = (siteId: string | null) => {
    setActiveSite(siteId);
    router.refresh();
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="max-w-56 gap-2" aria-label="Choose site">
          <BuildingsIcon aria-hidden />
          <span className="truncate">{current ? current.name : `All ${sites.length} sites`}</span>
          <CaretUpDownIcon className="text-muted-foreground" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel>{group.name}</DropdownMenuLabel>
        <DropdownMenuItem onSelect={() => choose(null)}>
          {persona.activeSiteId === null ? <CheckIcon aria-hidden /> : <span className="size-4" />}
          All sites (group roll-up)
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {sites.map((site) => (
          <DropdownMenuItem key={site.id} onSelect={() => choose(site.id)}>
            {persona.activeSiteId === site.id ? (
              <CheckIcon aria-hidden />
            ) : (
              <span className="size-4" />
            )}
            {site.name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
