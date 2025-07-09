use crate::{
    etag::Tagged,
    preferences::{ClientPreferences, PreferenceManager},
};
use maud::{html, Render, DOCTYPE};
use pointercrate_core::{etag::Taggable, localization::LANGUAGE};
use pointercrate_core_pages::localization::LocaleSet;
use pointercrate_core_pages::{
    head::{Head, HeadLike},
    PageConfiguration, PageFragment,
};
use rocket::{
    futures,
    http::{ContentType, Header, Status},
    response::Responder,
    serde::json::Json,
    Request, Response,
};
use serde::Serialize;
use std::{borrow::Cow, io::Cursor};

pub struct Page(PageFragment);

impl Page {
    pub fn new(fragment: impl Into<PageFragment>) -> Self {
        Page(fragment.into())
    }
}

impl HeadLike for Page {
    fn head_mut(&mut self) -> &mut Head {
        self.0.head_mut()
    }
}

impl<'r, 'o: 'r> Responder<'r, 'o> for Page {
    fn respond_to(self, request: &'r Request<'_>) -> rocket::response::Result<'o> {
        let preference_manager = request.rocket().state::<PreferenceManager>().ok_or(Status::InternalServerError)?;
        let locale_set = request.rocket().state::<LocaleSet>().ok_or(Status::InternalServerError)?;

        let preferences = ClientPreferences::from_cookies(request.cookies(), preference_manager);

        let language = preferences.get(locale_set.cookie).ok_or(Status::InternalServerError)?;
        let locale = locale_set.by_code(language);

        let (page_config, nav_bar, footer) = futures::executor::block_on(async {
            LANGUAGE
                .scope(*locale, async {
                    let page_config = request
                        .rocket()
                        .state::<fn() -> PageConfiguration>()
                        .ok_or(Status::InternalServerError)?();

                    let nav_bar = page_config.nav_bar.render(locale, locale_set);
                    let footer = page_config.footer.render();

                    Ok((page_config, nav_bar, footer))
                })
                .await
        })?;

        let fragment = self.0;

        let rendered_fragment = html! {
            (DOCTYPE)
            html lang=(locale.as_str()) prefix="og: http://opg.me/ns#" {
                head {
                    (page_config.head)
                    (fragment.head)
                }
                body {
                    div.content {
                        (nav_bar)
                        (fragment.body)
                        div #bg {}
                    }
                    (footer)
                }
            }
        }
        .0;

        Response::build()
            .status(Status::Ok)
            .header(ContentType::HTML)
            .sized_body(rendered_fragment.len(), Cursor::new(rendered_fragment))
            .ok()
    }
}

pub struct Response2<T> {
    content: T,
    status: Status,
    headers: Vec<Header<'static>>,
}

impl<T: Serialize> Response2<Json<T>> {
    pub fn json(content: T) -> Self {
        Response2::new(Json(content))
    }
}

impl<T: Taggable> Response2<Tagged<T>> {
    pub fn tagged(content: T) -> Self {
        Response2::new(Tagged(content))
    }
}

impl<T> Response2<T> {
    pub fn new(content: T) -> Self {
        Response2 {
            content,
            status: Status::Ok,
            headers: vec![],
        }
    }

    pub fn with_header(mut self, name: &'static str, value: impl Into<Cow<'static, str>>) -> Self {
        self.headers.push(Header::new(name, value));
        self
    }

    pub fn status(mut self, status: Status) -> Self {
        self.status = status;
        self
    }
}

impl<'r, 'o: 'r, T: Responder<'r, 'o>> Responder<'r, 'o> for Response2<T> {
    fn respond_to(self, request: &'r Request<'_>) -> rocket::response::Result<'o> {
        let mut response_builder = Response::build_from(self.content.respond_to(request)?);
        response_builder.status(self.status);

        for header in self.headers {
            response_builder.header(header);
        }

        response_builder.ok()
    }
}
