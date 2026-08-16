import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { Section } from "@/components/ui/Section";
import { StoreLogo } from "@/components/coupon/StoreLogo";

type CtaBandProps = {
  brandName: string;
  logoUrl: string | null;
  visitUrl: string;
  closingLine?: string;
};

export function CtaBand({
  brandName,
  logoUrl,
  visitUrl,
  closingLine,
}: CtaBandProps) {
  return (
    <Section tone="pine" padding="tight">
      <Container className="flex flex-col items-center text-center">
        <StoreLogo name={brandName} logoUrl={logoUrl} size="lg" />
        {closingLine && (
          <p className="mt-4 max-w-md text-base text-mint/85">
            {closingLine}
          </p>
        )}
        <a
          href={visitUrl}
          target="_blank"
          rel="sponsored noopener"
          className="btn-gloss btn-primary press-down mt-5 inline-flex h-12 items-center gap-2 rounded-[var(--radius-btn)] px-6 text-sm font-semibold"
        >
          Go to {brandName}
          <ExternalLink className="h-4 w-4" aria-hidden="true" />
        </a>
        <p className="mt-6 max-w-lg text-xs leading-relaxed text-mint/50">
          DaddyPromoos is an independent publisher. {brandName} and related marks
          belong to their respective owners. We may earn a commission when you
          use links on this page; this never affects our coverage.{" "}
          <Link
            href="/disclosure"
            className="underline hover:text-mint/70"
          >
            Learn more
          </Link>
          .
        </p>
      </Container>
    </Section>
  );
}
