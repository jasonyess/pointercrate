import { tr } from "/static/core/js/modules/localization.js";

/**
 * Class for those dropdown selectors we use throughout the website
 */
export class Dropdown {
  /**
   * Creates an instance of Dropdown. The dropdown menu consists on an input element and an actual dropdown (an unordered list).
   * The dropdown only appears if the input is focused.
   *
   * Each dropdown menu item needs to define a `data-value` attribute, which, confusingly,
   * acts as the unique key identifying that item.
   *
   * Upon selecting an item in the dropdown, the value of the input element is set to the dropdowns data-display attribute,
   * or its innerText if no data-display is provided.
   *
   * The input element can have a data-default attribute, which should link to one of the dropdown items' `data-value`.
   * This will be the item selected by default.
   *
   * @param {HTMLElement} html
   * @memberof Dropdown
   */
  constructor(html) {
    this.html = html;
    this.input = this.html.getElementsByTagName("input")[0];
    if (this.input.dataset.default === undefined && !this.input.placeholder)
      this.input.placeholder = tr("core", "ui", "dropdown-placeholder");
    this.menu = $(this.html.getElementsByClassName("menu")[0]); // we need jquery for the animations
    this.ul = this.html.getElementsByTagName("ul")[0];

    this.listeners = [];
    // mapping each list items data-value to data-display
    this.values = {};

    this.selected = this.input.dataset.default;

    for (let li of this.html.querySelectorAll("ul li")) {
      this._initListItem(li);
    }

    const config = { attributes: false, childList: true, subtree: false };
    const callback = (mutationList) => {
      for (let mutation of mutationList) {
        for (let addedLI of mutation.addedNodes) {
          this._initListItem(addedLI);
        }
        for (let removedLI of mutation.removedNodes) {
          delete this.values[removedLI.dataset.value];
        }
      }
    };

    const observer = new MutationObserver(callback);
    observer.observe(this.ul, config);

    // in case some browser randomly decide to store text field values
    this.reset();

    this.input.addEventListener("focus", () => {
      this.onFocus();
      this.menu.fadeTo(300, 0.95);
    });

    this.input.addEventListener("focusout", () => {
      this.onUnfocus();
      this.menu.fadeOut(300);
    });
  }

  _initListItem(li) {
    li.addEventListener("click", () => this.select(li.dataset.value));

    this.values[li.dataset.value] = li.dataset.display || li.innerText;
  }

  addListItem(li) {
    this.ul.appendChild(li);
  }

  onFocus() {
    this.input.value = "";
    this.input.dispatchEvent(new Event("change"));
  }

  onUnfocus() {
    if (this.selected) this.input.value = this.values[this.selected];
  }

  /**
   * Clears all dropdown options but the default one (which is selected)
   */
  clearOptions() {
    this.reset();

    // Kill all but the default entry
    while (this.ul.childNodes.length > 1)
      this.ul.removeChild(this.ul.lastChild);
  }

  reset() {
    this.selected = this.input.dataset.default;
    if (this.values[this.selected])
      this.input.value = this.values[this.selected];
    else this.input.value = null;
  }

  select(entry, reselect = false) {
    if (entry in this.values) {
      if (entry === this.selected && !reselect) return;

      this.selected = entry;
      this.input.value = this.values[entry];

      for (let listener of this.listeners) {
        listener(entry);
      }
    }
  }

  selectSilently(entry) {
    if (entry in this.values) {
      this.selected = entry;
      this.input.value = this.values[entry];
    }
  }

  addEventListener(listener) {
    this.listeners.push(listener);
  }
}

export class DynamicSuggestionDropdown extends Dropdown {
  constructor(html) {
    super(html);

    this.endpoint = html.dataset.endpoint;
    this.field = html.dataset.field;

    this.input.addEventListener("input", () =>
      this._updateOptionsWithRequest()
    );
    this.timeout = null;
  }

  _updateOptionsWithRequest() {
    var filterString = this.input.value;

    if (this.timeout) window.clearTimeout(this.timeout);

    this.timeout = window.setTimeout(() => {
      get(
        this.endpoint + "?limit=5&" + this.field + "_contains=" + filterString
      ).then((response) => {
        // No change since request was made?
        if (this.input.value == filterString) {
          while (this.ul.childNodes.length)
            this.ul.removeChild(this.ul.lastChild);

          for (let item of response.data) {
            let li = document.createElement("li");
            li.innerText = item[this.field];
            li.classList.add("hover", "white");
            li.dataset.value = item[this.field];

            this.addListItem(li);
          }
        }
      });
    }, 500);
  }

