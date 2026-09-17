import { EnvelopeSimpleIcon, PhoneIcon } from "@phosphor-icons/react/dist/ssr";
import type { BrewfittTeamMember } from "@/types";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { initials } from "@/lib/format";

export const TEAM_ROLE_LABEL: Record<BrewfittTeamMember["role"], string> = {
  "account-manager": "Account manager",
  "technical-manager": "Technical manager",
  buyer: "Buyer",
  "sales-office": "Sales office",
  "credit-control": "Credit control",
  "service-engineer": "Service engineer",
  "managing-director": "Managing director",
};

export function TeamMemberCard({
  member,
  compact,
}: {
  member: BrewfittTeamMember;
  compact?: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      <Avatar className={compact ? "size-9" : "size-10"}>
        <AvatarFallback className="bg-muted text-sm font-medium">
          {initials(member.name)}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{member.name}</p>
        <p className="truncate text-sm text-muted-foreground">{TEAM_ROLE_LABEL[member.role]}</p>
      </div>
      <div className="flex gap-1">
        <a
          href={`tel:${member.phone.replace(/\s/g, "")}`}
          className="flex size-9 items-center justify-center rounded-full border text-muted-foreground hover:bg-accent hover:text-foreground"
          aria-label={`Call ${member.name} on ${member.phone}`}
        >
          <PhoneIcon className="size-4" aria-hidden />
        </a>
        <a
          href={`mailto:${member.email}`}
          className="flex size-9 items-center justify-center rounded-full border text-muted-foreground hover:bg-accent hover:text-foreground"
          aria-label={`Email ${member.name}`}
        >
          <EnvelopeSimpleIcon className="size-4" aria-hidden />
        </a>
      </div>
    </div>
  );
}
