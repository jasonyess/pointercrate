use crate::navigation::TopLevelNavigationBarItem;
use maud::{html, Markup};
use unic_langid::subtags::{Language, Region};
use unic_langid::LanguageIdentifier;

/// Represents a collection of [`Locale`] objects associated with a specific
/// URI in the [`LocalizationConfiguration`].
#[derive(Clone)]
pub struct LocaleSet {
    /// The preference cookie for this [`LocaleSet`] (`preference-{cookie}`)
    pub cookie: &'static str,

    pub locales: Vec<LanguageIdentifier>,

    /// Used to gracefully handle attempts at retrieving nonexistant locales
    pub fallback: Language,
}

impl LocaleSet {
    /// Initialize a new [`LocaleSet`] with a `cookie`, which represents the
    /// cookie name the client will send their selected language with.
    ///
    /// The cookie will automatically be prefixed with `preference-`, so passing
    /// `guidelines-locale` as the cookie would result in the backend actually
    /// handling `preference-guidelines-locale`, even though this [`LocaleSet`]'s
    /// `cookie` value would remain unchanged.
    ///
    /// `fallback_lang` specifies the fallback [`Locale`] for this [`LocaleSet`].
    /// This is used to gracefully handle attempts at retrieving an unsupported language.
    pub fn new(cookie: &'static str, fallback_lang: Language) -> Self {
        LocaleSet {
            cookie,
            locales: Vec::new(),
            fallback: fallback_lang,
        }
    }

    /// Append a new [`Locale`] to this [`LocaleSet`].
    pub fn with_locale(mut self, lang: LanguageIdentifier) -> Self {
        log::info!("Registered Language {} (region {:?})", lang.language, lang.region);
        self.locales.push(lang);
        self.locales.sort(); // ensure set is sorted alphabetically

        self
    }

    /// Returns an owned [`Locale`] whose `iso_code` matches the given `code`.
    /// If one is not found, the fallback [`Locale`] will be returned.
    pub fn by_code(&self, language: &str) -> &Language {
        self.locales
            .iter()
            .find(|lang_id| lang_id.language.as_str().eq_ignore_ascii_case(language))
            .map(|lang_id| &lang_id.language)
            .unwrap_or(&self.fallback)
    }

    fn flag_for_language(&self, language: &Language) -> Markup {
        let region = self
            .locales
            .iter()
            .find(|lang_id| &lang_id.language == language)
            .and_then(|lang_id| lang_id.region);

        flag(region)
    }
}

fn flag(region: Option<Region>) -> Markup {
    html! [
        @if let Some(region) = region {
            span.flag-icon style = (format!(r#"background-image: url("/static/demonlist/images/flags/{}.svg");"#, region.as_str().to_ascii_lowercase())) {}
        }
    ]
}

pub fn locale_selection_dropdown(active_locale: &Language, locale_set: &LocaleSet) -> Option<TopLevelNavigationBarItem> {
    if locale_set.locales.len() < 2 {
        return None;
    }

    let mut dropdown = TopLevelNavigationBarItem::new(
        Some("language-selector"),
        None,
        html! {
            span.flex data-cookie = (locale_set.cookie) {
                (locale_set.flag_for_language(active_locale))
                span #active-language style = "margin-left: 8px" { (active_locale.as_str().to_uppercase()) }
            }
        },
    );

    for locale in &locale_set.locales {
        if &locale.language == active_locale {
            // this locale is currently selected, don't add it to the dropdown
            continue;
        }

        dropdown = dropdown.with_sub_item(
            None,
            html! {
                span data-flag = (locale.language) data-lang = (locale.language) {
                    (flag(locale.region))
                    span style = "margin-left: 10px" { (locale.language.as_str().to_uppercase()) }
                }
            },
        );
    }

    Some(dropdown)
}
