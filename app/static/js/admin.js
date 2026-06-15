let revenueChart = null;
let adminUsersCache = [];

function findCachedUser(userId) {
    return adminUsersCache.find(user => user.id === userId);
}

function buildUserInfoHtml(user, options = {}) {
    const { showBudget = false } = options;
    const budgetLine = showBudget
        ? '<div class="row-meta">Лимит/мес: ' + (Number(user.monthly_budget) > 0 ? formatMoney(user.monthly_budget) : "не задан") + "</div>"
        : "";
    return '<div style="flex:1; min-width:0;">'
        + '<div class="row-title">' + escapeHtml(user.username) + "</div>"
        + '<div class="row-meta">' + escapeHtml(user.email || "—") + "</div>"
        + '<div class="row-accent">' + escapeHtml(composeAddress(user)) + "</div>"
        + budgetLine
        + "</div>";
}

function buildUserListRowHtml(user, options = {}) {
    const { showDelete = false, showBudget = false } = options;
    const deleteBtn = showDelete
        ? '<button class="btn-danger btn-mini" onclick="adminDeleteUser(event, ' + user.id + ')">Удалить</button>'
        : "";
    return '<div class="list-row is-clickable" onclick="viewUserMeters(' + user.id + ')">'
        + buildUserInfoHtml(user, { showBudget })
        + deleteBtn
        + "</div>";
}

async function loadAdminStats() {
    try {
        const response = await fetch(`${API_URL}/admin/stats`, { headers: authHeaders() });
        if (!response.ok) return;
        const stats = await response.json();
        setText("admin-total-users", stats.total_users);
        setText("admin-total-meters", stats.total_meters);
        setText("admin-total-readings", stats.total_readings);
        setText("admin-total-revenue", formatMoney(stats.total_revenue));
    } catch (error) {
        showToast("Не удалось загрузить статистику", "danger");
    }
}

