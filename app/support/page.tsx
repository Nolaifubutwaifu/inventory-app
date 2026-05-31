import Link from "next/link";
import { LifeBuoy, Mail } from "lucide-react";

export const metadata = {
  title: "Support — Inventory",
  description:
    "How to use Inventory, common questions, and how to get in touch.",
};

const CONTACT_EMAIL = "support@maxumschaden.com";

export default function SupportPage() {
  return (
    <div className="mx-auto w-full max-w-2xl px-6 pb-16">
      <header
        className="flex flex-col items-center pt-10 text-center"
        style={{ paddingTop: "max(env(safe-area-inset-top), 2.5rem)" }}
      >
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-fg shadow-sm">
          <LifeBuoy className="h-7 w-7" />
        </div>
        <h1 className="mt-4 text-3xl font-bold tracking-tight">Support</h1>
        <p className="mt-1 text-sm text-muted">
          Get help with Inventory.
        </p>
      </header>

      <section className="mt-8 rounded-2xl border border-border bg-surface p-5">
        <div className="flex items-start gap-3">
          <Mail className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground">Email us</p>
            <a
              className="mt-0.5 block break-all text-sm text-primary underline"
              href={`mailto:${CONTACT_EMAIL}`}
            >
              {CONTACT_EMAIL}
            </a>
            <p className="mt-2 text-xs text-muted">
              We aim to reply within two business days.
            </p>
          </div>
        </div>
      </section>

      <FaqSection title="Getting started">
        <Faq q="How do I create my first stocktake?">
          <p>
            Tap <strong>Start a new stocktake</strong> on the Home screen. Give
            the session a name (for example, &ldquo;June 2026 closing
            count&rdquo;), confirm who is counting, and Inventory drops you
            into the count list. Tap any item to log a quantity and optionally
            a location.
          </p>
        </Faq>
        <Faq q="How do I add items to my catalog?">
          <p>
            Go to the <strong>Items</strong> tab in the bottom bar, then tap{" "}
            <strong>New item</strong>. At minimum you need a name and a SKU.
            Adding a photo, color, size, barcode, and reference photos helps a
            lot when scanning items later.
          </p>
        </Faq>
        <Faq q="How do I export the results?">
          <p>
            From the <strong>Sessions</strong> tab, open the session you
            finished and tap <strong>Export</strong>. Inventory produces an
            Excel spreadsheet listing every item with its total counted
            quantity and a per-location breakdown.
          </p>
        </Faq>
      </FaqSection>

      <FaqSection title="Scanning">
        <Faq q="What is the difference between Barcode Scan and AI Scan?">
          <p>
            <strong>Barcode Scan</strong> reads a printed barcode and looks it
            up against the &ldquo;Barcode&rdquo; field on your items. It runs
            entirely on your device. Use it whenever your items have printed
            barcodes &mdash; it is fast and exact.
          </p>
          <p className="mt-2">
            <strong>AI Scan</strong> takes a photo of the item and asks Google
            Gemini to identify which item in your catalog it most resembles,
            using the reference photos you added. Use it for items that look
            similar by eye and do not have barcodes, like bins in nearly
            identical shades of green. AI Scan only appears when the build of
            the app has been set up with a Gemini API key &mdash; see{" "}
            <Link className="text-primary underline" href="/privacy">
              the privacy policy
            </Link>{" "}
            for what gets sent.
          </p>
        </Faq>
        <Faq q="The camera will not open. What do I check?">
          <ul className="ml-5 list-disc space-y-1">
            <li>
              Open <strong>Settings &rarr; Inventory</strong> on your iPhone
              and make sure Camera access is allowed.
            </li>
            <li>
              Close other apps that might be using the camera (FaceTime,
              another scanner).
            </li>
            <li>
              If the screen stays black, fully quit Inventory and reopen it.
            </li>
          </ul>
        </Faq>
        <Faq q="Why are my AI Scan results inaccurate?">
          <p>
            AI Scan compares the photo against the reference photos you have
            added to each item. The more representative photos you add (front,
            side, top, label &mdash; four is a good target), the more reliably
            it identifies the right item. Items with no reference photos
            cannot be matched.
          </p>
        </Faq>
      </FaqSection>

      <FaqSection title="Accounts &amp; data">
        <Faq q="Where is my data stored?">
          <p>
            All of it lives on your device in a local database. The app does
            not back it up to any cloud service. If you switch phones or
            uninstall the app, your data is gone with it. See{" "}
            <Link className="text-primary underline" href="/privacy">
              the privacy policy
            </Link>{" "}
            for the details.
          </p>
        </Faq>
        <Faq q="I forgot my password.">
          <p>
            Because passwords are stored only on your device (as a hash), we
            cannot reset them remotely. If you have lost access, the safest
            option is to uninstall and reinstall the app and create a new
            account. Your previous data will be removed in the process.
          </p>
        </Faq>
        <Faq q="How do I delete my account and data?">
          <p>
            Open the <strong>Account</strong> tab in the bottom bar, scroll to
            the <strong>Danger zone</strong>, and tap{" "}
            <strong>Delete account</strong>. You will be asked to confirm twice.
            This permanently erases your account, every item, every count
            session, every saved location, and all photos from your device.
            Because nothing is held on our servers, the deletion is immediate
            and final &mdash; no separate request is needed.
          </p>
        </Faq>
      </FaqSection>

      <section className="mt-10 rounded-2xl border border-border bg-surface p-5 text-sm text-muted">
        <p>
          Still stuck? Email{" "}
          <a
            className="text-primary underline"
            href={`mailto:${CONTACT_EMAIL}`}
          >
            {CONTACT_EMAIL}
          </a>{" "}
          with a description of what happened and we will get back to you.
        </p>
      </section>
    </div>
  );
}

function FaqSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      <div className="mt-3 space-y-3">{children}</div>
    </section>
  );
}

function Faq({ q, children }: { q: string; children: React.ReactNode }) {
  return (
    <details className="group rounded-xl border border-border bg-surface p-4 open:bg-surface-2">
      <summary className="cursor-pointer list-none text-sm font-medium text-foreground">
        {q}
        <span className="float-right text-muted transition-transform group-open:rotate-45">
          +
        </span>
      </summary>
      <div className="mt-3 text-sm leading-relaxed text-muted">{children}</div>
    </details>
  );
}
