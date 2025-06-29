import {
  Form,
  valueMissing,
  tooShort,
  post,
} from "/static/core/js/modules/form.js";
import { tr } from "/static/core/js/modules/localization.js";
import { TabbedPane } from "/static/core/js/modules/tab.js";

function initializeLoginForm() {
  var loginForm = new Form(document.getElementById("login-form"));

  var loginUsername = loginForm.input("login-username");
  var loginPassword = loginForm.input("login-password");

  loginUsername.addValidator(valueMissing, tr("user", "user", "auth-username.validator-valuemissing"));
  loginUsername.addValidator(
    tooShort,
    tr("user", "user", "auth-username.validator-tooshort")
  );

  loginPassword.clearOnInvalid = true;
  loginPassword.addValidator(valueMissing, tr("user", "user", "auth-password.validator-valuemissing"));
  loginPassword.addValidator(
    tooShort,
    tr("user", "user", "auth-password.validator-tooshort")
  );

  loginForm.onSubmit(function (event) {
    post("/login/", {
      Authorization:
        "Basic " + btoa(loginUsername.value + ":" + loginPassword.value),
    })
      .then((response) => {
        window.location = "/account/";
      })
      .catch((response) => {
        console.log(response);
        if (response.status === 401) {
          loginPassword.errorText = tr("user", "user", "login.error-invalidcredentials");
        } else {
          loginForm.setError(response.data.message);
        }
      });
  });
}

function intializeRegisterForm() {
  var registerForm = new Form(document.getElementById("register-form"));

  var registerUsername = registerForm.input("register-username");
  var registerPassword = registerForm.input("register-password");
  var registerPasswordRepeat = registerForm.input("register-password-repeat");

  registerUsername.addValidator(valueMissing, tr("user", "user", "auth-username.validator-valuemissing"));
  registerUsername.addValidator(
    tooShort,
    tr("user", "user", "auth-username.validator-tooshort")
  );

  registerPassword.addValidator(valueMissing, tr("user", "user", "auth-password.validator-valuemissing"));
  registerPassword.addValidator(
    tooShort,
    tr("user", "user", "auth-password.validator-tooshort")
  );

  registerPasswordRepeat.addValidator(valueMissing, tr("user", "user", "auth-password.validator-valuemissing"));
  registerPasswordRepeat.addValidator(
    tooShort,
    tr("user", "user", "auth-password.validator-valuemissing")
  );
  registerPasswordRepeat.addValidator(
    (rpp) => rpp.value == registerPassword.value,
    tr("user", "user", "auth-repeatpassword.validator-notmatching")
  );

  registerForm.onSubmit(function (event) {
    post("/register/", {}, registerForm.serialize())
      .then((response) => {
        window.location = "/account/";
      })
      .catch((response) => {
        if (response.status === 409) {
          registerUsername.errorText =
            tr("user", "user", "auth-username.error-alreadytaken");
        } else {
          registerForm.setError(response.data.message);
        }
      });
  });
}

function googleOauthCallback(response) {
  let error = document.getElementById("g-signin-error");

  post("/api/v1/auth/oauth/google", {}, response)
    .then(() => (window.location = "/account/"))
    .catch((response) => {
      error.innerText = response.data.message;
      error.style.display = "block";
    });
}

window.googleOauthCallback = googleOauthCallback;

$(window).on("load", function () {
  new TabbedPane(document.getElementById("login-tabber"), null);
  initializeLoginForm();
  intializeRegisterForm();
});
