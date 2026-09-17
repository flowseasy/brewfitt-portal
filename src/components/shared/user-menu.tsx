"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowCounterClockwiseIcon,
  DesktopIcon,
  MoonIcon,
  SignOutIcon,
  SignpostIcon,
  SunIcon,
  UserCircleIcon,
  UserSwitchIcon,
} from "@phosphor-icons/react";
import { toast } from "sonner";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useMe, usePersona } from "@/features/session/use-session";
import { api } from "@/lib/api";
import { initials } from "@/lib/format";
import { landingFor } from "@/stores/onboarding-store";
import { usePersonaStore } from "@/stores/persona-store";
import { useThemeStore, type ThemePreference } from "@/stores/theme-store";
import { ConfirmDialog } from "./confirm-dialog";
import { PersonaList } from "./persona-list";

export function UserMenu() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const me = useMe();
  const persona = usePersona();
  const setPersona = usePersonaStore((s) => s.setPersona);
  const signOut = usePersonaStore((s) => s.signOut);
  const theme = useThemeStore((s) => s.preference);
  const setTheme = useThemeStore((s) => s.setPreference);
  const [switchOpen, setSwitchOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);

  const reset = useMutation({
    mutationFn: () => api.demo.reset(),
    onSuccess: async () => {
      await queryClient.resetQueries();
      setResetOpen(false);
      toast.success("Demo data reset", {
        description: "Every change made in this browser has been cleared.",
      });
    },
  });

  const name = me.data?.contact.name ?? "";

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className="h-9 gap-2 rounded-full px-1.5 sm:pr-3"
            aria-label="User menu"
          >
            <Avatar className="size-7">
              <AvatarFallback className="bg-brand-subtle text-xs font-medium text-brand-subtle-foreground">
                {name ? initials(name) : ""}
              </AvatarFallback>
            </Avatar>
            <span className="hidden max-w-40 truncate text-sm font-medium sm:inline md:hidden">
              {name}
            </span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuLabel className="font-normal">
            <div className="truncate font-medium">{name}</div>
            <div className="truncate text-xs text-muted-foreground">{me.data?.contact.title}</div>
            <div className="truncate text-xs text-muted-foreground">
              {me.data?.group?.account.name ?? me.data?.account.name}
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem asChild>
              <Link href="/account">
                <UserCircleIcon aria-hidden />
                Account
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setSwitchOpen(true)}>
              <UserSwitchIcon aria-hidden />
              Switch persona
            </DropdownMenuItem>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                {theme === "dark" ? (
                  <MoonIcon aria-hidden />
                ) : theme === "light" ? (
                  <SunIcon aria-hidden />
                ) : (
                  <DesktopIcon aria-hidden />
                )}
                Theme
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                <DropdownMenuRadioGroup
                  value={theme}
                  onValueChange={(v) => setTheme(v as ThemePreference)}
                >
                  <DropdownMenuRadioItem value="light">Light</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="dark">Dark</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="system">Match device</DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link href="/onboarding">
              <SignpostIcon aria-hidden />
              Take the tour
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setResetOpen(true)}>
            <ArrowCounterClockwiseIcon aria-hidden />
            Reset demo data
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => {
              signOut();
              router.replace("/");
            }}
          >
            <SignOutIcon aria-hidden />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={switchOpen} onOpenChange={setSwitchOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Switch persona</DialogTitle>
            <DialogDescription>
              In Phase 1 a persona stands in for signing in. Each one sees only their own account.
            </DialogDescription>
          </DialogHeader>
          <PersonaList
            current={persona}
            onChoose={(option) => {
              setPersona(option.persona);
              setSwitchOpen(false);
              router.push(landingFor(option.persona.contactId));
              toast.success(`Now viewing as ${option.label}`);
            }}
          />
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={resetOpen}
        onOpenChange={setResetOpen}
        title="Reset demo data?"
        description="Quotes accepted, orders placed, messages sent and every other change made in this browser will be cleared. The demonstration data returns to its starting point."
        confirmLabel="Reset demo data"
        destructive
        pending={reset.isPending}
        onConfirm={() => reset.mutate()}
      />
    </>
  );
}