  onFocus() {
    this._updateOptionsWithRequest();
  }

  onUnfocus() {
    this.selected = this.input.value;
  }
}

/**
 * Class representing complex HTML components that contain elements with the `.output` class, meaning we can display success and error messages in them somewhere.
 *
 * @export
 * @class Output
 */
export class Output {
  constructor(html) {
    this.html = html;

    this.errorOutput = this.html.getElementsByClassName("output")[0];
    this.successOutput = this.html.getElementsByClassName("output")[1];
  }

  setError(message, errorCode) {
    if (this.successOutput) this.successOutput.style.display = "none";

    if (this.errorOutput) {
      if (message === null || message === undefined) {
        this.errorOutput.style.display = "none";
      } else {
        this.errorOutput.innerText = message;
        this.errorOutput.style.display = "block";
      }
    }
  }

  setSuccess(message) {
    if (this.errorOutput) this.errorOutput.style.display = "none";

    if (this.successOutput) {
      if (message === null || message === undefined) {
        this.successOutput.style.display = "none";
      } else {
        this.successOutput.innerText = message;
        this.successOutput.style.display = "block";
      }
    }
  }
}

export class EditorBackend {
  url() {
    throw new Error("unimplemented");
  }

  headers() {
    throw new Error("unimplemented");
  }

  onSuccess(response) {}

  onError(response) {}

  edit(data) {
    return patch(this.url(), this.headers(), data)
      .then((response) => {
        if (response.status == 304) {
          return true;
        } else {
          this.onSuccess(response);
          return false;
        }
      })
      .catch((response) => {
        this.onError(response);
        throw response;
      });
  }
}

export class PaginatorEditorBackend extends EditorBackend {
  /**
   *
   * @param {Paginator} paginator
   * @param {boolean} shouldRefresh
   */
  constructor(paginator, shouldRefresh) {
    super();

    this._paginator = paginator;
    this._shouldRefresh = shouldRefresh;
  }

  headers() {
    return {
      "If-Match": this._paginator.currentEtag,
    };
  }

  url() {
    return (
      this._paginator.retrievalEndpoint + this._paginator.currentObject.id + "/"
    );
  }

  onSuccess(response) {
    this._paginator.onReceive(response);
    if (this._shouldRefresh) {
      this._paginator.refresh();
    }
  }
}

export function setupDropdownEditor(
  backend,
  dropdownId,
  field,
  output,
  translationTable = {}
) {
  let dropdown = new Dropdown(document.getElementById(dropdownId));

  dropdown.addEventListener((selected) => {
    let data = {};
    if (Object.prototype.hasOwnProperty.call(translationTable, selected)) {
      data[field] = translationTable[selected];
    } else {
      data[field] = selected;
    }

    backend
      .edit(data)
      .then((was304) => {
        if (was304) output.setSuccess(tr("core", "ui", "edit-notmodified"));
        else output.setSuccess(tr("core", "ui", "edit-success"));
      })
      .catch((response) => displayError(output)(response));
  });

  return dropdown;
}

export class Dialog {
  constructor(dialogId) {
    this.dialog = document.getElementById(dialogId);

    this.reject = undefined;
    this.resolve = undefined;
    this.submissionPredicateFactory = (data) =>
      new Promise((resolve) => resolve(data));

    this.dialog
      .getElementsByClassName("cross")[0]
      .addEventListener("click", () => {
        this.reject(); // order important
        this.close();
      });
  }

  onSubmit(data) {
    this.submissionPredicateFactory(data).then((data) => {
      this.resolve(data);
      this.close();
    });
  }

  /**
   * Opens this dialog, returning a promise that resolves if the dialog is closed succesfully (e.g. by submitting a form or making a selection) and that rejects when the dialog is closed by clicking the 'x'.
   *
   * @returns {Promise<unknown>}
   */
  open() {
    if (this.reject !== undefined) throw new Error("Dialog is already open");

    $(this.dialog.parentNode).fadeIn(300);

    return new Promise((resolve, reject) => {
      this.reject = reject;
      this.resolve = resolve;
    });
  }

