import fs from 'fs/promises';
import { Resend } from 'resend';

function configured(env) {
  return Boolean(
    env.RESEND_API_KEY &&
    env.NOTIFY_TO
  );
}

export async function sendEnquiryNotification(env, enquiry, files = []) {
  if (!configured(env)) {
    return {
      sent: false,
      reason: 'resend_not_configured'
    };
  }

  const resend = new Resend(env.RESEND_API_KEY);

  // IMPORTANT:
  // This reference comes directly from server.js.
  // We do NOT generate a different reference here.
  const referenceCode =
    enquiry.reference_code ||
    `FP-${String(enquiry.id)
      .replaceAll('-', '')
      .slice(0, 8)
      .toUpperCase()}`;

  const text = [
    'NEW FLEET PARLOUR QUOTE ENQUIRY',
    '================================',
    '',
    `Reference Number: ${referenceCode}`,
    '',
    'CUSTOMER DETAILS',
    '----------------',
    `Name: ${enquiry.full_name}`,
    `Phone: ${enquiry.phone}`,
    `Email: ${enquiry.email}`,
    '',
    'LOCATION',
    '--------',
    `Suburb/Postcode: ${enquiry.suburb_postcode}`,
    `Job Address: ${enquiry.service_address || '-'}`,
    '',
    'VEHICLE / JOB DETAILS',
    '---------------------',
    `Vehicle/Job Type: ${enquiry.vehicle_type}`,
    `Make/Model: ${enquiry.make_model || '-'}`,
    `Registration: ${enquiry.registration || '-'}`,
    '',
    'SERVICE DETAILS',
    '---------------',
    `Service Required: ${enquiry.service_required}`,
    `Parts to Polish: ${enquiry.parts_to_polish}`,
    `Condition: ${enquiry.condition}`,
    `Preferred Date: ${enquiry.preferred_date || '-'}`,
    '',
    'SITE INFORMATION',
    '----------------',
    `Power Available: ${enquiry.power_available}`,
    `Covered Work Area: ${enquiry.covered_work_area || '-'}`,
    '',
    'JOB DETAILS',
    '-----------',
    enquiry.job_details || '-',
    '',
    '================================',
    `Fleet Parlour Enquiry Reference: ${referenceCode}`,
    '',
    `Internal ID: ${enquiry.id}`
  ].join('\n');

  // Convert uploaded photos/files to a format Resend can send.
  const attachments = await Promise.all(
    files.map(async (file) => ({
      filename: file.originalname,
      content: await fs.readFile(file.path)
    }))
  );

  const { data, error } = await resend.emails.send({
    from:
      env.NOTIFY_FROM ||
      'Fleet Parlour Website <quotes@fleetparlour.com.au>',

    to: [env.NOTIFY_TO],

    // When you click Reply, it replies directly to the customer.
    replyTo: enquiry.email,

    subject:
      `[${referenceCode}] New Quote Enquiry — ${enquiry.full_name} — ${enquiry.service_required}`,

    text,

    attachments
  });

  if (error) {
    throw new Error(
      `Resend email failed: ${error.message || JSON.stringify(error)}`
    );
  }

  return {
    sent: true,
    reference_code: referenceCode,
    email_id: data?.id || null
  };
}