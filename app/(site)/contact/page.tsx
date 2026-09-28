import type { Metadata } from "next";
import {
  Mail,
  MessageSquareWarning,
  Handshake,
  Clock,
  Newspaper,
} from "lucide-react";
import { Container } from "@/components/ui/Container";
import { Section } from "@/components/ui/Section";
import { ContactForm } from "@/components/marketing/ContactForm";
import { PageHeader } from "@/components/marketing/PageHeader";

const CONTACT_EMAIL = "info@daddypromoos.com";

export const metadata: Metadata = {
  title: "Contact",
  description:
    "Questions, corrections, or partnership inquiries. Reach the DaddyPromoos team at info@daddypromoos.com. We read everything.",
  alternates: { canonical: "/contact" },
};

const reasons = [
  {
    icon: MessageSquareWarning,
    title: "Report something out of date",
    body: "Spotted a price, plan, or offer that has changed? Tell us which page and we will check it against the vendor's own site.",
  },
  {
    icon: Newspaper,
    title: "Suggest a tool to review",
    body: "There is a product you want scored honestly? Send it over. Reader requests shape a lot of our coverage.",
  },
  {
    icon: Handshake,
    title: "Partnerships",
    body: "Affiliate, listing, or editorial partnership questions are welcome. Note that no arrangement ever buys a rating.",
  },
];

export default function ContactPage() {
  return (
    <>
      <PageHeader
        title="Get in touch"
        description="Spotted something out of date, want us to cover a product, or have a partnership question? We read every message and reply within two business days."
      />
      <Section>
        <Container>
          <div className="grid gap-12 lg:grid-cols-[1fr_1.4fr] lg:gap-16">
            {/* --------------------------------------- Contact details */}
            <div>
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="group flex items-center gap-4 rounded-[var(--radius-card)] border border-line bg-mint/40 p-5 transition-colors hover:border-emerald/40"
              >
                <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-pine text-mint">
                  <Mail className="h-5 w-5" aria-hidden="true" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-ink-muted">
                    Email us directly
                  </span>
                  <span className="block truncate font-display text-base font-semibold text-pine group-hover:text-emerald-600">
                    {CONTACT_EMAIL}
                  </span>
                </span>
              </a>

              <div className="mt-4 flex items-center gap-3 rounded-[var(--radius-card)] border border-line px-5 py-4 text-sm text-ink-muted">
                <Clock className="h-4 w-4 shrink-0 text-ink-subtle" aria-hidden="true" />
                Typical reply time: within two business days.
              </div>

              <ul className="mt-8 space-y-6">
                {reasons.map((reason) => (
                  <li key={reason.title} className="flex gap-4">
                    <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-mint text-pine">
                      <reason.icon className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <div>
                      <p className="font-display font-semibold text-ink">
                        {reason.title}
                      </p>
                      <p className="mt-1 text-sm leading-relaxed text-ink-muted">
                        {reason.body}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            {/* --------------------------------------- Form */}
            <div className="rounded-[var(--radius-card)] border border-line bg-white p-6 shadow-sm sm:p-8">
              <h2 className="font-display text-xl font-bold tracking-tight text-ink">
                Send us a message
              </h2>
              <p className="mt-1.5 text-sm text-ink-muted">
                Prefer a form? Fill this in and it lands in the same inbox.
              </p>
              <div className="mt-6">
                <ContactForm />
              </div>
            </div>
          </div>
        </Container>
      </Section>
    </>
  );
}
