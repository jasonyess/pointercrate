use crate::{preferences::PreferenceManager, tryo_state};
use pointercrate_core::{error::CoreError, theme::Theme};
use rocket::{
    request::{FromRequest, Outcome},
    Request,
};

use crate::preferences::ClientPreferences;

pub const THEME_COOKIE_NAME: &'static str = "theme";

#[derive(Debug)]
pub struct ClientTheme(pub Theme);

#[rocket::async_trait]
impl<'r> FromRequest<'r> for ClientTheme {
    type Error = CoreError;

    async fn from_request(request: &'r Request<'_>) -> Outcome<Self, Self::Error> {
        let preference_manager = tryo_state!(request, PreferenceManager);
        let preferences = ClientPreferences::from_cookies(request.cookies(), preference_manager);
        let theme = Theme::from(preferences.get(THEME_COOKIE_NAME));

        Outcome::Success(ClientTheme(theme))
    }
}
