import nodemailer from 'nodemailer';

function configured(env) {
  return Boolean(
    env.SMTP_HOST &&
    env.SMTP_USER &&
    env.SMTP_PASS &&
    env.NOTIFY_TO
  );
}

export async function sendEnquiryNotification(env, enquiry, files = []) {
  if (!configured(env)) {
    return {
      sent: false,
      reason: 'smtp_not_configured'
    };
  }

  const transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: Number(env.SMTP_PORT || 587),
    secure: String(env.SMTP_SECURE).toLowerCase() === 'true',

    auth: {
      user: env.SMTP_USER,
      pass: env.SMTP_PASS
    },

    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 20000
  });

  // IMPORTANT:
  // This reference comes directly from server.js.
  // We do NOT generate another reference here.
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

  await transporter.sendMail({
    from: env.NOTIFY_FROM || env.SMTP_USER,

    to: env.NOTIFY_TO,

    replyTo: enquiry.email,

    subject:
      `[${referenceCode}] New Quote Enquiry — ${enquiry.full_name} — ${enquiry.service_required}`,

    text,

    attachments: files.map((file) => ({
      filename: file.originalname,
      path: file.path
    }))
  });

  return {
    sent: true,
    reference_code: referenceCode
  };
}