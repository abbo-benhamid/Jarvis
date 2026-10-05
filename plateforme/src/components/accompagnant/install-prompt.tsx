"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BrandMark } from "@/components/ui/illustrations";

/**
 * Invite d'installation (PWA légère, ADR 0008 lot W4).
 * Règles :
 * 1. Jamais au premier écran : la page l'affiche seulement après une action réussie (`show`).
 * 2. Une seule fois : « Plus tard » la cache 30 jours (préférence locale de cet appareil).
 * 3. Rien si l'app est déjà installée, ou si le navigateur ne sait pas installer.
 */

type InstallEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "koudmen.installation.plus-tard";
const DISMISS_DAYS = 30;

// Mémoire partagée de la page : l'événement arrive souvent AVANT l'action réussie (autre écran).
let deferred: InstallEvent | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

/** À placer une fois dans la coque : garde l'événement « beforeinstallprompt » pour plus tard. */
export function InstallCapture() {
  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault(); // pas de bannière du navigateur au premier écran
      deferred = e as InstallEvent;
      emit();
    };
    const onInstalled = () => {
      deferred = null;
      emit();
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);
  return null;
}

function isStandalone(): boolean {
  const nav = navigator as Navigator & { standalone?: boolean };
  return window.matchMedia("(display-mode: standalone)").matches || nav.standalone === true;
}

/** iPhone / iPad dans Safari : pas d'événement d'installation, on explique le geste. */
function isIosSafari(): boolean {
  const ua = navigator.userAgent;
  const ios = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  return ios && /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
}

function dismissedRecently(): boolean {
  try {
    const at = Number(window.localStorage.getItem(DISMISS_KEY));
    return Number.isFinite(at) && at > 0 && Date.now() - at < DISMISS_DAYS * 86_400_000;
  } catch {
    return false;
  }
}

function rememberDismiss() {
  try {
    window.localStorage.setItem(DISMISS_KEY, String(Date.now()));
  } catch {
    // Stockage bloqué (navigation privée) : l'invite reviendra, ce n'est pas grave.
  }
}

export function InstallPrompt({ show }: { show: boolean }) {
  const event = useSyncExternalStore(subscribe, () => deferred, () => null);
  const [mode, setMode] = useState<"hidden" | "event" | "ios">("hidden");
  const [closed, setClosed] = useState(false);

  useEffect(() => {
    if (!show || isStandalone() || dismissedRecently()) {
      setMode("hidden");
      return;
    }
    setMode(event ? "event" : isIosSafari() ? "ios" : "hidden");
  }, [show, event]);

  if (!show || closed || mode === "hidden") return null;

  const later = () => {
    rememberDismiss();
    setClosed(true);
  };

  const install = async () => {
    if (!deferred) return;
    const e = deferred;
    deferred = null;
    await e.prompt();
    const choice = await e.userChoice.catch(() => ({ outcome: "dismissed" as const }));
    if (choice.outcome === "dismissed") rememberDismiss();
    setClosed(true);
    emit();
  };

  return (
    <section
      aria-labelledby="installer-titre"
      className="flex flex-col gap-3 rounded-card bg-surface p-5 text-fg shadow-card"
    >
      <div className="flex items-start gap-3.5">
        <BrandMark size={44} />
        <div className="min-w-0">
          <h2 id="installer-titre" className="font-sans text-[17px] leading-[1.3] font-semibold">
            Gardez Koudmen sur votre écran d&apos;accueil
          </h2>
          <p className="mt-1 text-[15px] leading-[1.45] text-muted">
            Vous ouvrez vos visites en un geste, comme une application. Rien à télécharger dans un magasin.
          </p>
        </div>
      </div>
      {mode === "ios" ? (
        <>
          <p className="flex items-start gap-2 rounded-md bg-surface-2 px-3.5 py-3 text-[15px]">
            <Smartphone aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-mer" strokeWidth={1.6} />
            <span>
              Touchez le bouton <strong>Partager</strong> de Safari, puis <strong>Sur l&apos;écran d&apos;accueil</strong>.
            </span>
          </p>
          <Button variant="quiet" size="lg" fullWidth onClick={later}>
            J&apos;ai compris
          </Button>
        </>
      ) : (
        <div className="flex flex-col gap-2">
          <Button variant="ink" size="lg" fullWidth onClick={install}>
            Ajouter à l&apos;écran d&apos;accueil
          </Button>
          <Button variant="link" size="lg" fullWidth onClick={later}>
            Plus tard
          </Button>
        </div>
      )}
    </section>
  );
}