  /**
   * Closes this dialog, resetting the stored promise.
   *
   * Note that no callbacks are actually called, since its impossible for this method to know whether or not the close happened because of successful reasons or not (or what data should be passed along in the success case).
   */
  close() {
    $(this.dialog.parentNode).fadeOut(300);

    this.reject = undefined;
    this.resolve = undefined;
  }
}

export class FormDialog extends Dialog {
  constructor(dialogId) {
    super(dialogId);

    this.form = new Form(this.dialog.getElementsByTagName("form")[0]);
    this.form.onSubmit(() => this.onSubmit(this.form.serialize()));
  }
}

export class DropdownDialog extends Dialog {
  constructor(dialogId, dropdownId) {
    super(dialogId);

    let html = document.getElementById(dropdownId);

    if (html.dataset.endpoint)
      this.dropdown = new DynamicSuggestionDropdown(html);
    else this.dropdown = new Dropdown(html);

    this.dropdown.addEventListener((selected) => this.onSubmit(selected));
  }
}

export function setupEditorDialog(
  dialog,
  buttonId,
  backend,
  output,
  dataTransform = (x) => x
) {
  document
    .getElementById(buttonId)
    .addEventListener("click", () => dialog.open());

  dialog.submissionPredicateFactory = (data) => {
    return backend
      .edit(dataTransform(data))
      .then((was304) => {
        if (was304) {
          output.setSuccess(tr("core", "ui", "edit-notmodified"));
        } else {
          output.setSuccess(tr("core", "ui", "edit-success"));
        }
      })
      .catch((response) => {
        // FIXME: only works for form dialogs!
        displayError(dialog.form)(response);
        throw response;
      });
  };
}

export function setupFormDialogEditor(backend, dialogId, buttonId, output) {
  let editor = new FormDialog(dialogId);

  setupEditorDialog(editor, buttonId, backend, output);

  return editor.form;
}

export class Paginator extends Output {
  /**
   * Creates an instance of Paginator. Retrieves its endpoint from the `data-endpoint` data attribute of `html`.
   *
   * **Important:** The objects being paginated are assumed to have an `id` property!
   *
   * @param {String} elementId The Id of the DOM element of this paginator
   * @param {Object} queryData The initial query data to use
   * @param {*} itemConstructor Callback used to construct the list items of this Paginator
   * @memberof Paginator
   */
  constructor(elementId, queryData, itemConstructor) {
    super(document.getElementById(elementId));

    // Next and previous buttons
    this.next = this.html.getElementsByClassName("next")[0];
    this.prev = this.html.getElementsByClassName("prev")[0];

    // The li that was last clicked and thus counts as "selected". Note that this attribute can be null if selection was not performed via a click to a list objects, but instead via a direct call to `selectArbitrary`
    this.currentlySelected = null;
    // The 'data' part of the response that the server sent after clicking 'currentlySelected', or after an object was selected directly via `selectArbitrary`
    this.currentObject = null;
    // The etag of 'currentObject'
    this.currentEtag = null;

    // external selection listeners
    this.selectionListeners = [];

    // The endpoint which will be paginated. By storing this, we assume that the 'Links' header never redirects
    // us to a different endpoint (this is the case with the pointercrate API)
    this.endpoint = this.html.dataset.endpoint;
    // The endpoint from which the actual objects will be retrieved. By default equal to the pagination endpoint.
    this.retrievalEndpoint = this.endpoint;

    // The link for the request that was made to display the current data (required for refreshing)
    this.currentLink = this.endpoint + "?" + $.param(queryData);
    // The query data for the first request. Pagination may only update the 'before' and 'after' parameter,
    // meaning everything else will always stay the same.
    // Storing this means we won't have to parse the query data of the links from the 'Links' header, and allows
    // us to easily update some parameters later on
    this.queryData = queryData;

    // The (parsed) values of the HTTP 'Links' header, telling us how what requests to make then next or prev is clicked
    this.links = undefined;
    // The callback that constructs list entries for us
    this.itemConstructor = itemConstructor;

    // The list displaying the results of the request
    this.list = this.html.getElementsByClassName("selection-list")[0];

    this.nextHandler = this.onNextClick.bind(this);
    this.prevHandler = this.onPreviousClick.bind(this);

    if (this.html.style.display === "none") {
      this.html.style.display = "block";
    }

    this.next.addEventListener("click", this.nextHandler, false);
    this.prev.addEventListener("click", this.prevHandler, false);
  }

