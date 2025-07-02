use crate::preferences::{ClientPreferences, PreferenceManager};
use crate::{tryo_result, tryo_state};
use pointercrate_core::error::CoreError;
use pointercrate_core_pages::localization::LocaleSet;
use rocket::{
    request::{FromRequest, Outcome},
    Request,
};
use unic_langid::subtags::Language;

pub struct ClientLocale(pub Language);

#[rocket::async_trait]
impl<'r> FromRequest<'r> for ClientLocale {
    type Error = CoreError;

    async fn from_request(request: &'r Request<'_>) -> Outcome<Self, Self::Error> {
        let locale_set = tryo_state!(request, LocaleSet);
        let preference_manager = tryo_state!(request, PreferenceManager);
        let preferences = ClientPreferences::from_cookies(request.cookies(), preference_manager);
        let language = tryo_result!(preferences
            .get(locale_set.cookie)
            .ok_or_else(|| CoreError::internal_server_error("locale set not registered with preference manager")));
        let language = locale_set.by_code(language);

        Outcome::Success(ClientLocale(*language))
    }
}
