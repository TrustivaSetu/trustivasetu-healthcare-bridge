import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Terms & Conditions — Trustiva Setu',
  description: 'Terms and Conditions for using the Trustiva Setu loan facilitation platform.',
}

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-4xl mx-auto px-6 py-12">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Terms &amp; Conditions</h1>
          <p className="text-sm text-gray-500 mt-2">Last updated: 1 June 2026</p>
          <p className="text-sm text-gray-500">For queries: <a href="mailto:legal@trustivasetu.com" className="text-blue-600 underline">legal@trustivasetu.com</a></p>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-8">
          <p className="text-sm text-amber-800 font-medium">
            Important: Trustiva Setu is a loan facilitation platform. We are not a bank or NBFC. Loans are
            provided by our partner banks and NBFCs. Loan approval is at the sole discretion of the lender.
          </p>
        </div>

        <div className="prose prose-gray max-w-none space-y-8 text-gray-700 leading-relaxed">

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">1. Acceptance of Terms</h2>
            <p>
              By accessing or using the Trustiva Setu platform (&ldquo;Platform&rdquo;), you agree to be bound by
              these Terms &amp; Conditions (&ldquo;Terms&rdquo;). If you do not agree, you must not use the Platform.
              These Terms constitute a legally binding agreement between you and Trustiva Setu.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">2. Nature of Services</h2>
            <p>
              Trustiva Setu provides a <strong>loan facilitation service</strong>. We:
            </p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>Connect loan applicants with partner banks and NBFCs</li>
              <li>Facilitate the submission and processing of loan applications</li>
              <li>Present indicative loan offers based on preliminary eligibility assessment</li>
              <li>Assist with documentation and KYC verification</li>
            </ul>
            <p className="mt-3">
              <strong>We do not:</strong>
            </p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>Lend money directly to applicants</li>
              <li>Guarantee loan approval</li>
              <li>Set interest rates or loan terms (these are determined by the lender)</li>
              <li>Act as a financial advisor</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">3. Loan Facilitation Terms</h2>
            <p>
              All loan products facilitated through this Platform are subject to:
            </p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>Approval at the sole discretion of the partner lender</li>
              <li>The lender&apos;s terms and conditions, interest rates, fees, and credit policies</li>
              <li>Successful completion of KYC verification and document submission</li>
              <li>The lender&apos;s credit assessment of the applicant</li>
            </ul>
            <p className="mt-3">
              Interest rates, processing fees, EMI amounts, and repayment terms displayed on this Platform
              are <strong>indicative only</strong> and may differ from the final terms offered by the lender.
              The lender&apos;s final sanction letter constitutes the binding loan agreement.
            </p>
            <p className="mt-3">
              Where a &ldquo;0% interest&rdquo; or &ldquo;No Cost EMI&rdquo; product is shown, this is subject to a subvention
              arrangement between the partner clinic and the lender. Terms and conditions of the subvention
              arrangement apply. The interest cost is borne by the clinic, not the patient, under this model.
              Eligibility for such schemes is determined by the lender.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">4. User Responsibilities</h2>
            <p>You agree to:</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>Provide accurate, complete, and truthful information in all applications and forms</li>
              <li>Maintain the confidentiality of your account credentials</li>
              <li>Not submit fraudulent or misleading information</li>
              <li>Not use the Platform for any unlawful purpose</li>
              <li>Notify us immediately of any unauthorised access to your account</li>
              <li>Comply with all applicable laws and regulations</li>
            </ul>
            <p className="mt-3">
              Providing false or fraudulent information may result in immediate termination of your
              application and may be reported to relevant authorities as required by law.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">5. Eligibility</h2>
            <p>
              To use this Platform, you must be at least 18 years of age, a resident of India, and legally
              competent to enter into contracts. Use by individuals below 18 years of age is strictly
              prohibited.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">6. Intellectual Property</h2>
            <p>
              All content on the Platform, including text, graphics, logos, and software, is the property of
              Trustiva Setu or its licensors and is protected by applicable intellectual property laws. You
              may not reproduce, distribute, or create derivative works without our explicit written consent.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">7. Limitation of Liability</h2>
            <p>
              To the fullest extent permitted by applicable law, Trustiva Setu shall not be liable for:
            </p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>Any decision made by a partner lender to approve or reject a loan application</li>
              <li>Delays in loan processing attributable to lender procedures or regulatory requirements</li>
              <li>Any direct, indirect, incidental, or consequential damages arising from use of the Platform</li>
              <li>Any inaccuracy in indicative loan terms displayed prior to formal lender sanction</li>
              <li>Interruptions to the Platform due to technical issues, maintenance, or force majeure events</li>
            </ul>
            <p className="mt-3">
              Our maximum aggregate liability to you for any claim shall not exceed the facilitation fee, if
              any, paid by you to us in connection with the specific transaction giving rise to the claim.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">8. Disclaimer of Warranties</h2>
            <p>
              The Platform is provided on an &ldquo;as is&rdquo; and &ldquo;as available&rdquo; basis without warranties of any
              kind, either express or implied. We do not warrant that the Platform will be uninterrupted,
              error-free, or free of viruses or other harmful components.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">9. Data Privacy</h2>
            <p>
              Your use of the Platform is also governed by our{' '}
              <a href="/privacy-policy" className="text-blue-600 underline">Privacy Policy</a>, which is
              incorporated into these Terms by reference. By using the Platform, you consent to the
              collection and use of your data as described in the Privacy Policy.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">10. Third-Party Links</h2>
            <p>
              The Platform may contain links to third-party websites. We are not responsible for the content,
              privacy practices, or terms of any third-party sites. Access to such sites is at your own risk.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">11. Modifications</h2>
            <p>
              We reserve the right to modify these Terms at any time. Material changes will be communicated
              with reasonable notice. Continued use of the Platform after the effective date of changes
              constitutes your acceptance of the updated Terms.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">12. Termination</h2>
            <p>
              We may suspend or terminate your access to the Platform at any time for violation of these
              Terms, provision of fraudulent information, or for any other reason at our discretion, with or
              without notice.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">13. Governing Law and Jurisdiction</h2>
            <p>
              These Terms are governed by the laws of India. Any disputes arising from or relating to these
              Terms shall be subject to the exclusive jurisdiction of the courts of New Delhi, India. You
              agree to first attempt resolution through good-faith negotiation before initiating any legal
              proceedings.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">14. Grievance Redressal</h2>
            <p>
              For any complaints or grievances relating to the Platform or these Terms, you may contact our
              Grievance Officer (appointed under the IT Act, 2000 and DPDP Act, 2023):
            </p>
            <p className="mt-2">
              <strong>Name:</strong> Abhishek Kashyap<br />
              <strong>Designation:</strong> Founder &amp; CEO, Aarthsetu Technologies Pvt Ltd<br />
              <strong>Email:</strong> <a href="mailto:legal@trustivasetu.com" className="text-blue-600 underline">legal@trustivasetu.com</a><br />
              <strong>Phone:</strong> <a href="tel:+918218473534" className="text-blue-600 underline">+91 82184 73534</a>
            </p>
            <p className="mt-2">We aim to respond to all grievances within 30 days of receipt.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">15. Entire Agreement</h2>
            <p>
              These Terms, together with the Privacy Policy and any other legal notices published on the
              Platform, constitute the entire agreement between you and Trustiva Setu relating to your use
              of the Platform.
            </p>
          </section>

        </div>

        <div className="mt-12 pt-6 border-t border-gray-200 flex flex-wrap gap-4 text-sm text-gray-500">
          <a href="/privacy-policy" className="text-blue-600 hover:underline">Privacy Policy</a>
          <a href="/disclaimer" className="text-blue-600 hover:underline">Disclaimer</a>
          <a href="mailto:legal@trustivasetu.com" className="text-blue-600 hover:underline">Contact Legal</a>
        </div>
      </div>
    </div>
  )
}
