import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Privacy Policy — Trustiva Setu',
  description: 'Privacy Policy for Trustiva Setu loan facilitation platform. Learn how we collect, use, and protect your personal data under DPDP Act 2023.',
}

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-4xl mx-auto px-6 py-12">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Privacy Policy</h1>
          <p className="text-sm text-gray-500 mt-2">Last updated: 1 June 2026</p>
          <p className="text-sm text-gray-500">For queries: <a href="mailto:legal@trustivasetu.com" className="text-blue-600 underline">legal@trustivasetu.com</a></p>
        </div>

        <div className="prose prose-gray max-w-none space-y-8 text-gray-700 leading-relaxed">

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">1. About Us</h2>
            <p>
              Trustiva Setu (&ldquo;we&rdquo;, &ldquo;our&rdquo;, &ldquo;the Company&rdquo;) is a loan facilitation platform registered in India.
              We are <strong>not a bank or Non-Banking Financial Company (NBFC)</strong>. We facilitate loan
              applications between borrowers and our partner banks and NBFCs.
            </p>
            <p className="mt-2">
              <strong>Aarthsetu Technologies Private Limited</strong> (trading as Trustiva Setu)<br />
              5/70, Friend&apos;s Colony, Chandranagar, Moradabad, Uttar Pradesh - 244001<br />
              Website: <a href="https://www.trustivasetu.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">www.trustivasetu.com</a>
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">2. Scope of This Policy</h2>
            <p>
              This Privacy Policy applies to all personal data we collect when you use the Trustiva Setu
              platform, website, or services — including when you submit a loan application, use our partner
              portal, or contact us. It also governs data processed on behalf of healthcare clinics that are
              our registered partners.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">3. Data We Collect</h2>
            <p>We collect the following categories of personal data:</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li><strong>Identity data:</strong> Full name, date of birth, gender</li>
              <li><strong>Contact data:</strong> Mobile number, email address, residential address</li>
              <li><strong>Government identifiers:</strong> PAN card number, Aadhaar number (masked where required by law)</li>
              <li><strong>Financial data:</strong> Monthly income, employment details, bank account details (for disbursal)</li>
              <li><strong>Medical-adjacent data:</strong> Treatment category selected (e.g., dental, orthopaedic) — not detailed medical records</li>
              <li><strong>Device and usage data:</strong> IP address, browser type, pages visited, timestamps</li>
              <li><strong>Communication data:</strong> Records of OTPs sent, consent captured</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">4. How We Use Your Data</h2>
            <p>We use your personal data for the following purposes:</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>Processing and evaluating your loan application</li>
              <li>Sharing your application with partner lenders for credit evaluation and approval</li>
              <li>Verifying your identity using PAN, Aadhaar, or phone OTP</li>
              <li>Communicating loan status, EMI schedules, and related updates</li>
              <li>Complying with legal and regulatory obligations (RBI, SEBI, Income Tax Act, etc.)</li>
              <li>Fraud prevention and security monitoring</li>
              <li>Internal analytics and platform improvement</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">5. Third-Party Sharing</h2>
            <p>
              We share your personal data with the following categories of third parties, solely for the
              purpose of facilitating your loan application:
            </p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li><strong>Partner banks and NBFCs:</strong> For credit evaluation, loan approval, and disbursal</li>
              <li><strong>Credit information bureaus:</strong> As required by lender policies for credit checks</li>
              <li><strong>KYC verification providers:</strong> For PAN and Aadhaar authentication</li>
              <li><strong>Healthcare clinic partners:</strong> The clinic where you are receiving treatment and through whom the loan application was submitted</li>
              <li><strong>Technology and cloud service providers:</strong> For hosting and data storage (subject to data processing agreements)</li>
              <li><strong>Regulatory authorities:</strong> As required by law</li>
            </ul>
            <p className="mt-2">
              We do <strong>not</strong> sell your personal data to third parties for marketing purposes.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">6. Legal Basis for Processing</h2>
            <p>We process your personal data on the following legal bases under applicable Indian law:</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li><strong>Consent:</strong> You provide explicit consent when submitting a loan application</li>
              <li><strong>Contractual necessity:</strong> To fulfil our obligations in facilitating your loan</li>
              <li><strong>Legal obligation:</strong> To comply with RBI directions, Prevention of Money Laundering Act (PMLA), and other applicable regulations</li>
              <li><strong>Legitimate interests:</strong> For fraud prevention and platform security</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">7. Data Retention</h2>
            <p>
              We retain your personal data for as long as is necessary for the purposes outlined in this
              policy, and in accordance with applicable law. Loan-related records are typically retained for a
              minimum of 8 years as required by the Prevention of Money Laundering Act, 2002. You may
              request deletion of your data subject to these legal obligations.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">8. Your Rights (DPDP Act 2023)</h2>
            <p>
              Under the Digital Personal Data Protection Act, 2023 (DPDP Act), you have the following rights:
            </p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li><strong>Right to access:</strong> Request a summary of personal data we hold about you</li>
              <li><strong>Right to correction:</strong> Request correction of inaccurate or incomplete data</li>
              <li><strong>Right to erasure:</strong> Request deletion of your personal data (subject to legal retention obligations)</li>
              <li><strong>Right to grievance redressal:</strong> Lodge a complaint with our Grievance Officer</li>
              <li><strong>Right to nominate:</strong> Nominate another individual to exercise rights on your behalf in the event of death or incapacity</li>
            </ul>
            <p className="mt-2">
              To exercise your rights, contact us at:{' '}
              <a href="mailto:legal@trustivasetu.com" className="text-blue-600 underline">legal@trustivasetu.com</a>
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">9. Cookie Policy</h2>
            <p>
              We use cookies and similar tracking technologies to maintain session security and improve user
              experience. We do not use third-party advertising cookies. You may decline non-essential cookies
              using the consent banner displayed on your first visit. Essential cookies required for
              authentication cannot be disabled.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">10. Security</h2>
            <p>
              We implement industry-standard technical and organisational measures to protect your personal
              data, including encrypted transmission (HTTPS/TLS), access controls, audit logging, and
              periodic security reviews. No system is completely secure; we cannot guarantee absolute
              security of data transmitted over the internet.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">11. Children&apos;s Privacy</h2>
            <p>
              Our platform is not directed at individuals under the age of 18. We do not knowingly collect
              personal data from minors. If you believe we have inadvertently collected such data, please
              contact us immediately.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">12. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. Material changes will be communicated via
              email or a prominent notice on our platform. Continued use of the platform after changes
              constitutes acceptance of the updated policy.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">13. Grievance Officer</h2>
            <p>
              In accordance with the DPDP Act, 2023 and IT Act, 2000, the details of our Grievance Officer are:
            </p>
            <p className="mt-2">
              <strong>Name:</strong> Abhishek Kashyap<br />
              <strong>Designation:</strong> Founder &amp; CEO, Aarthsetu Technologies Pvt Ltd<br />
              <strong>Email:</strong> <a href="mailto:legal@trustivasetu.com" className="text-blue-600 underline">legal@trustivasetu.com</a><br />
              <strong>Phone:</strong> <a href="tel:+918218473534" className="text-blue-600 underline">+91 82184 73534</a>
            </p>
            <p className="mt-2">Response time: Within 30 days of receipt of complaint</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">14. Governing Law</h2>
            <p>
              This Privacy Policy is governed by the laws of India. Any disputes shall be subject to the
              exclusive jurisdiction of courts in New Delhi, India.
            </p>
          </section>

        </div>

        <div className="mt-12 pt-6 border-t border-gray-200 flex flex-wrap gap-4 text-sm text-gray-500">
          <a href="/terms" className="text-blue-600 hover:underline">Terms &amp; Conditions</a>
          <a href="/disclaimer" className="text-blue-600 hover:underline">Disclaimer</a>
          <a href="mailto:legal@trustivasetu.com" className="text-blue-600 hover:underline">Contact Legal</a>
        </div>
      </div>
    </div>
  )
}
