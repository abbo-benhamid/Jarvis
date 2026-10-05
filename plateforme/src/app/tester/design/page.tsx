import type { Metadata } from "next";
import {
  ArrowRight,
  Bell,
  BookOpen,
  Calendar,
  ChevronLeft,
  Heart,
  House,
  Info,
  Lock,
  Phone,
  ScanLine,
  Share,
  Sparkles,
  Sun,
  User,
  Users,
} from "lucide-react";
import {
  ActionDock,
  Alert,
  Avatar,
  AvatarStack,
  Badge,
  BottomNav,
  BrandMark,
  Button,
  Card,
  CardLink,
  Chip,
  DateBox,
  EmptyState,
  Eyebrow,
  IconButton,
  Input,
  KayeCard,
  KayeDetail,
  LinkButton,
  MadrasLine,
  PlanRadio,
  ProofBadge,
  ProofSteps,
  SectionHeader,
  StatusCard,
  SunriseIllustration,
  Switch,
  ThemeToggle,
  VisitReceipt,
  VoiceMemo,
  FormField,
  fieldA11y,
} from "@/components/ui";

export const metadata: Metadata = {
  title: "Système de design",
  description: "Démonstration des composants Koudmen (direction artistique v1), en clair et en sombre.",
};

/** Personnages fictifs de la maquette (site/maquette-conso.html). */
const NAV = [
  { href: "/tester/design", label: "Accueil", icon: <House />, exact: true },
  { href: "/tester/design#kaye", label: "Kayé", icon: <BookOpen /> },
  { href: "/tester/design#lakou", label: "Lakou", icon: <Users /> },
  { href: "/tester/design#agenda", label: "Agenda", icon: <Calendar /> },
  { href: "/tester/design#compte", label: "Compte", icon: <User /> },
];

const SWATCHES = [
  { name: "Sable", role: "fond", cls: "bg-bg text-fg shadow-[inset_0_0_0_1px_var(--line)]" },
  { name: "Coton", role: "cartes", cls: "bg-surface text-fg shadow-[inset_0_0_0_1px_var(--line)]" },
  { name: "Encre", role: "texte", cls: "bg-fg text-bg" },
  { name: "Mer", role: "agir", cls: "bg-mer text-on-mer" },
  { name: "Feuille", role: "preuve, va bien", cls: "bg-feuille-soft text-feuille" },
  { name: "Soleil", role: "créole, chaleur", cls: "bg-soleil-soft text-soleil-ink" },
  { name: "Hibiscus", role: "alerte seulement", cls: "bg-hibiscus-soft text-hibiscus" },
  { name: "Sable creusé", role: "puces, champs", cls: "bg-surface-2 text-fg" },
];

function DemoSection({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={`${id}-titre`} className="mt-10">
      <Eyebrow id={`${id}-titre`} className="mb-3">
        {title}
      </Eyebrow>
      {children}
    </section>
  );
}