async function loadAdminRevenue() {
    const response = await fetch(`${API_URL}/admin/revenue`, { headers: authHeaders() });
    const revenueData = await response.json();

    const canvas = document.getElementById("revenueChart");
    if (!canvas || typeof Chart === "undefined") return;
    const ctx = canvas.getContext("2d");
    if (revenueChart) revenueChart.destroy();

    revenueChart = new Chart(ctx, {
        type: "doughnut",
        data: {
            labels: revenueData.map(item => item.service_name),
            datasets: [{
                data: revenueData.map(item => item.total_revenue),
                backgroundColor: revenueData.map((item, index) => BLUE_SCALE[index % BLUE_SCALE.length]),
                borderColor: "#ffffff",
                borderWidth: 3,
                hoverOffset: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: "62%",
            plugins: {
                legend: {
                    position: "right",
                    labels: { color: "#0f1f3d", font: { size: 13 }, padding: 14, usePointStyle: true }
                },
                tooltip: {
                    callbacks: {
                        label: context => {
                            const total = context.dataset.data.reduce((sum, value) => sum + value, 0);
                            const share = total > 0 ? ((context.parsed / total) * 100).toFixed(1) : "0.0";
                            return ` ${context.label}: ${formatMoney(context.parsed)} (${share}%)`;
                        }
                    }
                }
            }
        }
    });
}

async function loadAdminUsers() {
    const response = await fetch(`${API_URL}/admin/users`, { headers: authHeaders() });
    const users = await response.json();
    adminUsersCache = users;

    const listDiv = document.getElementById("admin-users-list");
    if (listDiv) {
        if (users.length === 0) {
            listDiv.innerHTML = `<p class="empty-note">В системе нет зарегистрированных жильцов.</p>`;
        } else {
            listDiv.innerHTML = users.map(user => buildUserListRowHtml(user, { showDelete: true })).join("");
        }
    }

    initResidentsByDistrict(users);
    initResidentsMap();
}

function buildMetersSummaryHtml(user, meters) {
    const totalCost = meters.reduce((sum, meter) => sum + (Number(meter.total_cost) || 0), 0);
    const totalReadings = meters.reduce((sum, meter) => sum + (Number(meter.readings_count) || 0), 0);
    const budget = user && Number(user.monthly_budget) > 0 ? formatMoney(user.monthly_budget) : "не задан";
    const title = user ? escapeHtml(user.username) : "Жилец";
    const address = user ? escapeHtml(composeAddress(user)) : "";

    let body = '<div class="map-summary-kpi">'
        + '<div class="map-summary-kpi-card"><div class="label">Начислено всего</div><div class="value">' + formatMoney(totalCost) + "</div></div>"
        + '<div class="map-summary-kpi-card"><div class="label">Лимит в месяц</div><div class="value">' + budget + "</div></div>"
        + '<div class="map-summary-kpi-card"><div class="label">Приборов учёта</div><div class="value">' + meters.length + "</div></div>"
        + '<div class="map-summary-kpi-card"><div class="label">Всего показаний</div><div class="value">' + totalReadings + "</div></div>"
        + "</div>";

    if (!meters.length) {
        body += '<p class="empty-note">У жильца пока нет зарегистрированных приборов учёта.</p>';
    } else {
        body += '<div class="item-list map-meters-list">';
        meters.forEach(meter => {
            const lastDate = meter.last_reading
                ? new Date(meter.last_reading).toLocaleDateString("ru-RU")
                : "нет данных";
            body += '<div class="list-row">'
                + "<div>"
                + '<div class="row-title">' + escapeHtml(meter.service_name) + " · №" + escapeHtml(meter.serial_number) + "</div>"
                + '<div class="row-meta">Тариф: ' + meter.current_tariff + " ₽/" + escapeHtml(meter.unit)
                + " · Показаний: " + meter.readings_count + " · Последнее: " + lastDate + "</div>"
                + "</div>"
                + '<div class="row-value">' + formatMoney(meter.total_cost) + "</div>"
                + "</div>";
        });
        body += "</div>";
    }

    return '<div class="map-panel-head">'
        + "<div><h4>" + title + " — сводка по счётчикам</h4>"
        + (address ? '<div class="row-meta" style="margin-top:4px;">' + address + "</div>" : "")
        + "</div></div>"
        + '<div class="map-summary-body">' + body + "</div>";
}

async function renderResidentMetersSummary(userId, container) {
    if (!container) return;
    container.hidden = false;
    container.innerHTML = '<p class="empty-note" style="padding:16px;">Загрузка данных счётчиков...</p>';

    const user = findCachedUser(userId);
    try {
        const response = await fetch(`${API_URL}/admin/users/${userId}/meters`, { headers: authHeaders() });
        if (!response.ok) throw new Error("Не удалось загрузить данные");
        const meters = await response.json();
        container.innerHTML = buildMetersSummaryHtml(user, meters);
    } catch (error) {
        container.innerHTML = '<p class="empty-note" style="color:var(--danger); padding:16px;">'
            + escapeHtml(error.message) + "</p>";
    }
}

async function viewUserMeters(userId) {
    const zone = document.getElementById("admin-user-meters-zone");
    if (!zone) return;
    await renderResidentMetersSummary(userId, zone);
    zone.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

async function adminDeleteUser(event, userId) {
    event.stopPropagation();
    const user = findCachedUser(userId);
    const name = user ? user.username : `ID ${userId}`;
    if (!confirm(`Удалить жильца ${name} и всю историю его приборов учета без возможности восстановления?`)) return;
    try {
        const response = await fetch(`${API_URL}/admin/users/${userId}`, { method: "DELETE", headers: authHeaders() });
        if (!response.ok) throw new Error("Ошибка при удалении пользователя");
        showToast(`Жилец ${name} удален из базы`);
        document.getElementById("admin-user-meters-zone").innerHTML = `<p class="empty-note">Выберите учетную запись пользователя для вывода технической информации.</p>`;
        await loadAdminStats();
        await loadAdminRevenue();
        await loadAdminUsers();
    } catch (error) {
        showToast(error.message, "danger");
    }
}

async function exportAdminCSV() {
    const response = await fetch(`${API_URL}/admin/users`, { headers: authHeaders() });
    const users = await response.json();

    let csv = "ID;ФИО;Email;Улица;Дом;Кв;Этаж;Лимит/мес;Серийный номер;Услуга;Тариф;Показаний;Начислено\n";
    for (const user of users) {
        const metersResponse = await fetch(`${API_URL}/admin/users/${user.id}/meters`, { headers: authHeaders() });
        const meters = await metersResponse.json();
        const base = `${user.id};${user.username};${user.email};${user.street || ""};${user.house || ""};${user.apartment || ""};${user.floor || ""};${user.monthly_budget}`;
        if (meters.length === 0) {
            csv += `${base};—;—;0;0;0\n`;
        } else {
            meters.forEach(meter => {
                csv += `${base};${meter.serial_number};${meter.service_name};${meter.current_tariff};${meter.readings_count};${meter.total_cost}\n`;
            });
        }
    }
    downloadCSV(csv, "global_system_dump.csv");
    showToast("Глобальный дамп базы выгружен в CSV");
}

async function fetchDistrictAssignments(users) {
    const list = users || [];
    if (list.length === 0) return new Map();

    const payload = list.map(user => ({ id: user.id, street: user.street || null }));
    try {
        const response = await fetch(`${API_URL}/api/districts/assign`, {
            method: "POST",
            headers: authHeaders(true),
            body: JSON.stringify(payload)
        });
        if (!response.ok) return new Map();
        const results = await response.json();
        const byId = new Map();
        for (const item of results) {
            byId.set(item.id, { districtId: item.district_id, districtName: item.district_name });
        }
        return byId;
    } catch (error) {
        void error;
        return new Map();
    }
}

async function fetchDistrictCatalog() {
    const response = await fetch(`${API_URL}/api/districts`);
    if (!response.ok) return [];
    return response.json();
}

function renderResidentsByDistrict(users, assignments, districts) {
    const container = document.getElementById("districts-residents");
    if (!container) return;

    const grouped = new Map();
    for (const district of districts) grouped.set(district.id, []);
    for (const user of users || []) {
        const assignment = assignments.get(user.id);
        if (!assignment) continue;
        if (!grouped.has(assignment.districtId)) grouped.set(assignment.districtId, []);
        grouped.get(assignment.districtId).push(user);
    }

    if (!districts.length) {
        container.innerHTML = '<p class="empty-note">Не удалось загрузить список районов.</p>';
        return;
    }

    container.innerHTML = districts.map(district => {
        const residents = grouped.get(district.id) || [];
        const countLabel = residents.length + " " + pluralResidents(residents.length);
        const body = residents.length
            ? '<div class="item-list district-residents-list">' + residents.map(u => buildUserListRowHtml(u, { showBudget: true })).join("") + "</div>"
            : '<p class="empty-note district-empty">Нет зарегистрированных жильцов</p>';
        return '<section class="district-list-card" id="district-' + district.id + '">'
            + '<div class="district-list-head">'
            + "<h4>" + escapeHtml(district.name) + " район</h4>"
            + '<span class="district-count-pill">' + countLabel + "</span>"
            + "</div>"
            + body
            + "</section>";
    }).join("");
}

async function initResidentsByDistrict(users) {
    const container = document.getElementById("districts-residents");
    if (container) container.innerHTML = '<p class="empty-note">Загрузка районов...</p>';
    const list = users || [];
    try {
        const [districts, assignments] = await Promise.all([
            fetchDistrictCatalog(),
            fetchDistrictAssignments(list)
        ]);
        renderResidentsByDistrict(list, assignments, districts);
    } catch (error) {
        if (container) {
            container.innerHTML = '<p class="empty-note">Не удалось загрузить расселение по районам.</p>';
        }
        void error;
    }
}
