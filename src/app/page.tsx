import { SiteHeader } from '@/components/marketing/site-header';
import { SiteFooter } from '@/components/marketing/site-footer';
import { Hero } from '@/components/marketing/hero';
import { HowItWorks } from '@/components/marketing/how-it-works';
import { EquityUnderwater } from '@/components/marketing/equity-underwater';
import { BeforeAfter, Features } from '@/components/marketing/sections';
import { VsSpreadsheet } from '@/components/marketing/vs-spreadsheet';
import { Pricing } from '@/components/marketing/pricing';
import { Faq } from '@/components/marketing/faq';
import { FinalCta } from '@/components/marketing/final-cta';
import { Newsletter } from '@/components/marketing/newsletter';
import { StickyCta } from '@/components/marketing/sticky-cta';

/**
 * Section order is the argument, in sequence:
 *   what it is → how little work it is → why it matters → what it does →
 *   why not a spreadsheet → what it costs → objections → ask.
 * The proof table sits in the hero rather than halfway down, because it is
 * the strongest thing on the page and most visitors never reach halfway.
 */
export default function HomePage() {
  return (
    <>
      <SiteHeader />

      <main id="main">
        <Hero />
        <HowItWorks />

        <section className="mx-auto max-w-6xl px-6 py-20">
          <div className="glass rounded-2xl p-1.5">
            <div className="rounded-xl bg-surface p-5 sm:p-7">
              <div className="flex flex-wrap items-baseline justify-between gap-4">
                <div>
                  <h2 className="font-display text-lg font-semibold">
                    Most journals stop at the top chart
                  </h2>
                  <p className="mt-1 text-sm text-fg-muted">
                    The one underneath is where accounts are lost — time spent
                    below your own high-water mark.
                  </p>
                </div>
                <dl className="flex gap-6 font-mono text-sm tnum">
                  <div>
                    <dt className="text-2xs tracking-wide text-fg-subtle uppercase">
                      Max drawdown
                    </dt>
                    <dd className="mt-0.5 font-semibold text-loss">−11.4%</dd>
                  </div>
                  <div>
                    <dt className="text-2xs tracking-wide text-fg-subtle uppercase">
                      Days underwater
                    </dt>
                    <dd className="mt-0.5 font-semibold">37</dd>
                  </div>
                </dl>
              </div>

              <EquityUnderwater className="mt-6" />
            </div>
          </div>
        </section>

        <BeforeAfter />
        <Features />
        <VsSpreadsheet />
        <Pricing />
        <Faq />
        <FinalCta />
        <Newsletter />
      </main>

      <SiteFooter />
      <StickyCta />
    </>
  );
}