  /**
   * Programmatically selects an object with the given id
   *
   * The selected object does not have to be currently visible in the paginator. On success, `onReceive` is called. Returns a promise without a registered error handler (meaning the error message will not automatically get displayed in the paginator)
   *
   * @param id The ID of the object to select
   *
   * @returns A promise
   */
  selectArbitrary(id) {
    return get(this.retrievalEndpoint + id + "/").then((response) => {
      this.setError(null);
      this.onReceive(response);
    });
  }

  /**
   * Realizes a callback for when a user selects a list item.
   *
   * The default implementation takes the value of the `data-id` attribute of the selected item,
   * concatenates it to the pagination request URL,
   * makes a request to that URL and calls `onReceive` with the result
   *
   * @param {HTMLElement} selected The selected list item
   * @memberof Paginator
   */
  onSelect(selected) {
    this.currentlySelected = selected;
    return this.selectArbitrary(selected.dataset.id).catch(displayError(this));
  }

  /**
   * Realizes a callback for when the request made in onSelect is successful
   *
   * @param {*} response
   * @memberof Paginator
   */
  onReceive(response) {
    // I dont know why we check this everywhere, and at this point I'm too afraid to ask. But the API shouldn't return a 204 on a GET.
    if (response.status != 204) {
      if (response.status == 200 || response.status == 201) {
        this.currentObject = response.data.data;
        this.currentEtag = response.headers["etag"];
      }

      for (let listener of this.selectionListeners) {
        listener(this.currentObject);
      }
    }
  }

  addSelectionListener(listener) {
    this.selectionListeners.push(listener);
  }

  /**
   * Initializes this Paginator by making the request using the query data specified in the constructor.
   *
   * Calling any other method on this before calling initialize is considered an error.
   * Calling this more than once has no additional effect.
   *
   * @memberof Paginator
   */
  initialize() {
    if (this.links === undefined) return this.refresh();
  }

  handleResponse(response) {
    this.links = parsePagination(response.headers["links"]);
    this.list.scrollTop = 0;

    // Clear the current list.
    // list.innerHtml = '' is horrible and should never be used. It causes memory leaks and is terribly slow
    while (this.list.lastChild) {
      this.list.removeChild(this.list.lastChild);
    }

    for (var result of response.data) {
      let item = this.itemConstructor(result);
      item.addEventListener("click", (e) => this.onSelect(e.currentTarget));
      this.list.appendChild(item);
    }
  }

  /**
   * Updates a single key in the query data. Refreshes the paginator and resets it to the first page,
   * meaning 'before' and 'after' fields are reset to the values they had at the time of construction.
   *
   * @param {String} key The key
   * @param {String} value The value
   * @memberof Paginator
   */
  updateQueryData(key, value) {
    let obj = {};
    obj[key] = value;
    this.updateQueryData2(obj);
  }

  updateQueryData2(obj) {
    for (const [key, value] of Object.entries(obj)) {
      if (value === undefined) delete this.queryData[key];
      else this.queryData[key] = value;
    }

    this.currentLink = this.endpoint + "?" + $.param(this.queryData);
    this.refresh();
  }

  /**
   * Sets this Paginators query data, overriding the values provided at the time of construction. Refreshes the paginator by making a request with the given query data
   *
   * @param {*} queryData The new query data
   * @memberof Paginator
   */
  setQueryData(queryData) {
    this.queryData = queryData;
    this.currentLink = this.endpoint + "?" + $.param(queryData);
    this.refresh();
  }

  /**
   * Refreshes the paginator, by reissuing the request that was made to display the current data
   *
   * @memberof Paginator
   */
  refresh() {
    this.setError(null);
    return get(this.currentLink)
      .then(this.handleResponse.bind(this))
      .catch(displayError(this));
  }

  onPreviousClick() {
    if (this.links.prev) {
      this.setError(null);
      get(this.links.prev)
        .then(this.handleResponse.bind(this))
        .catch(displayError(this));
    }
  }

