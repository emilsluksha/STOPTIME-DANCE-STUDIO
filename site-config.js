// Public settings only. Never put mail passwords or secret API keys here.
window.STOPTIME_CONFIG = Object.freeze({
  contactEmail: "stop_time@inbox.lv",
  applicationEmail: "gribudejot_stoptime@inbox.lv",
  // FormSubmit sends an activation email on the first submission.
  // The recipient must confirm it before applications can arrive.
  deliveryMode: "formsubmit",
  // Optional alternative AJAX handler; used when deliveryMode is not formsubmit.
  formEndpoint: ""
});
