import Link from "next/link";
import { auth } from "@clerk/nextjs/server";

export default async function RequestAccessPage() {
  const { userId } = await auth();
  const isSignedIn = !!userId;

  return (
    <div className="w-full max-w-md rounded-lg border bg-card p-6 text-center shadow-sm">
      <h1 className="text-lg font-semibold text-foreground">
        Tilgang på invitasjon
      </h1>
      {isSignedIn ? (
        <>
          <p className="mt-2 text-sm text-muted-foreground">
            Du er innlogget, men har ikke tilgang til Revizo ennå. Ta kontakt for
            å få tilgang, eller logg ut og prøv med en invitert konto.
          </p>
          <div className="mt-6 flex flex-col gap-2">
            <Link
              href="/sign-out"
              className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Logg ut
            </Link>
            <a
              href="mailto:hei@revizo.ai"
              className="text-sm text-muted-foreground underline hover:text-foreground"
            >
              Be om tilgang →
            </a>
          </div>
        </>
      ) : (
        <>
          <p className="mt-2 text-sm text-muted-foreground">
            Revizo er for tiden kun tilgjengelig for inviterte brukere. Har du
            allerede konto, logg inn under. Ønsker du tilgang, ta kontakt med oss.
          </p>
          <div className="mt-6 flex flex-col gap-2">
            <Link
              href="/sign-in"
              className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Logg inn
            </Link>
            <a
              href="mailto:hei@revizo.ai"
              className="text-sm text-muted-foreground underline hover:text-foreground"
            >
              Be om tilgang →
            </a>
          </div>
        </>
      )}
    </div>
  );
}