  onNextClick() {
    if (this.links.next) {
      this.setError(null);
      get(this.links.next)
        .then(this.handleResponse.bind(this))
        .catch(displayError(this));
    }
  }

  stop() {
    this.next.removeEventListener("click", this.nextHandler, false);
    this.prev.removeEventListener("click", this.prevHandler, false);
  }
}

function parsePagination(linkHeader) {
  var links = {};
  if (linkHeader) {
    for (var link of linkHeader.split(",")) {
      var s = link.split(";");

      links[s[1].substring(5)] = s[0].substring(1, s[0].length - 1);
    }
  }
  return links;
}

export function findParentWithClass(element, clz) {
  let parent = element;

  while (parent !== null && parent.classList !== null) {
    if (parent.classList.contains(clz)) {
      return parent;
    }
    parent = parent.parentNode;
  }
}

export class Viewer extends Output {
  constructor(elementId, paginator) {
    super(elementId);

    this.viewer = findParentWithClass(this.html, "viewer");
    this.paginator = paginator;

    this._welcome = this.viewer.getElementsByClassName("viewer-welcome")[0];
    this._content = this.viewer.getElementsByClassName("viewer-content")[0];

    this.paginator.addSelectionListener(() => {
      this.setError(null);
      this.setSuccess(null);

      $(this._content).fadeIn(100);
      $(this._welcome).fadeOut(100);
    });
  }

  hideContent() {
    $(this._welcome).fadeIn(100);
    $(this._content).fadeOut(100);
  }
}

/**
 * A Wrapper around a paginator that includes a search/filter bar at the top
 *
 * @class FilteredPaginator
 */
export class FilteredPaginator extends Paginator {
  /**
   * Creates an instance of FilteredPaginator.
   *
   * @param {String} paginatorID HTML id of this viewer
   * @param {*} itemConstructor Callback used to construct the list entries on the left side
   * @param {String} filterParam Name of the API field that should be set for filtering the list
   * @memberof FilteredPaginator
   */
  constructor(
    paginatorID,
    itemConstructor,
    filterParam,
    initialQueryData = {}
  ) {
    super(paginatorID, initialQueryData, itemConstructor);

    let filterInput = this.html.getElementsByTagName("input")[0];

    filterInput.value = "";

    // Apply filter when enter is pressed
    filterInput.addEventListener("keypress", (event) => {
      if (event.keyCode == 13) {
        this.updateQueryData(filterParam, filterInput.value);
      }
    });

    // Apply filter when input is changed externally
    filterInput.addEventListener("change", () =>
      this.updateQueryData(filterParam, filterInput.value)
    );

    filterInput.parentNode.addEventListener("click", (event) => {
      if (event.offsetX > filterInput.offsetWidth) {
        filterInput.value = "";
        this.updateQueryData(filterParam, "");
      }
    });

    var timeout = undefined;

    // Upon input, wait a second before applying the filter (to ensure the user is actually done writing in the text field)
    filterInput.addEventListener("input", () => {
      if (timeout) {
        clearTimeout(timeout);
      }

      timeout = setTimeout(
        () => this.updateQueryData(filterParam, filterInput.value),
        1000
      );
    });
  }
}

/**
 * Abstract class representing inputs that can show up in forms around pointercrate.
 */
export class FormInput {
  constructor() {
    this._clearOnInvalid = false;
    this._validators = [];
    this._transform = (x) => x;
  }

  setTransform(transform) {
    this._transform = transform;
  }

  addValidator(validator, msg) {
    this._validators.push({
      validator: validator,
      message: msg,
    });
  }

  addValidators(validators) {
    Object.keys(validators).forEach((message) =>
      this.addValidator(validators[message], message)
    );
  }

  validate() {
    this.errorText = "";

    var isValid = true;

    for (var validator of this._validators) {
      if (!validator.validator(this)) {
        isValid = false;

        if (typeof validator.message === "string") {
          this.appendError(validator.message);
        } else {
          this.appendError(validator.message(this.value));
        }
      }
    }

    return isValid;
  }

  clear() {
    throw new Error("Unimplemented");
  }

  /**
   * Whether this input should reset its contents upon unsuccessful validation
   *
   * @param value
   */
  set clearOnInvalid(value) {
    this._clearOnInvalid = value;
  }

