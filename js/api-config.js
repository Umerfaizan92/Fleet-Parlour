// Fleet Parlour enquiry API configuration.
// Recommended local test: run `npm start` inside /backend and open http://localhost:3000/contact.html
// Production backend target: https://api.fleetparlour.com.au
(() => {
  const host = window.location.hostname;
  const local = host === 'localhost' || host === '127.0.0.1';
  window.FLEET_PARLOUR_API_URL = local
    ? (window.location.port === '3000' ? window.location.origin : 'http://localhost:3000')
    : 'https://api.fleetparlour.com.au';
})();
