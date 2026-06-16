let streetSuggestTimer = null;
let streetSuggestions = [];
let streetActiveIndex = -1;

async function validateRegistrationAddress() {
    const street = document.getElementById("reg-street").value.trim();
    const house = document.getElementById("reg-house").value.trim();
    if (!street) throw new Error("Укажите улицу");
    if (!house) throw new Error("Укажите номер дома");
    if (!/^\d/.test(house)) throw new Error("Номер дома должен начинаться с цифры");

    const response = await fetch(`${API_URL}/api/streets/validate?` + new URLSearchParams({ street }));
    const data = await response.json();
    if (!data.valid) {
        throw new Error("Выберите улицу из подсказок Самары");
    }
    return { street: data.label, districtName: data.district_name };
}

async function handleRegister(event) {
    event.preventDefault();
    const msg = document.getElementById("error-msg");
    msg.innerText = "";
    try {
        const address = await validateRegistrationAddress();
        const response = await fetch(`${API_URL}/register`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({
                username: document.getElementById("reg-username").value.trim(),
                email: document.getElementById("reg-email").value.trim(),
                street: address.street,
                house: document.getElementById("reg-house").value.trim(),
                apartment: document.getElementById("reg-apartment").value.trim() || null,
                floor: document.getElementById("reg-floor").value.trim() || null,
                password: document.getElementById("reg-password").value
            })
        });
        if (!response.ok) {
            const errorBody = await response.json();
            if (errorBody.detail && Array.isArray(errorBody.detail)) {
                throw new Error(errorBody.detail[0].msg);
            }
            throw new Error(errorBody.detail || "Пользователь с такими данными уже зарегистрирован");
        }
        const data = await response.json();
        localStorage.setItem("token", data.access_token);
        localStorage.setItem("isAdmin", data.is_admin ? "true" : "false");
        window.location.href = "/dashboard";
    } catch (error) {
        msg.innerText = error.message;
        showToast(error.message, "danger");
    }
}

async function handleLogin(event) {
    event.preventDefault();
    const msg = document.getElementById("error-msg");
    msg.innerText = "";
    const formData = new URLSearchParams();
    formData.append("username", document.getElementById("login-username").value.trim());
    formData.append("password", document.getElementById("login-password").value);
    try {
        const response = await fetch(`${API_URL}/login`, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            credentials: "include",
            body: formData
        });
        if (!response.ok) throw new Error("Неверное имя пользователя или пароль");
        const data = await response.json();
        localStorage.setItem("token", data.access_token);
        localStorage.setItem("isAdmin", data.is_admin ? "true" : "false");
        window.location.href = "/dashboard";
    } catch (error) {
        msg.innerText = error.message;
        showToast(error.message, "danger");
    }
}

function setStreetHint(text, state) {
    const hint = document.getElementById("reg-street-hint");
    if (!hint) return;
    hint.textContent = text || "";
    hint.className = "address-hint" + (state ? " is-" + state : "");
}

function hideStreetSuggestions() {
    const list = document.getElementById("reg-street-suggestions");
    const input = document.getElementById("reg-street");
    if (!list) return;
    list.hidden = true;
    list.innerHTML = "";
    streetSuggestions = [];
    streetActiveIndex = -1;
    if (input) input.setAttribute("aria-expanded", "false");
}

function renderStreetSuggestions(items) {
    const list = document.getElementById("reg-street-suggestions");
    const input = document.getElementById("reg-street");
    if (!list) return;

    streetSuggestions = items || [];
    streetActiveIndex = -1;
    if (!streetSuggestions.length) {
        hideStreetSuggestions();
        return;
    }

    list.innerHTML = streetSuggestions.map((item, index) => (
        '<li role="option" data-index="' + index + '">'
        + '<span class="suggestion-street">' + escapeHtml(item.label) + "</span>"
        + '<span class="suggestion-district">' + escapeHtml(item.district_name) + " район</span>"
        + "</li>"
    )).join("");
    list.hidden = false;
    if (input) input.setAttribute("aria-expanded", "true");
}

function selectStreetSuggestion(index) {
    const item = streetSuggestions[index];
    const input = document.getElementById("reg-street");
    if (!item || !input) return;
    input.value = item.label;
    setStreetHint("Район: " + item.district_name, "ok");
    hideStreetSuggestions();
}

async function fetchStreetSuggestions(query) {
    const response = await fetch(`${API_URL}/api/streets/suggest?` + new URLSearchParams({ q: query }));
    if (!response.ok) return [];
    return response.json();
}

async function updateStreetHintFromInput() {
    const input = document.getElementById("reg-street");
    if (!input) return;
    const street = input.value.trim();
    if (!street) {
        setStreetHint("Начните вводить название улицы — появятся подсказки", "");
        return;
    }
    try {
        const response = await fetch(`${API_URL}/api/streets/validate?` + new URLSearchParams({ street }));
        if (!response.ok) {
            setStreetHint("Выберите улицу из списка подсказок", "warn");
            return;
        }
        const data = await response.json();
        if (data.valid) {
            setStreetHint("Район: " + data.district_name, "ok");
            if (data.label && data.label !== street) input.value = data.label;
        } else {
            setStreetHint("Улица не найдена — выберите вариант из подсказок", "warn");
        }
    } catch (error) {
        void error;
    }
}

function initAddressAutocomplete() {
    const input = document.getElementById("reg-street");
    const list = document.getElementById("reg-street-suggestions");
    if (!input || !list) return;

    setStreetHint("Начните вводить название улицы — появятся подсказки", "");

    input.addEventListener("input", () => {
        const query = input.value.trim();
        clearTimeout(streetSuggestTimer);
        if (query.length < 2) {
            hideStreetSuggestions();
            setStreetHint("Введите минимум 2 символа для подсказок", "");
            return;
        }
        streetSuggestTimer = setTimeout(async () => {
            const items = await fetchStreetSuggestions(query);
            renderStreetSuggestions(items);
            if (!items.length) setStreetHint("Улица не найдена — проверьте написание", "warn");
        }, 220);
    });

    input.addEventListener("keydown", event => {
        if (list.hidden || !streetSuggestions.length) return;
        if (event.key === "ArrowDown") {
            event.preventDefault();
            streetActiveIndex = (streetActiveIndex + 1) % streetSuggestions.length;
        } else if (event.key === "ArrowUp") {
            event.preventDefault();
            streetActiveIndex = (streetActiveIndex - 1 + streetSuggestions.length) % streetSuggestions.length;
        } else if (event.key === "Enter" && streetActiveIndex >= 0) {
            event.preventDefault();
            selectStreetSuggestion(streetActiveIndex);
            return;
        } else if (event.key === "Escape") {
            hideStreetSuggestions();
            return;
        } else {
            return;
        }
        list.querySelectorAll("li").forEach((node, index) => {
            node.classList.toggle("is-active", index === streetActiveIndex);
        });
    });

    input.addEventListener("blur", () => {
        setTimeout(() => {
            hideStreetSuggestions();
            updateStreetHintFromInput();
        }, 160);
    });

    list.addEventListener("mousedown", event => {
        const item = event.target.closest("li[data-index]");
        if (!item) return;
        event.preventDefault();
        selectStreetSuggestion(Number(item.dataset.index));
    });
}

function initAuthPage() {
    initAddressAutocomplete();
}