export default function DesignPage() {
  return (
    <main id="contenu" className="mx-auto w-full max-w-[var(--app-column)] px-5 pt-4 pb-10 max-[359px]:px-4">
      {/* En-tête de la démo */}
      <div className="flex min-h-14 items-center justify-between gap-2">
        <span className="flex items-center gap-2.5 font-display text-[22px] font-medium tracking-[-.01em]">
          <BrandMark />
          Koudmen
        </span>
        <LinkButton href="/tester" variant="link">
          Tester
        </LinkButton>
      </div>
      <Eyebrow className="mt-4">Système de design · v1</Eyebrow>
      <h1 className="mt-2 font-display text-[42px] leading-[1.02] font-normal tracking-[-.025em]">
        Le calme d&apos;une <em className="text-mer italic">bonne nouvelle.</em>
      </h1>
      <p className="mt-3.5 text-[17px] leading-normal text-muted">
        Chaque composant de cette page sert aux écrans de Koudmen. Changez le thème pour voir le rendu sombre.
      </p>
      <ThemeToggle className="mt-5" />
      <MadrasLine className="mt-6" />

      {/* Palette */}
      <DemoSection id="palette" title="Palette : 90 % neutres, 10 % accents">
        <ul className="m-0 grid list-none grid-cols-2 gap-2.5 p-0">
          {SWATCHES.map((s) => (
            <li key={s.name} className={`flex h-[84px] flex-col justify-end rounded-md px-3 py-2.5 text-[13px] leading-tight font-semibold ${s.cls}`}>
              {s.name}
              <small className="font-medium opacity-75">{s.role}</small>
            </li>
          ))}
        </ul>
      </DemoSection>

      {/* Typographie */}
      <DemoSection id="typo" title="Typographie : Fraunces + Figtree">
        <p className="font-display text-5xl leading-none tracking-[-.03em]">
          Sa ka <em className="text-mer italic">maché.</em>
        </p>
        <dl className="mt-4">
          {[
            { sample: <span className="font-display text-[30px] tracking-[-.02em]">Elle va bien.</span>, spec: "Fraunces 400 · 30/34" },
            { sample: <span className="text-[17px] font-semibold">Prochaine visite jeudi, 10 h</span>, spec: "Figtree 600 · 17/24" },
            { sample: <span className="num text-2xl font-semibold">149,00 € · 2/3</span>, spec: "Figtree chiffres tabulaires" },
          ].map((r) => (
            <div key={r.spec} className="flex flex-wrap items-baseline justify-between gap-3 border-t border-line py-3">
              <dt>{r.sample}</dt>
              <dd className="m-0 text-[13px] whitespace-nowrap text-muted">{r.spec}</dd>
            </div>
          ))}
        </dl>
      </DemoSection>

      {/* Accueil famille */}
      <DemoSection id="famille" title="Accueil famille">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-display text-[30px] leading-[1.1] tracking-[-.02em]">
              <span lang="gcf">Bonjou</span>, Sandrine
            </p>
            <p className="mt-1 text-[15px] text-muted">Lundi 5 octobre</p>
          </div>
          <IconButton label="Notifications" filled>
            <Bell strokeWidth={1.6} />
          </IconButton>
        </div>
        <StatusCard
          className="mt-[18px]"
          label="État de Léonie"
          name="Léonie, votre maman"
          detail="84 ans · Sainte-Luce"
          lead="Elle va"
          word="bien."
          tone="bien"
          kreyol="Sa ka maché"
          note="visite samedi, 12 h 01"
          stats={[
            { value: "4", label: "visites en sept." },
            { value: "2/3", label: "preuves samedi" },
            { value: "96 %", label: "avec Josiane" },
          ]}
        />
        <SectionHeader title="Prochaine visite" />
        <CardLink href="/tester/design#agenda">
          <span className="flex items-center gap-4">
            <DateBox day="Jeu" date={8} label="Jeudi 8 octobre" />
            <span className="min-w-0">
              <b className="block font-semibold">10 h – 12 h · avec Josiane</b>
              <span className="block text-[15px] leading-[1.4] text-muted">Marché de Rivière-Pilote, puis le courrier de la CGSS.</span>
            </span>
          </span>
        </CardLink>
        <SectionHeader
          title="Dernier Kayé"
          action={
            <LinkButton href="/tester/design#kaye" variant="link" className="min-h-11 px-0 text-[15px]">
              Tout voir
            </LinkButton>
          }
        />
        <KayeCard
          author="Josiane"
          day="samedi"
          proof="preuve"
          quote="« Di Sandrine pa enkyèt kò'y. »"
          quoteLang="gcf"
          translation="« Dites à Sandrine de ne pas s'inquiéter. »"
        />
        <StatusCard
          className="mt-3"
          label="Exemple d'état à surveiller"
          name="M. Désiré"
          detail="79 ans · Le Vauclin"
          lead="Il est"
          word="fatigué."
          tone="surveiller"
          note="Josiane repasse demain."
        />
      </DemoSection>

      {/* Kayé */}
      <DemoSection id="kaye" title="Kayé et reçu de visite">
        <div className="flex min-h-14 items-center justify-between gap-2">
          <IconButton label="Retour" className="-ml-2.5">
            <ChevronLeft strokeWidth={1.6} />
          </IconButton>
          <span className="text-[17px] font-semibold">Kayé · samedi 3 oct.</span>
          <IconButton label="Partager au lakou" className="-mr-2.5">
            <Share strokeWidth={1.6} />
          </IconButton>
        </div>
        <KayeDetail
          mood="Humeur : joyeuse"
          moodIcon={<Sun strokeWidth={1.8} />}
          title="Le marché, puis le blaff de midi."
          author="Josiane Mathurin"
          time="10 h 04 – 12 h 01"
        >
          <p className="text-[17px] leading-[1.55]">
            Léonie était en forme. Nous sommes allées au marché. Elle a choisi ses christophines elle-même. Elle a bien mangé à midi.
          </p>
          <VoiceMemo className="mt-4" label="Écouter le mot de Léonie, 24 secondes" duration="0:24" />
          <VisitReceipt
            className="mt-6"
            code="KDM-2610-0417"
            times={[
              { label: "Arrivée", value: "10:04" },
              { label: "Départ", value: "12:01" },
              { label: "Durée", value: "1 h 57" },
            ]}
            proofs={[
              { label: "Position à l'arrivée", detail: "À 12 m de la maison", time: "10:04", obtained: true },
              { label: "Tag scanné chez Léonie", detail: "Sur la porte de la cuisine", time: "10:05", obtained: true },
              { label: "Confirmation de l'aîné", detail: "Léonie n'a pas décroché", time: "11:58", obtained: false },
            ]}
            verdictText="Deux preuves suffisent. Le paiement de Josiane part."
          />
        </KayeDetail>
        <div className="mt-3 flex gap-3 rounded-lg border border-line p-4">
          <Sparkles aria-hidden="true" className="mt-0.5 size-[18px] shrink-0 text-mer" strokeWidth={1.6} />
          <p className="text-[15.5px] leading-[1.45]">
            Rien d&apos;inhabituel. L&apos;appétit et le sommeil restent stables depuis 3 semaines.
            <small className="mt-1 block text-[13.5px] text-muted">Résumé automatique. Ce n&apos;est pas un avis médical.</small>
          </p>
        </div>
        <Button variant="quiet" size="lg" fullWidth className="mt-4" icon={<Heart className="text-hibiscus" strokeWidth={1.6} />}>
          Remercier Josiane
        </Button>
      </DemoSection>

      {/* Accompagnante */}
      <DemoSection id="agenda" title="Accompagnante : preuve pas à pas">
        <Card padding="dense">
          <div className="flex items-center gap-3.5">
            <Avatar name="Léonie" role="aine" size={48} />
            <div className="min-w-0">
              <b className="block text-lg font-semibold">Léonie Bellance</b>
              <span className="block text-[15px] text-muted">Quartier Désert, Sainte-Luce</span>
            </div>
            <IconButton label="Appeler Léonie" filled className="ml-auto [&_svg]:size-[18px]">
              <Phone strokeWidth={1.6} />
            </IconButton>
          </div>
          <div className="mt-3.5 flex flex-wrap gap-2">
            <Chip>Dominos</Chip>
            <Chip>Son jardin</Chip>
            <Chip>Parle créole</Chip>
          </div>
        </Card>
        <SectionHeader title="Preuve de visite · 2 sur 3 suffisent" />
        <Card padding="none" className="px-[18px] py-1">
          <ProofSteps
            steps={[
              { label: "Position à l'arrivée", detail: "Arrivée à 9 h 58", state: "done", aside: <b className="num font-semibold text-feuille">OK</b> },
              { label: "Scanner le tag", detail: "Sur la porte de la cuisine", state: "current", icon: <ScanLine />, aside: <ProofBadge status="a-faire" /> },
              { label: "Confirmation de l'aîné", detail: "Léonie tape 1 en fin de visite", state: "todo", icon: <Phone /> },
            ]}
          />
        </Card>
        <ActionDock position="static" className="-mx-5 mt-4" hint="Vous êtes arrivée à 9 h 58. Encore 1 preuve.">
          <Button size="xl" fullWidth icon={<ScanLine className="!size-6" strokeWidth={1.6} />}>
            Scanner le tag
          </Button>
        </ActionDock>
      </DemoSection>

      {/* Formule */}
      <DemoSection id="lakou" title="Formule et partage">
        <h2 className="font-display text-[28px] leading-[1.12] font-normal tracking-[-.02em]">Comment veiller sur Léonie ?</h2>
        <PlanRadio
          className="mt-5"
          name="formule"
          legend="Formules"
          legendHidden
          defaultValue="serenite"
          notice={null}
          options={[
            { value: "libre", name: "Libre", price: "0 €", description: "Le cercle Lakou et le Kayé partagé, sans visite." },
            { value: "koze", name: "Kozé", price: "39 €", priceSuffix: "/ mois", description: "Un appel chaque semaine à Léonie." },
            {
              value: "serenite",
              name: "Sérénité",
              price: "149 €",
              pricePrefix: "dès",
              priceSuffix: "/ mois",
              tag: "Conseillé pour Léonie",
              description: "Une visite chaque semaine, prouvée.",
              features: ["Tout Kozé, plus une visite par semaine", "Un reçu de visite à chaque passage", "Aide pour trouver une remplaçante"],
            },
          ]}
        />
        <Card className="mt-3 flex items-center gap-3.5">
          <AvatarStack
            people={[
              { name: "Marc", role: "proche" },
              { name: "Nadia", role: "proche-2" },
            ]}
          />
          <div className="min-w-0 flex-1">
            <b id="partage-titre" className="block leading-[1.3] font-semibold">
              Partager les frais
            </b>
            <span id="partage-detail" className="mt-0.5 block text-[14.5px] leading-[1.4] text-muted">
              Marc et Nadia paient avec vous : <b className="num">49,67 €</b> chacun.
            </span>
          </div>
          <Switch defaultChecked labelledBy="partage-titre" describedBy="partage-detail" />
        </Card>
        <Card className="mt-3">
          <ul className="num m-0 list-none p-0">
            <li className="flex justify-between gap-3 py-2 text-[15.5px]">
              <span className="text-muted">Sérénité · octobre</span>
              <b className="font-semibold">149,00 €</b>
            </li>
            <li className="flex justify-between gap-3 py-2 text-[15.5px]">
              <span className="text-muted">Part de Marc et Nadia</span>
              <b className="font-semibold">− 99,33 €</b>
            </li>
            <li className="mt-1.5 flex justify-between gap-3 border-t border-line pt-3.5 text-[17px]">
              <span className="font-semibold">Vous payez</span>
              <b className="text-[22px] font-semibold">49,67 €</b>
            </li>
          </ul>
        </Card>
        <p className="mx-1 mt-3.5 flex items-start gap-2 text-[13.5px] leading-[1.4] text-muted">
          <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0" strokeWidth={1.8} />
          Heures de visite payées à part à Josiane (CESU+), avec 50 % de crédit d&apos;impôt.
        </p>
        <ActionDock position="static" className="-mx-5 mt-2" hint="Offre en test, non commercialisée.">
          <Button size="lg" fullWidth icon={<Lock strokeWidth={1.6} />}>
            Payer <span className="num">49,67 €</span>
          </Button>
        </ActionDock>
      </DemoSection>

      {/* Boutons, badges, champs */}
      <DemoSection id="compte" title="Boutons, badges, champs">
        <div className="flex flex-col gap-3">
          <Button size="lg" fullWidth iconEnd={<ArrowRight strokeWidth={1.6} />}>
            Commencer
          </Button>
          <Button variant="ink" size="lg" fullWidth>
            Action forte (encre)
          </Button>
          <Button variant="quiet" size="lg" fullWidth>
            Action secondaire
          </Button>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="link">Lien d&apos;action</Button>
            <Button variant="primary" disabled>
              Désactivé
            </Button>
            <Button variant="danger">Supprimer</Button>
          </div>
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          <ProofBadge />
          <ProofBadge status="conseille" />
          <ProofBadge status="a-faire" />
          <Badge tone="neutre">Neutre</Badge>
          <Badge tone="mer">Mode test</Badge>
          <Badge tone="hibiscus">Alerte</Badge>
        </div>
        <div className="mt-5 flex items-center gap-5">
          <Avatar name="Léonie" role="aine" size={56} />
          <Avatar name="Josiane" role="accompagnant" size={44} />
          <Avatar name="Marc" role="proche" size={32} />
          <AvatarStack
            label="Marc, Nadia et Élise"
            people={[
              { name: "Marc", role: "proche" },
              { name: "Nadia", role: "proche-2" },
              { name: "Élise", role: "accompagnant" },
            ]}
          />
        </div>
        <FormField className="mt-6" label="Votre prénom" htmlFor="demo-prenom" hint="Il apparaît dans le Kayé partagé.">
          <Input {...fieldA11y("demo-prenom", undefined, true)} defaultValue="Sandrine" autoComplete="given-name" />
        </FormField>
        <FormField className="mt-4" label="Téléphone" htmlFor="demo-tel" errors="Entrez un numéro à 10 chiffres.">
          <Input {...fieldA11y("demo-tel", "Entrez un numéro à 10 chiffres.")} type="tel" defaultValue="0696 12" autoComplete="tel" />
        </FormField>
        <div className="mt-5 flex flex-col gap-3">
          <Alert tone="info" title="Bon à savoir">
            Le Kayé arrive après chaque visite.
          </Alert>
          <Alert tone="succes">Votre demande est envoyée.</Alert>
          <Alert tone="attention">Josiane est en retard de 10 min.</Alert>
          <Alert tone="danger">Le paiement a échoué. Rien n&apos;a été débité.</Alert>
        </div>
      </DemoSection>

      <DemoSection id="vide" title="État vide">
        <EmptyState
          title="Pas encore de Kayé."
          action={
            <LinkButton href="/tester/design#agenda" size="lg" fullWidth>
              Planifier une visite
            </LinkButton>
          }
        >
          Le premier arrive après la première visite.
        </EmptyState>
      </DemoSection>

      <DemoSection id="illustration" title="Illustration">
        <div className="relative overflow-hidden rounded-media">
          <SunriseIllustration label="Illustration : lever de soleil sur la mer, une case créole sur le morne" />
          <div className="absolute inset-x-3.5 bottom-3.5 flex items-center gap-3 rounded-[18px] bg-[color-mix(in_srgb,var(--surface)_86%,transparent)] px-3.5 py-3 shadow-[0_8px_24px_-10px_rgb(0_0_0/.25)] backdrop-blur-[12px]">
            <Avatar name="Léonie" role="aine" size={36} />
            <p className="text-[14.5px] leading-[1.35]">
              <b className="mb-0.5 block text-[13px] font-semibold text-muted">Kayé de Léonie · il y a 2 h</b>
              Elle a bien mangé. Elle a ri en parlant du marché.
            </p>
          </div>
        </div>
      </DemoSection>

      <DemoSection id="nav" title="Navigation basse">
        <div className="-mx-5 overflow-hidden">
          <BottomNav items={NAV} position="static" current="/tester/design" label="Navigation de démonstration" />
        </div>
      </DemoSection>
    </main>
  );
}
