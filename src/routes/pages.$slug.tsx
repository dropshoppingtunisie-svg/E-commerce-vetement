import { createFileRoute, notFound } from "@tanstack/react-router";
import {
  FileText,
  ShieldCheck,
  Truck,
  RefreshCcw,
  Scale,
  Mail,
  CalendarDays,
  ChevronRight,
} from "lucide-react";

import { StoreLayout } from "@/components/store/StoreLayout";
import { useSiteSettings } from "@/context/SiteSettingsContext";

type PageSection = {
  heading: string;
  body?: string;
  /** Liste à puces affichée sous le paragraphe. */
  items?: string[];
  /** Paragraphe de précision affiché après la liste. */
  note?: string;
};

type StaticPageData = {
  title: string;
  intro: string;
  sections: PageSection[];
};

const pages: Record<string, StaticPageData> = {
  cgv: {
    title: "Conditions générales de vente",
    intro:
      "Les présentes conditions régissent les ventes réalisées sur le site (contenu de démonstration).",
    sections: [
      {
        heading: "1. Commandes",
        body: "Toute commande passée sur le site vaut acceptation des présentes conditions. Une confirmation est envoyée par SMS après validation par notre équipe.",
      },
      {
        heading: "2. Prix et paiement",
        body: "Les prix sont indiqués en dinars tunisiens, toutes taxes comprises. Le seul mode de règlement accepté est le paiement à la livraison (espèces à la réception).",
      },
      {
        heading: "3. Livraison",
        body: "Livraison sous 24 à 48 heures ouvrées dans les 24 gouvernorats. Les frais de livraison s'élèvent à 7 DT.",
      },
      {
        heading: "4. Retours",
        body: "Vous disposez de 7 jours après réception pour retourner un produit non utilisé dans son emballage d'origine.",
      },
    ],
  },

  cgu: {
    title: "Conditions générales d'utilisation",
    intro:
      "Règles d'utilisation du site et des comptes clients (contenu de démonstration).",
    sections: [
      {
        heading: "Compte client",
        body: "Vous êtes responsable de la confidentialité de vos identifiants et des activités réalisées depuis votre compte.",
      },
      {
        heading: "Contenus",
        body: "Les visuels, textes et marques présents sur le site sont protégés et ne peuvent être reproduits sans autorisation.",
      },
      {
        heading: "Avis clients",
        body: "Les avis publiés doivent rester courtois et se rapporter au produit concerné. Tout contenu abusif peut être retiré.",
      },
    ],
  },

  "mentions-legales": {
    title: "Mentions légales",
    intro:
      "Informations relatives à l'éditeur du site (contenu de démonstration).",
    sections: [
      {
        heading: "Éditeur",
        body: "Bufanda SARL — Avenue Habib Bourguiba, Tunis, Tunisie. Matricule fiscal : 0000000/X/X/000.",
      },
      {
        heading: "Contact",
        body: "contact@Bufanda.tn — +216 71 000 000",
      },
      {
        heading: "Hébergement",
        body: "Site hébergé sur une infrastructure cloud européenne.",
      },
    ],
  },

  livraison: {
    title: "Livraison & retours",
    intro:
      "Tout ce qu'il faut savoir sur l'acheminement de votre commande.",
    sections: [
      {
        heading: "Délais",
        body: "24 à 48 heures ouvrées dans le Grand Tunis, 48 à 72 heures dans les autres gouvernorats.",
      },
      {
        heading: "Frais",
        body: "7 DT quel que soit le nombre d'articles. Offerts dès 500 DT d'achat.",
      },
      {
        heading: "Suivi",
        body: "Un SMS vous informe du départ du colis et le livreur vous appelle avant son passage.",
      },
    ],
  },

  confidentialite: {
    title: "Politique de confidentialité",
    intro:
      "Dernière mise à jour : 24 août 2026. La protection de vos données personnelles est une priorité pour Bufanda. Nous nous engageons à traiter vos informations avec la plus grande confidentialité et transparence.",
    sections: [
      {
        heading: "Données collectées",
        body: "Lors de votre navigation et de vos achats sur notre site, nous sommes amenés à collecter les informations suivantes :",
        items: [
          "Nom, prénom et coordonnées (e-mail, téléphone, adresse de livraison)",
          "Historique de commandes et préférences produits",
        ],
      },
      {
        heading: "Utilisation des données",
        body: "Vos données sont utilisées exclusivement pour :",
        items: [
          "Traiter et suivre vos commandes",
          "Vous envoyer des informations relatives à votre compte",
          "Améliorer votre expérience sur notre site",
          "Vous adresser des offres personnalisées, avec votre accord préalable",
        ],
      },
      {
        heading: "Partage des données",
        body: "Nous ne vendons ni ne partageons vos données personnelles avec des tiers à des fins commerciales.",
      },
      {
        heading: "Cookies",
        body: "Notre site utilise des cookies pour améliorer la navigation et analyser notre audience. Vous pouvez les désactiver via les paramètres de votre navigateur ; certaines fonctionnalités pourraient alors être limitées.",
      },
      {
        heading: "Vos droits",
        body: "Conformément à la législation en vigueur, vous disposez d'un droit d'accès, de rectification et de suppression de vos données. Pour exercer ces droits, contactez-nous à : {email}",
      },
    ],
  },

  remboursement: {
    title: "Politique de remboursement",
    intro:
      "Dernière mise à jour : 24 août 2026. Votre satisfaction est notre priorité. Nous acceptons les retours sous certaines conditions afin de vous garantir une expérience d'achat en toute confiance.",
    sections: [
      {
        heading: "Conditions de retour",
        body: "Un retour peut être effectué dans un délai de 14 jours suivant la réception de votre commande, sous réserve du respect des conditions suivantes :",
        items: [
          "Le produit doit être non ouvert et dans son emballage d'origine intact",
          "Le produit ne doit présenter aucun signe de détérioration ou d'endommagement",
          "Le bon de commande ou la preuve d'achat doit être joint au retour",
        ],
        note: "Pour des raisons d'hygiène, les produits de soin et les parfums ouverts ou utilisés ne peuvent pas être repris ni remboursés, conformément à la réglementation en vigueur.",
      },
      {
        heading: "Frais de retour",
        body: "Les frais de retour sont à la charge du client, sauf en cas d'erreur de notre part (produit incorrect ou défectueux). Dans ce cas, Bufanda prend en charge l'intégralité des frais de renvoi.",
      },
    ],
  },
};