  get clearOnInvalid() {
    return this._clearOnInvalid;
  }

  /**
   * The value of this {@link FormInput}
   */
  get value() {
    throw new Error("Abstract Property");
  }

  get transformedValue() {
    return this._transform(this.value);
  }

  set value(value) {
    throw new Error("Abstract Property");
  }

  get name() {
    throw new Error("Abstract Property");
  }

  get id() {
    throw new Error("Abstract Property");
  }

  get required() {
    return true;
  }

  get errorText() {
    return "";
  }

  set errorText(value) {
    // clear only if we dont actually reset the error!
    if (this.clearOnInvalid && value) this.clear();
  }

  /**
   * Appends the given error on a new line
   * @param newError
   */
  appendError(newError) {
    if (this.error) {
      if (this.errorText != "") {
        this.errorText += "<br>";
      }

      this.errorText += newError;
    }
  }
}

export class HtmlFormInput extends FormInput {
  constructor(span) {
    super();

    this.span = span;
    this.input =
      span.getElementsByTagName("input")[0] ||
      span.getElementsByTagName("textarea")[0];
    this.error = span.getElementsByTagName("p")[0];

    this.input.addEventListener(
      "input",
      () => {
        if (this.input.validity.valid || this.input.validity.customError) {
          this.errorText = "";
        }
      },
      false
    );
  }

  get value() {
    // extend this switch to other input types as required.
    switch (this.input.type) {
      case "checkbox":
        return this.input.checked;
      case "number":
        if (this.input.value === "" || this.input.value === null) return null;
        return parseInt(this.input.value);
      case "text": // also handles the text area case
      default:
        if (this.input.value === "" || this.input.value === null) return null;
        return this.input.value;
    }
  }

  set value(value) {
    if (this.input.type === "checkbox") this.input.checked = value;
    else this.input.value = value;
  }

  get name() {
    return this.input.name;
  }

  get id() {
    return this.span.id;
  }

  clear() {
    if (this.input.type === "checkbox") this.input.checked = false;
    else this.input.value = "";
  }

  get required() {
    return this.input.hasAttribute("required");
  }

  get errorText() {
    return this.error.innerText;
  }

  set errorText(value) {
    // weird super call lol
    super.errorText = value;

    if (this.error) this.error.innerText = value;
    else if (value !== "")
      console.log("Unreportable error on input " + this.input + ": " + value);
    this.input.setCustomValidity(value);
  }
}

export class DropdownFormInput extends FormInput {
  /**
   *
   * @param dropdown {HTMLElement}
   */
  constructor(dropdown) {
    super();

    let html = dropdown.getElementsByClassName("dropdown-menu")[0];

    if (html.dataset.endpoint)
      this.dropdown = new DynamicSuggestionDropdown(html);
    else this.dropdown = new Dropdown(html);

    this.error = dropdown.getElementsByTagName("p")[0];

    this.dropdown.addEventListener((selected) => {
      if (this.input.validity.valid || this.input.validity.customError)
        this.errorText = "";
    });
    this.dropdown.input.addEventListener("input", () => {
      if (this.input.validity.valid || this.input.validity.customError)
        this.errorText = "";
    });
  }

  get input() {
    return this.dropdown.input;
  }

  clear() {
    this.dropdown.reset();
  }

  get value() {
    return this.dropdown.selected;
  }

  get name() {
    return this.dropdown.input.name;
  }

  get id() {
    return this.dropdown.html.id;
  }

  get errorText() {
    return this.error.innerText;
  }

  set errorText(value) {
    // weird super call lol
    super.errorText = value;

    this.error.innerText = value;
    this.dropdown.input.setCustomValidity(value);
  }
}

/**
 * Input class that simply reads out the value of a specified tag
 */
export class HtmlInput extends FormInput {
  constructor(input) {
    super();

    this.input = input;
    this.default = input.dataset.default;
    this.target = document.getElementById(input.dataset.targetId);

    this.error = input.getElementsByTagName("p")[0];

    let mutationObserver = new MutationObserver(() => (this.errorText = ""));
    mutationObserver.observe(this.target, {
      attributes: true,
      childList: true,
      subtree: true,
    });
  }

  clear() {
    this.target.innerText = this.default;
  }

