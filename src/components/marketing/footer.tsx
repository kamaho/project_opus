import Link from "next/link";
import { RevizoLogo } from "@/components/ui/revizo-logo";

const productLinks = [
  { href: "/#funksjoner", label: "Funksjoner" },
  { href: "/priser", label: "Priser" },
  { href: "/sign-in", label: "Logg inn" },
];

const legalLinks = [
  { href: "/personvern", label: "Personvern" },
  { href: "/vilkar", label: "Bruksvilkår" },
];

export function MarketingFooter() {
  return (
    <footer className="border-t border-border/50 bg-muted/30">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="grid gap-8 sm:grid-cols-2 md:grid-cols-4">
          <div className="sm:col-span-2 md:col-span-1">
            <RevizoLogo width={100} height={25} />
            <p className="mt-3 text-sm text-muted-foreground">
              Automatisk avstemming for regnskapsbyråer.
            </p>
          </div>

          <div>
            <h3 className="text-sm font-medium text-foreground">Produkt</h3>
            <ul className="mt-3 space-y-2">
              {productLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-medium text-foreground">Juridisk</h3>
            <ul className="mt-3 space-y-2">
              {legalLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-medium text-foreground">Kontakt</h3>
            <ul className="mt-3 space-y-2">
              <li>
                <a
                  href="mailto:hei@revizo.ai"
                  className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                  hei@revizo.ai
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-10 flex flex-col items-center justify-between gap-4 border-t border-border/50 pt-6 sm:flex-row">
          <p className="text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} Save Solutions AS
            (Org.nr. 933 882 867). Alle rettigheter reservert.
          </p>
        </div>
      </div>
    </footer>
  );
}
