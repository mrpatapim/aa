let residentsMapInstance = null;
let yandexMapsLoading = null;
let mapBalloonClickBound = false;

function loadYandexMapsScript(apiKey) {
    if (window.ymaps) return Promise.resolve();
    if (yandexMapsLoading) return yandexMapsLoading;
    yandexMapsLoading = new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = "https://api-maps.yandex.ru/2.1/?apikey="
            + encodeURIComponent(apiKey)
            + "&lang=ru_RU";
        script.async = true;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error("Не удалось загрузить Яндекс.Карты"));
        document.head.appendChild(script);
    });
    return yandexMapsLoading;
}

function bindMapBalloonClicks() {
    if (mapBalloonClickBound) return;
    mapBalloonClickBound = true;
    document.addEventListener("click", event => {
        const button = event.target.closest(".map-balloon-btn");
        if (!button) return;
        event.preventDefault();
        event.stopPropagation();
        openResidentMetersSummary(Number(button.dataset.userId));
    }, true);
}

function buildMapBalloonHtml(residents) {
    return residents.map(resident => {
        const district = resident.district_name
            ? '<div class="row-meta">' + escapeHtml(resident.district_name) + " район</div>"
            : "";
        const apt = resident.apartment ? ", кв. " + escapeHtml(resident.apartment) : "";
        const floor = resident.floor ? ", эт. " + escapeHtml(resident.floor) : "";
        return '<div class="map-balloon-resident">'
            + '<div class="row-title">' + escapeHtml(resident.username) + "</div>"
            + '<div class="row-meta">' + escapeHtml(resident.email) + "</div>"
            + district
            + '<div class="row-accent">' + escapeHtml(resident.street) + ", д. "
            + escapeHtml(resident.house) + apt + floor + "</div>"
            + '<button type="button" class="btn-mini map-balloon-btn" data-user-id="'
            + resident.id + '">Счётчики жильца</button>'
            + "</div>";
    }).join("");
}

function buildMapResidentRowHtml(resident) {
    const apt = resident.apartment ? ", кв. " + escapeHtml(resident.apartment) : "";
    const floor = resident.floor ? ", эт. " + escapeHtml(resident.floor) : "";
    return '<div class="list-row map-resident-row">'
        + '<div style="flex:1; min-width:0;">'
        + '<div class="row-title">' + escapeHtml(resident.username) + "</div>"
        + '<div class="row-meta">' + escapeHtml(resident.email || "—") + "</div>"
        + '<div class="row-accent">' + escapeHtml(resident.street) + ", д. "
        + escapeHtml(resident.house) + apt + floor + "</div>"
        + "</div>"
        + '<button type="button" class="btn-mini map-balloon-btn" data-user-id="'
        + resident.id + '">Сводка</button>'
        + "</div>";
}

async function openResidentMetersSummary(userId) {
    const panel = document.getElementById("map-residents-panel");
    if (!panel) return;

    if (residentsMapInstance && residentsMapInstance.balloon && residentsMapInstance.balloon.isOpen()) {
        residentsMapInstance.balloon.close();
    }

    await renderResidentMetersSummary(userId, panel);
    panel.scrollIntoView({ behavior: "smooth", block: "start" });
}

function showMapResidentsPanel(point) {
    const panel = document.getElementById("map-residents-panel");
    if (!panel) return;
    panel.hidden = false;
    panel.innerHTML = '<div class="map-panel-head">'
        + "<h4>" + escapeHtml(point.address) + "</h4>"
        + '<span class="district-count-pill">' + point.residents.length + " "
        + pluralResidents(point.residents.length) + "</span>"
        + "</div>"
        + '<div class="item-list map-panel-list">'
        + point.residents.map(buildMapResidentRowHtml).join("")
        + "</div>";
}

async function renderResidentsMap(data) {
    const mapNode = document.getElementById("residents-map");
    if (!mapNode || !data.api_key) return;

    bindMapBalloonClicks();
    await loadYandexMapsScript(data.api_key);
    await new Promise(resolve => ymaps.ready(resolve));

    if (!residentsMapInstance) {
        residentsMapInstance = new ymaps.Map("residents-map", {
            center: [data.center_lat, data.center_lon],
            zoom: data.zoom,
            controls: ["zoomControl", "fullscreenControl"]
        });
    }

    residentsMapInstance.geoObjects.removeAll();
    const collection = new ymaps.GeoObjectCollection();

    for (const point of data.points) {
        const placemark = new ymaps.Placemark(
            [point.lat, point.lon],
            {
                balloonContentHeader: point.address,
                balloonContentBody: buildMapBalloonHtml(point.residents),
                hintContent: point.residents.map(r => r.username).join(", ")
            },
            { preset: "islands#blueCircleDotIcon" }
        );
        placemark.events.add("click", () => showMapResidentsPanel(point));
        collection.add(placemark);
    }

    residentsMapInstance.geoObjects.add(collection);

    if (data.points.length > 1) {
        const bounds = collection.getBounds();
        if (bounds) {
            residentsMapInstance.setBounds(bounds, { checkZoomRange: true, zoomMargin: 50 });
        }
    } else if (data.points.length === 1) {
        residentsMapInstance.setCenter([data.points[0].lat, data.points[0].lon], 16);
    } else {
        residentsMapInstance.setCenter([data.center_lat, data.center_lon], data.zoom);
    }
}

async function initResidentsMap() {
    const status = document.getElementById("residents-map-status");
    const panel = document.getElementById("map-residents-panel");
    if (panel) {
        panel.hidden = true;
        panel.innerHTML = "";
    }
    if (status) status.textContent = "Загрузка карты и определение координат адресов...";

    try {
        const response = await fetch(`${API_URL}/admin/residents/map`, { headers: authHeaders() });
        if (!response.ok) throw new Error("Не удалось загрузить данные для карты");
        const data = await response.json();
        if (!data.api_key) {
            if (status) status.textContent = "Ключ Яндекс.Карт не настроен. Добавьте YANDEX_MAPS_API_KEY в .env";
            return;
        }
        await renderResidentsMap(data);
        if (status) {
            if (!data.points.length) {
                status.textContent = data.skipped
                    ? "Не удалось определить координаты ни для одного адреса."
                    : "Нет зарегистрированных жильцов с адресами для отображения на карте.";
            } else if (data.skipped) {
                status.textContent = "На карте " + data.points.length + " точек. Не удалось геокодировать: "
                    + data.skipped + " жилец(ов). Нажмите на точку, чтобы увидеть список.";
            } else {
                status.textContent = "На карте " + data.points.length + " адрес(ов). Нажмите на точку или кнопку «Счётчики жильца» для сводки.";
            }
        }
    } catch (error) {
        if (status) status.textContent = "Ошибка загрузки карты.";
        showToast(error.message, "danger");
    }
}