  get value() {
    return this.target.innerText === this.default
      ? undefined
      : this.target.innerText;
  }

  set value(value) {
    this.target.innerText = value;
  }

  get name() {
    return this.target.dataset.name;
  }

  get id() {
    return this.input.id;
  }

  get errorText() {
    return this.error.innerText;
  }

  set errorText(value) {
    // weird super call lol
    super.errorText = value;

    this.error.innerText = value;
  }
}

export class Form extends Output {
  constructor(form) {
    super(form);

    this.inputs = [];
    this.submitHandler = undefined;
    this.invalidHandler = undefined;
    this.errorOutput = this.html.getElementsByClassName("output")[0];
    this.successOutput = this.html.getElementsByClassName("output")[1];
    this._errorRedirects = {};

    for (var input of this.html.getElementsByClassName("form-input")) {
      if (input.dataset.type === "dropdown")
        this.inputs.push(new DropdownFormInput(input));
      else if (input.dataset.type === "html")
        this.inputs.push(new HtmlInput(input));
      else this.inputs.push(new HtmlFormInput(input));
    }

    this.html.addEventListener(
      "submit",
      (event) => {
        event.preventDefault();

        this.setError(null);
        this.setSuccess(null);

        var isValid = true;

        for (let input of this.inputs) {
          isValid &= input.validate();
        }

        if (isValid) {
          if (this.submitHandler !== undefined) {
            // todo: maybe just pass the result of .serialize here?
            this.submitHandler(event);
          }
        } else if (this.invalidHandler !== undefined) {
          this.invalidHandler();
        }
      },
      false
    );
  }

  clear() {
    for (let input of this.inputs) {
      input.clear();
    }
  }

  /**
   * Adds an override to have errors with the given code be displayed as an error at the given input element instead of globally
   *
   * @param {int} errorCode The error code
   * @param {string} inputId The id of the input
   * @memberof Form
   */
  addErrorOverride(errorCode, inputId) {
    this._errorRedirects[errorCode] = inputId;
  }

  serialize() {
    let data = {};

    for (let input of this.inputs) {
      if (input.name && (input.value !== null || !input.required)) {
        data[input.name] = input.transformedValue;
      }
    }

    return data;
  }

  setError(message, errorCode) {
    if (this.successOutput) this.successOutput.style.display = "none";

    if (this.errorOutput) {
      if (message === null || message === undefined) {
        this.errorOutput.style.display = "none";
      } else {
        if (errorCode in this._errorRedirects) {
          let input = this.input(this._errorRedirects[errorCode]);
          if (input) {
            input.errorText = message;
          } else {
            this.errorOutput.style.display = "block";
            this.errorOutput.innerText = message;
          }
        } else {
          this.errorOutput.style.display = "block";
          this.errorOutput.innerText = message;
        }
      }
    }
  }

  onSubmit(handler) {
    this.submitHandler = handler;
  }

  onInvalid(handler) {
    this.invalidHandler = handler;
  }

  input(id) {
    for (var input of this.inputs) {
      if (input.id == id) {
        return input;
      }
    }
    return null;
  }

  value(id) {
    this.input(id).value();
  }

  addValidators(validators) {
    Object.keys(validators).forEach((input_id) =>
      this.input(input_id).addValidators(validators[input_id])
    );
  }
}

export function badInput(input) {
  return !input.input.validity.badInput;
}

export function patternMismatch(input) {
  return !input.input.validity.patternMismatch;
}

export function rangeOverflow(input) {
  return !input.input.validity.rangeOverflow;
}

export function rangeUnderflow(input) {
  return !input.input.validity.rangeUnderflow;
}

export function stepMismatch(input) {
  return !input.input.validity.stepMismatch;
}

export function tooLong(input) {
  return !input.input.validity.tooLong;
}

export function tooShort(input) {
  return !input.input.validity.tooShort;
}

export function typeMismatch(input) {
  return !input.input.validity.typeMismatch;
}

export function valueMissing(input) {
  if (input.input === undefined || input.input.validity === undefined)
    return input.value !== undefined;
  return !input.input.validity.valueMissing;
}

/**
 * Standard error handler for a promise returned by `get`, `post`, `del` or `patch` which displays the error message in an html element.
 *
 * @param errorOutput The HTML element whose `innerText` property should be set to the error message
 * @param specialCodes Special error handlers for specific error codes. Special handlers should be keyed by pointercrate error code and take the error object as only argument
 */
