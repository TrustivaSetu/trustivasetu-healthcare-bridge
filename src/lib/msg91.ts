/**
 * MSG91 Flow API for OTP delivery.
 * Required env: MSG91_AUTH_KEY, MSG91_TEMPLATE_ID
 * Optional: ENABLE_OTP_BYPASS=true (allows 123456 to bypass OTP in dev/staging)
 */
export async function sendOtpSms(
  phone: string,
  otp: string,
): Promise<{ success: boolean; error?: string }> {
  const authKey = process.env.MSG91_AUTH_KEY
  const templateId = process.env.MSG91_TEMPLATE_ID

  if (!authKey || !templateId) {
    if (process.env.NODE_ENV !== 'production' || process.env.ENABLE_OTP_BYPASS === 'true') {
      console.log(`[SMS DEV] OTP for +91${phone}: ${otp}`)
      return { success: true }
    }
    console.error('[SMS] MSG91_AUTH_KEY or MSG91_TEMPLATE_ID not configured')
    return { success: false, error: 'SMS service not configured. Please contact support.' }
  }

  try {
    const res = await fetch('https://control.msg91.com/api/v5/flow/', {
      method: 'POST',
      headers: {
        authkey: authKey,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        template_id: templateId,
        short_url: '1',
        mobiles: `91${phone}`,
        VAR1: otp,
      }),
    })

    const data = (await res.json()) as { type?: string; message?: string }
    if (data.type === 'success') return { success: true }
    console.error('[SMS] MSG91 Flow error:', data)
    return { success: false, error: data.message ?? 'OTP could not be delivered. Please try again.' }
  } catch (err) {
    console.error('[SMS] Delivery failed:', err)
    return { success: false, error: 'OTP could not be delivered. Please try again.' }
  }
}
