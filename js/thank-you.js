'use strict';

function loadFleetParlourReference() {
  const params = new URLSearchParams(window.location.search);

  const referenceElement =
    document.getElementById('referenceCode');

  const emailStatusElement =
    document.getElementById('emailStatusText');

  const referenceCode = String(
    params.get('ref') || ''
  ).trim().toUpperCase();

  const notificationSent =
    params.get('notified') === '1';

  if (referenceElement) {
    referenceElement.textContent =
      referenceCode || 'FP-RECEIVED';
  }

  if (emailStatusElement) {
    emailStatusElement.textContent =
      notificationSent
        ? 'Fleet Parlour has been notified and your enquiry is safely saved in our system.'
        : 'Your enquiry is safely saved in our system and ready for our team to review.';
  }

  console.log(
    '[Fleet Parlour] Reference displayed:',
    referenceCode || 'FP-RECEIVED'
  );
}

if (document.readyState === 'loading') {
  document.addEventListener(
    'DOMContentLoaded',
    loadFleetParlourReference
  );
} else {
  loadFleetParlourReference();
}

window.addEventListener(
  'pageshow',
  loadFleetParlourReference
);