export function displayError(output, specialCodes = {}) {
  return function (response) {
    if (response.data) {
      if (response.data.code in specialCodes) {
        specialCodes[response.data.code](response.data);
      } else {
        output.setError(response.data.message, response.data.code);
      }
    } else {
      output.setError(
        "FrontEnd JavaScript Error. Please notify an administrator and tell them as accurately as possible how to replicate this bug!"
      );
      console.error(response);
      throw new Error("FrontendError");
    }
  };
}

/**
 * Makes a GET request to the given endpoint
 *
 * @param endpoint The endpoint to make the GET request to
 * @param headers The headers to
 *
 * @returns A promise that resolves to the server response along with server headers both on success and error.
 */
export function get(endpoint, headers = {}) {
  return mkReq("GET", endpoint, headers);
}

export function post(endpoint, headers = {}, data = {}) {
  return mkReq("POST", endpoint, headers, data);
}

export function put(endpoint, headers = {}, data = {}) {
  return mkReq("PUT", endpoint, headers, data);
}

export function del(endpoint, headers = {}) {
  return mkReq("DELETE", endpoint, headers);
}

export function patch(endpoint, headers, data) {
  return mkReq("PATCH", endpoint, headers, data);
}

const SEVERE_ERROR = {
  message:
    "Severe internal server error: The error response could not be processed. This is most likely due to an internal panic in the request handler and might require a restart! Please report this immediately!",
  code: 50000,
  data: null,
};

const UNEXPECTED_REDIRECT = {
  message:
    "Unexpected redirect. This is a front-end error, most likely caused by a missing trailing slash",
  code: 50000,
  data: null,
};
const RATELIMITED = {
  message:
    "You have hit a Cloudflare ratelimit. Please wait a short time and try again.",
  code: 42900,
  data: null,
};

// I cannot fucking believe javascript doesn't have this built in.
// This is based on https://www.w3schools.com/js/js_cookies.asp
function getCookie(cname) {
  let name = cname + "=";
  let decodedCookie = decodeURIComponent(document.cookie);
  let cookies = decodedCookie.split(";");
  for (let cookie of cookies) {
    cookie = cookie.trim();

    if (cookie.indexOf(name) == 0)
      return cookie.substring(name.length, cookie.length);
  }
  return null;
}

function mkReq(method, endpoint, headers = {}, data = null) {
  let csrf_token = getCookie("csrf_token");

  headers["Content-Type"] = "application/json";
  headers["Accept"] = "application/json";

  if (csrf_token) headers["X-CSRF-TOKEN"] = csrf_token;

  return new Promise(function (resolve, reject) {
    let xhr = new XMLHttpRequest();

    xhr.open(method, endpoint);
    xhr.onload = () => {
      if ((xhr.status >= 200 && xhr.status < 300) || xhr.status == 304) {
        resolve({
          data:
            xhr.status != 204 && xhr.status != 304 && xhr.responseText // sometimes 201 responses dont have any json body
              ? JSON.parse(xhr.responseText)
              : null,
          headers: parseHeaders(xhr),
          status: xhr.status,
        });
      } else if (xhr.status < 400) {
        reject({
          data: UNEXPECTED_REDIRECT,
          headers: parseHeaders(xhr),
          status: xhr.status,
        });
      } else {
        try {
          var jsonError = JSON.parse(xhr.responseText);
        } catch (e) {
          return reject({
            data: xhr.status == 429 ? RATELIMITED : SEVERE_ERROR,
            headers: parseHeaders(xhr),
            status: xhr.status,
          });
        }
        reject({
          data: jsonError,
          headers: parseHeaders(xhr),
          status: xhr.status,
        });
      }
    };

    for (let header of Object.keys(headers)) {
      xhr.setRequestHeader(header, headers[header]);
    }

    if (data) {
      data = JSON.stringify(data);
    }

    xhr.send(data);
  });
}

function parseHeaders(xhr) {
  return xhr
    .getAllResponseHeaders()
    .split("\r\n")
    .reduce((result, current) => {
      let [name, value] = current.split(": ");
      result[name] = value;
      return result;
    }, {});
}