const getPageIcon = (slug: string) => {
  switch (slug) {
    case "confidentialite":
      return ShieldCheck;
    case "livraison":
      return Truck;
    case "remboursement":
      return RefreshCcw;
    case "cgv":
    case "cgu":
      return Scale;
    case "mentions-legales":
      return FileText;
    default:
      return FileText;
  }
};

export const Route = createFileRoute("/pages/$slug")({
  loader: ({ params }) => {
    const page = pages[params.slug];

    if (!page) {
      throw notFound();
    }

    return {
      title: page.title,
      intro: page.intro,
    };
  },

  head: ({ loaderData }) => {
    if (!loaderData) {
      return {
        meta: [
          { title: "Page introuvable : Bufanda" },
          { name: "robots", content: "noindex" },
        ],
      };
    }

    const title = `${loaderData.title} : Bufanda`;

    return {
      meta: [
        { title },
        {
          name: "description",
          content: loaderData.intro,
        },
        { property: "og:title", content: title },
        {
          property: "og:description",
          content: loaderData.intro,
        },
      ],
    };
  },

  component: StaticPage,
});

function StaticPage() {
  const { slug } = Route.useParams();
  const page = pages[slug];

  const { settings } = useSiteSettings();
  const contactEmail = settings?.email?.trim() || "contact@Bufanda.tn";

  const PageIcon = getPageIcon(slug);

  const formatText = (text: string) =>
    text.replaceAll("{email}", contactEmail);

  return (
    <StoreLayout>
      <main className="min-h-screen bg-background">
        {/* Hero */}
        <section className="relative isolate overflow-hidden border-b border-border bg-gradient-to-br from-accent/10 via-background to-background">
          <div className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-accent/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-32 -left-20 h-72 w-72 rounded-full bg-primary/5 blur-3xl" />

          <div className="container-page relative py-10 sm:py-14">
            <div className="mx-auto max-w-4xl">
              <div className="mb-5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span>Accueil</span>
                <ChevronRight className="h-3.5 w-3.5" />
                <span>Informations</span>
                <ChevronRight className="h-3.5 w-3.5" />
                <span className="font-medium text-foreground">
                  {page.title}
                </span>
              </div>

              <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-accent/20 bg-accent/10 text-accent-strong shadow-sm">
                  <PageIcon className="h-8 w-8" />
                </div>

                <div className="min-w-0">
                  <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-accent/20 bg-accent/10 px-3 py-1 text-xs font-semibold text-accent-strong">
                    <FileText className="h-3.5 w-3.5" />
                    Informations & réglementation
                  </div>

                  <h1 className="page-title text-2xl font-extrabold tracking-tight sm:text-3xl lg:text-4xl">
                    {page.title}
                  </h1>

                  <p className="mt-3 max-w-3xl text-sm leading-7 text-muted-foreground sm:text-base">
                    {page.intro}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Content */}
        <section className="container-page py-8 sm:py-12">
          <div className="mx-auto grid max-w-5xl gap-8 lg:grid-cols-[minmax(0,1fr)_260px] lg:items-start">
            {/* Main article */}
            <article className="min-w-0 rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-8">
              <div className="mb-7 flex items-center justify-between gap-3 border-b border-border pb-5">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-accent-strong">
                    Document officiel
                  </p>
                  <h2 className="mt-1 text-lg font-bold">
                    Informations détaillées
                  </h2>
                </div>

                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                  <PageIcon className="h-5 w-5" />
                </div>
              </div>

              <div className="space-y-8">
                {page.sections.map((section, index) => (
                  <section
                    key={section.heading}
                    className="relative scroll-mt-24"
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-sm font-bold text-accent-strong">
                        {String(index + 1).padStart(2, "0")}
                      </div>

                      <div className="min-w-0 flex-1">
                        <h3 className="text-base font-bold leading-7 sm:text-lg">
                          {section.heading}
                        </h3>

                        {section.body && (
                          <p className="mt-3 whitespace-pre-line text-sm leading-7 text-muted-foreground">
                            {formatText(section.body)}
                          </p>
                        )}

                        {section.items && section.items.length > 0 && (
                          <ul className="mt-4 space-y-3">
                            {section.items.map((item) => (
                              <li
                                key={item}
                                className="flex items-start gap-3 rounded-xl bg-muted/40 px-4 py-3 text-sm leading-6 text-muted-foreground"
                              >
                                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent-strong" />
                                <span>{formatText(item)}</span>
                              </li>
                            ))}
                          </ul>
                        )}

                        {section.note && (
                          <div className="mt-4 rounded-xl border border-accent/20 bg-accent/5 p-4">
                            <div className="flex items-start gap-3">
                              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-accent-strong" />
                              <p className="text-sm leading-7 text-muted-foreground">
                                {formatText(section.note)}
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </section>
                ))}
              </div>
            </article>

            {/* Side information */}
            <aside className="space-y-4 lg:sticky lg:top-24">
              <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-accent/10 text-accent-strong">
                  <ShieldCheck className="h-5 w-5" />
                </div>

                <h3 className="font-bold">
                  Votre confiance, notre priorité
                </h3>

                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Consultez nos informations pour mieux comprendre les
                  conditions de nos services et vos droits.
                </p>
              </div>

              <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-accent/10 text-accent-strong">
                  <Mail className="h-5 w-5" />
                </div>

                <h3 className="font-bold">Une question ?</h3>

                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Notre équipe reste disponible pour toute demande
                  d'information concernant ce document.
                </p>

                <a
                  href={`mailto:${contactEmail}`}
                  className="mt-4 inline-flex max-w-full items-center gap-2 break-all text-sm font-semibold text-accent-strong transition-colors hover:underline"
                >
                  <Mail className="h-4 w-4 shrink-0" />
                  {contactEmail}
                </a>
              </div>

              <div className="flex items-start gap-3 rounded-2xl border border-border bg-muted/30 p-4">
                <CalendarDays className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
                <div>
                  <p className="text-sm font-semibold">
                    Informations importantes
                  </p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    Les conditions présentées sur cette page sont celles
                    actuellement publiées sur le site.
                  </p>
                </div>
              </div>
            </aside>
          </div>
        </section>
      </main>
    </StoreLayout>
  );
}