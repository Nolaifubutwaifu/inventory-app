import Link from "next/link";
import { Shield } from "lucide-react";

export const metadata = {
  title: "Privacy Policy — Inventory",
  description:
    "How Inventory handles your data: local-first storage, optional AI scan, no tracking.",
};

const EFFECTIVE_DATE = "May 31, 2026";

const CONTACT_EMAIL = "support@maxumschaden.com";

export default function PrivacyPage() {
  return (
    <div className="mx-auto w-full max-w-2xl px-6 pb-16">
      <header
        className="flex flex-col items-center pt-10 text-center"
        style={{ paddingTop: "max(env(safe-area-inset-top), 2.5rem)" }}
      >
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-fg shadow-sm">
          <Shield className="h-7 w-7" />
        </div>
        <h1 className="mt-4 text-3xl font-bold tracking-tight">Privacy Policy</h1>
        <p className="mt-1 text-sm text-muted">
          Effective {EFFECTIVE_DATE}
        </p>
      </header>

      <section className="mt-8 rounded-2xl border border-border bg-surface p-5 text-sm leading-relaxed">
        <p className="font-medium text-foreground">In one paragraph:</p>
        <p className="mt-2 text-muted">
          Inventory stores your catalog, stocktakes, and account info on your
          device only. The app never uploads any of it to our servers. The
          optional AI Scan feature is the one exception: when you tap it, the
          photo and the name/SKU/category of items in your catalog are sent
          through our server to Google Gemini so it can identify the item. We
          do not run analytics, do not show ads, and do not track you across
          apps or websites.
        </p>
      </section>

      <Section title="What we store on your device">
        <p>
          Everything you do in Inventory is saved in your device&rsquo;s local
          browser database (IndexedDB) inside the app sandbox. That includes:
        </p>
        <ul className="ml-5 mt-2 list-disc space-y-1">
          <li>Your business name, contact name, and email address</li>
          <li>A hashed copy of your password (PBKDF2 with a per-account salt)</li>
          <li>Your item catalog (names, SKUs, categories, colors, sizes, notes, barcodes, photos, and reference photos)</li>
          <li>Your stocktake sessions and the individual count entries inside them</li>
          <li>Your saved location templates</li>
        </ul>
        <p className="mt-3">
          None of this leaves the device automatically. If you uninstall the app
          or clear its data, the information is permanently deleted. We do not
          keep a copy.
        </p>
      </Section>

      <Section title="What we send off the device">
        <p>
          The only feature that transmits data off your device is{" "}
          <strong>AI Scan</strong>. When you tap the camera button on the count
          screen and choose &ldquo;AI scan&rdquo;, the following is sent through
          our server to{" "}
          <a
            className="text-primary underline"
            href="https://ai.google.dev/gemini-api/terms"
            target="_blank"
            rel="noreferrer"
          >
            Google Gemini
          </a>{" "}
          for image recognition:
        </p>
        <ul className="ml-5 mt-2 list-disc space-y-1">
          <li>The photo you just captured</li>
          <li>For each item in your catalog: its id, name, SKU, color, size, category, and up to two of its reference photos</li>
        </ul>
        <p className="mt-3">
          We do <strong>not</strong> send your email, password, business name,
          stocktake totals, count entries, or location data with the AI Scan
          request.
        </p>
        <p className="mt-3">
          AI Scan is an optional feature. If your build of the app does not
          have a Gemini API key configured on the backing server, the AI Scan
          button is hidden and no data is ever sent to Google. The Barcode Scan
          button decodes barcodes entirely on your device and never makes a
          network request.
        </p>
      </Section>

      <Section title="Google Gemini free-tier disclosure">
        <p>
          If the operator of your build is using Google&rsquo;s free Gemini API
          tier, Google may use the data sent in each AI Scan request (the
          photo and the item metadata listed above) to improve their AI models,
          as described in the{" "}
          <a
            className="text-primary underline"
            href="https://ai.google.dev/gemini-api/terms"
            target="_blank"
            rel="noreferrer"
          >
            Gemini API Terms of Service
          </a>
          . The paid tier of the Gemini API does not use submitted data for
          model improvement. If this matters to your business, ask whoever
          provisioned your build which tier they are using.
        </p>
      </Section>

      <Section title="What we do not do">
        <ul className="ml-5 list-disc space-y-1">
          <li>We do not run analytics or crash reporting in the app</li>
          <li>We do not show advertising</li>
          <li>We do not track you across other apps or websites</li>
          <li>We do not sell or share your data with any third party other than the AI Scan path described above</li>
          <li>We do not use cookies or similar tracking identifiers</li>
        </ul>
      </Section>

      <Section title="Permissions the app asks for">
        <ul className="ml-5 list-disc space-y-1">
          <li>
            <strong>Camera</strong> &mdash; used to scan barcodes and, if AI
            Scan is enabled, to capture the photo sent to Google Gemini. The
            camera is never used in the background.
          </li>
          <li>
            <strong>Photo Library</strong> &mdash; used only when you tap
            &ldquo;Add photo&rdquo; or add a reference photo to an item. The
            app does not read or upload the rest of your photo library.
          </li>
        </ul>
      </Section>

      <Section title="Deleting your data">
        <p>
          You can delete your account and all associated catalog, session, and
          count data from inside the app under Account &rarr; Sign out, or by
          uninstalling the app from your device. Because we do not keep a copy
          on our servers, that deletion is final and immediate. There is no
          separate request to make.
        </p>
      </Section>

      <Section title="Children">
        <p>
          Inventory is a tool for warehouse and small-business stocktaking. It
          is not directed at children under 13, and we do not knowingly collect
          information from anyone under 13.
        </p>
      </Section>

      <Section title="Changes to this policy">
        <p>
          If we make material changes to this policy we will update the
          effective date at the top of this page and, if the change affects how
          your data is handled, surface a notice inside the app on next launch.
        </p>
      </Section>

      <Section title="Contact">
        <p>
          Questions about this policy or about your data? Email{" "}
          <a
            className="text-primary underline"
            href={`mailto:${CONTACT_EMAIL}`}
          >
            {CONTACT_EMAIL}
          </a>
          .
        </p>
        <p className="mt-3">
          For help using the app, see the{" "}
          <Link className="text-primary underline" href="/support">
            support page
          </Link>
          .
        </p>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      <div className="mt-2 text-sm leading-relaxed text-muted">{children}</div>
    </section>
  );
}
