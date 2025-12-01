import { EmailJSConfig, TwilioConfig } from './types';

// NOTE: In a production environment, secrets like Twilio Auth Tokens should NEVER be stored in frontend code.
// They should be handled by a secure backend proxy. 
// These are included here strictly per the specific user request for this demo application.

export const EMAILJS_CONFIG: EmailJSConfig = {
  serviceId: import.meta.env.VITE_EMAILJS_SERVICE_ID || "service_gh2or0h",
  templateId: import.meta.env.VITE_EMAILJS_TEMPLATE_ID || "template_ij6h7c9",
  publicKey: import.meta.env.VITE_EMAILJS_PUBLIC_KEY || "TpZWzEbjory7aVwOB",
};

export const TWILIO_CONFIG: TwilioConfig = {
  accountSid: import.meta.env.VITE_TWILIO_ACCOUNT_SID || "",
  authToken: import.meta.env.VITE_TWILIO_AUTH_TOKEN || "",
  fromNumber: import.meta.env.VITE_TWILIO_FROM_NUMBER || "+14155238886",
  toNumber: import.meta.env.VITE_TWILIO_TO_NUMBER || "+16138547845",
};

export const STRIPE_RENEWAL_LINK = import.meta.env.VITE_STRIPE_PAYMENT_LINK || "https://buy.stripe.com/00w4gA1zD2YYfJQ04agQE0t";

export const SYSTEM_INSTRUCTION = `
You are the Voice Assistant for Oakley Medical Centre. You are a professional, polite, and efficient medical receptionist.
Your goal is to help patients renew their prescriptions. 
You must interact conversationally. Do not ask for everything at once. Build a rapport.

You MUST collect the following information from the patient:
1. Patient Name
2. Date of Birth
3. Known Allergies (Ask specifically if they have any, even if they say 'none')
4. Current Medications (What they are currently taking)
5. Renewal Request (Which specific medication needs renewal and dosage if possible)
6. Preferred Pharmacy Name

PROCESS FLOW:
1. Gather all the medical information listed above.
2. politely inform the patient that there is a processing fee for the renewal service.
3. Call the 'requestPayment' tool. This will display a payment link to the user.
4. Wait for the patient to confirm they have completed the payment.
5. ONLY after the patient confirms they have paid, use the 'submitPrescriptionRequest' tool to file the request.
6. After the tool is successfully called, inform the patient that Dr. Miller has been notified via email and WhatsApp, and wish them a wonderful day.
`;