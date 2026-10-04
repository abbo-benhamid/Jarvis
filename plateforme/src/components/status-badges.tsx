import type { CaregiverValidation, ProposalStatus, RequestStatus, VisitStatus } from "@prisma/client";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import {
  PROPOSAL_STATUS_LABELS,
  REQUEST_STATUS_LABELS,
  VALIDATION_LABELS,
  VISIT_STATUS_LABELS,
  LEVEL_LABELS,
} from "@/lib/labels";

const VISIT_TONE: Record<VisitStatus, BadgeTone> = {
  PREVUE: "neutre",
  EN_COURS: "mer",
  VALIDEE: "feuille",
  A_VERIFIER: "soleil",
};

export function VisitStatusBadge({ status }: { status: VisitStatus }) {
  return <Badge tone={VISIT_TONE[status]}>{VISIT_STATUS_LABELS[status]}</Badge>;
}

const VALIDATION_TONE: Record<CaregiverValidation, BadgeTone> = {
  BROUILLON: "neutre",
  EN_ATTENTE: "soleil",
  VALIDE: "feuille",
  REFUSE: "hibiscus",
  SUSPENDU: "hibiscus",
};

export function ValidationBadge({ status }: { status: CaregiverValidation }) {
  return <Badge tone={VALIDATION_TONE[status]}>{VALIDATION_LABELS[status]}</Badge>;
}

const REQUEST_TONE: Record<RequestStatus, BadgeTone> = {
  OUVERTE: "soleil",
  PROPOSEE: "mer",
  POURVUE: "feuille",
  ANNULEE: "neutre",
};

export function RequestStatusBadge({ status }: { status: RequestStatus }) {
  return <Badge tone={REQUEST_TONE[status]}>{REQUEST_STATUS_LABELS[status]}</Badge>;
}

const PROPOSAL_TONE: Record<ProposalStatus, BadgeTone> = {
  EN_ATTENTE: "soleil",
  ACCEPTEE: "feuille",
  REFUSEE: "neutre",
  ANNULEE: "neutre",
};

export function ProposalStatusBadge({ status }: { status: ProposalStatus }) {
  return <Badge tone={PROPOSAL_TONE[status]}>{PROPOSAL_STATUS_LABELS[status]}</Badge>;
}

export function LevelBadge({ level }: { level: number }) {
  return <Badge tone="mer">{LEVEL_LABELS[level] ?? `Niveau ${level}`}</Badge>;
}
