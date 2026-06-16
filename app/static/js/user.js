let trendChart = null;

async function promptBudgetUpdate() {
    const input = prompt("Установите лимит расходов на месяц (₽):", "5000");
    if (input === null) return;
    const budget = parseFloat(input);
    if (isNaN(budget) || budget < 0) {
        showToast("Введите корректное числовое значение лимита", "danger");
        return;
    }
    await fetch(`${API_URL}/users/me/budget`, {
        method: "PUT",
        headers: authHeaders(true),
        body: JSON.stringify({ budget })
    });
    showToast("Лимит бюджета успешно обновлен");
    await loadAnalyticsAndBudget();
}

async function loadServiceTypes() {
    const response = await fetch(`${API_URL}/bills/service-types`, { headers: authHeaders() });
    const types = await response.json();
    const select = document.getElementById("meter-service-type");
    if (!select) return;
    select.innerHTML = "";
    types.forEach(type => {
        const option = document.createElement("option");
        option.value = type.id;
        option.textContent = `${type.name} (${type.unit})`;
        select.appendChild(option);
    });
}

async function loadMeters() {
    const response = await fetch(`${API_URL}/bills/meters`, { headers: authHeaders() });
    const meters = await response.json();

    const countBadge = document.getElementById("kpi-active-meters");
    if (countBadge) countBadge.innerText = meters.length;

    const readingSelect = document.getElementById("reading-meter-id");
    if (readingSelect) {
        const selectedMeterId = readingSelect.value;
        readingSelect.innerHTML = "";
        meters.forEach(meter => {
            const option = document.createElement("option");
            option.value = meter.id;
            option.textContent = `Прибор №${meter.serial_number}`;
            readingSelect.appendChild(option);
        });
        if (selectedMeterId && meters.some(m => String(m.id) === selectedMeterId)) {
            readingSelect.value = selectedMeterId;
        }
    }

    populateJournalMeterFilter(meters);
    checkSmartAlerts(meters);
}

function populateJournalMeterFilter(meters) {
    const filter = document.getElementById("journal-meter-filter");
    if (!filter) return;

    const previousValue = filter.value || "all";
    filter.innerHTML = '<option value="all">Все приборы</option>';
    meters.forEach(meter => {
        const option = document.createElement("option");
        option.value = meter.id;
        option.textContent = `Прибор №${meter.serial_number}`;
        filter.appendChild(option);
    });

    const hasPrevious = previousValue === "all" || meters.some(m => String(m.id) === previousValue);
    filter.value = hasPrevious ? previousValue : "all";
    loadReadingHistory();
}

function renderReadingHistoryRows(readings, listDiv) {
    listDiv.innerHTML = "";
    if (readings.length === 0) {
        listDiv.innerHTML = `<p class="empty-note">Показания не найдены.</p>`;
        return;
    }

    readings.forEach(reading => {
        const date = new Date(reading.recorded_at).toLocaleDateString("ru-RU");
        const row = document.createElement("div");
        row.className = "list-row";
        row.innerHTML = `
            <div>
                <div class="row-title">${escapeHtml(reading.service_name)} [№${escapeHtml(reading.serial_number)}]</div>
                <div class="row-accent">Показание: ${reading.reading_value} ${escapeHtml(reading.unit)}</div>
                <div class="row-meta">Дата: ${date} · Начислено: ${formatMoney(reading.calculated_cost)}</div>
            </div>
            <button class="btn-danger btn-mini" onclick="deleteReading(${reading.id})">Удалить</button>`;
        listDiv.appendChild(row);
    });
}

async function fetchMeterReadings(meterId) {
    const response = await fetch(`${API_URL}/bills/meters/${meterId}/readings`, { headers: authHeaders() });
    if (!response.ok) return [];
    return response.json();
}

async function checkSmartAlerts(meters) {
    const alertsZone = document.getElementById("smart-alerts-zone");
    if (!alertsZone) return;
    alertsZone.innerHTML = "";

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    for (const meter of meters) {
        const response = await fetch(`${API_URL}/bills/meters/${meter.id}/readings`, { headers: authHeaders() });
        const readings = await response.json();

        let needsAlert = false;
        if (readings.length === 0) {
            needsAlert = true;
        } else {
            const lastReadingDate = new Date(readings[readings.length - 1].recorded_at);
            if (lastReadingDate < thirtyDaysAgo) needsAlert = true;
        }

        if (needsAlert) {
            const banner = document.createElement("div");
            banner.className = "alert-banner";
            banner.innerHTML = `
                <span>⚠️ По счетчику №${escapeHtml(meter.serial_number)} более 30 дней не передавались показания.</span>
                <button class="btn-mini" onclick="switchView('view-meters')">Передать сейчас</button>`;
            alertsZone.appendChild(banner);
        }
    }
}

async function handleCreateMeter(event) {
    event.preventDefault();
    try {
        const response = await fetch(`${API_URL}/bills/meters`, {
            method: "POST",
            headers: authHeaders(true),
            body: JSON.stringify({
                service_type_id: parseInt(document.getElementById("meter-service-type").value, 10),
                serial_number: document.getElementById("meter-serial").value.trim(),
                current_tariff: parseFloat(document.getElementById("meter-tariff").value)
            })
        });
        if (!response.ok) throw new Error("Прибор с таким серийным номером уже существует");
        showToast("Новый счетчик добавлен в систему");
        document.getElementById("meter-serial").value = "";
        document.getElementById("meter-tariff").value = "";
        await loadMeters();
        await loadAnalyticsAndBudget();
    } catch (error) {
        showToast(error.message, "danger");
    }
}

async function handleAddReading(event) {
    event.preventDefault();
    const meterId = document.getElementById("reading-meter-id").value;
    if (!meterId) {
        showToast("Сначала зарегистрируйте прибор учета", "danger");
        return;
    }
    const chosenDate = document.getElementById("reading-date").value;
    if (!isReadingDateValid(chosenDate)) {
        showToast(READING_DATE_FUTURE_ERROR, "danger");
        return;
    }
    const payloadDate = `${chosenDate}T12:00:00`;
    try {
        const response = await fetch(`${API_URL}/bills/meters/${meterId}/readings`, {
            method: "POST",
            headers: authHeaders(true),
            body: JSON.stringify({
                reading_value: parseFloat(document.getElementById("reading-value").value),
                recorded_at: payloadDate
            })
        });
        if (!response.ok) {
            const errorBody = await response.json();
            throw new Error(parseApiErrorDetail(errorBody.detail));
        }
        showToast("Показание прибора зафиксировано");
        document.getElementById("reading-value").value = "";
        await loadReadingHistory();
        await loadAnalyticsAndBudget();
        await loadMeters();
    } catch (error) {
        showToast(error.message, "danger");
    }
}

async function loadReadingHistory() {
    const filterEl = document.getElementById("journal-meter-filter");
    const listDiv = document.getElementById("readings-history-list");
    if (!listDiv) return;

    const filterValue = filterEl ? filterEl.value : "all";
    let readings = [];

    if (filterValue === "all") {
        const metersResponse = await fetch(`${API_URL}/bills/meters`, { headers: authHeaders() });
        const meters = await metersResponse.json();
        for (const meter of meters) {
            const meterReadings = await fetchMeterReadings(meter.id);
            readings.push(...meterReadings);
        }
        readings.sort((a, b) => new Date(b.recorded_at) - new Date(a.recorded_at));
    } else {
        const meterReadings = await fetchMeterReadings(filterValue);
        readings = meterReadings.slice().reverse();
    }

    renderReadingHistoryRows(readings, listDiv);
}

async function deleteReading(readingId) {
    if (!confirm("Удалить выбранную запись показания?")) return;
    await fetch(`${API_URL}/bills/readings/${readingId}`, { method: "DELETE", headers: authHeaders() });
    showToast("Запись удалена");
    await loadReadingHistory();
    await loadAnalyticsAndBudget();
    await loadMeters();
}

async function exportUserCSV() {
    const metersResponse = await fetch(`${API_URL}/bills/meters`, { headers: authHeaders() });
    const meters = await metersResponse.json();

    let csv = "Серийный номер;Услуга;Дата фиксации;Показание;Расход;Начислено (руб)\n";
    for (const meter of meters) {
        const response = await fetch(`${API_URL}/bills/meters/${meter.id}/readings`, { headers: authHeaders() });
        const readings = await response.json();
        readings.forEach(reading => {
            const date = new Date(reading.recorded_at).toLocaleDateString("ru-RU");
            csv += `${reading.serial_number};${reading.service_name};${date};${reading.reading_value};${reading.consumed_volume};${reading.calculated_cost}\n`;
        });
    }
    downloadCSV(csv, "my_bills_history.csv");
    showToast("Личная выписка выгружена в CSV");
}

async function loadAnalyticsAndBudget() {
    const userResponse = await fetch(`${API_URL}/users/me`, { headers: authHeaders() });
    const userData = await userResponse.json();
    const budget = Number(userData.monthly_budget) || 0;

    const response = await fetch(`${API_URL}/analytics/summary`, { headers: authHeaders() });
    const data = await response.json();

    const totalSpent = data.summary_by_service.reduce((sum, service) => sum + service.total_spent, 0);
    const spentBadge = document.getElementById("kpi-total-spent");
    if (spentBadge) spentBadge.innerText = formatMoney(totalSpent);

    const trend = data.monthly_trend || {};
    const monthKeys = Object.keys(trend).sort();
    const currentMonthSpent = monthKeys.length ? trend[monthKeys[monthKeys.length - 1]] : 0;

    renderBudget(currentMonthSpent, budget);
    renderServiceSummary(data.summary_by_service);
    renderTrendChart(monthKeys, monthKeys.map(key => trend[key]));
}

function renderBudget(spent, budget) {
    const card = document.getElementById("budget-card");
    if (!card) return;
    card.style.display = "block";

    document.getElementById("budget-text-spent").innerText = `Начислено за месяц: ${formatMoney(spent)}`;
    document.getElementById("budget-text-limit").innerText = budget > 0 ? `Лимит: ${formatMoney(budget)}` : "Лимит не задан";

    const bar = document.getElementById("budget-progress");
    const pill = document.getElementById("budget-status");
    const percent = budget > 0 ? (spent / budget) * 100 : 0;
    bar.style.width = `${clamp(percent, 0, 100)}%`;

    let color = "var(--text-soft)";
    let label = "Лимит не установлен";
    if (budget > 0) {
        if (percent < 70) {
            color = "var(--success)";
            label = `${Math.round(percent)}% · В пределах лимита`;
        } else if (percent < 100) {
            color = "var(--warning)";
            label = `${Math.round(percent)}% · Приближение к лимиту`;
        } else {
            color = "var(--danger)";
            label = `${Math.round(percent)}% · Лимит превышен`;
        }
    }
    bar.style.background = color;
    pill.style.color = color;
    pill.innerText = label;
}

function renderServiceSummary(summary) {
    const summaryDiv = document.getElementById("analytics-summary");
    if (!summaryDiv) return;
    summaryDiv.innerHTML = "";
    if (!summary || summary.length === 0) {
        summaryDiv.innerHTML = `<p class="empty-note">Нет данных для формирования аналитики.</p>`;
        return;
    }
    summary.forEach(service => {
        const row = document.createElement("div");
        row.className = "list-row";
        row.innerHTML = `
            <span class="row-title">${escapeHtml(service.service_name)}</span>
            <span class="row-value">${formatMoney(service.total_spent)}
                <span class="row-meta" style="display:inline; margin:0;">(${service.total_volume} ${escapeHtml(service.unit)})</span>
            </span>`;
        summaryDiv.appendChild(row);
    });
}

function renderTrendChart(labels, values) {
    const canvas = document.getElementById("trendChart");
    if (!canvas || typeof Chart === "undefined") return;
    const ctx = canvas.getContext("2d");
    if (trendChart) trendChart.destroy();

    const gradient = ctx.createLinearGradient(0, 0, 0, 260);
    gradient.addColorStop(0, "rgba(37, 99, 235, 0.28)");
    gradient.addColorStop(1, "rgba(37, 99, 235, 0.02)");

    trendChart = new Chart(ctx, {
        type: "line",
        data: {
            labels,
            datasets: [{
                label: "Начисления (₽)",
                data: values,
                borderColor: "#1d4ed8",
                backgroundColor: gradient,
                tension: 0.3,
                fill: true,
                borderWidth: 2.5,
                pointBackgroundColor: "#1d4ed8",
                pointBorderColor: "#ffffff",
                pointBorderWidth: 2,
                pointRadius: 4,
                pointHoverRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { beginAtZero: true, grid: { color: "#e6edf9" }, ticks: { color: "#5d6b88" } },
                x: { grid: { display: false }, ticks: { color: "#5d6b88" } }
            }
        }
    });
}

async function loadForecast() {
    const metersResponse = await fetch(`${API_URL}/bills/meters`, { headers: authHeaders() });
    const meters = await metersResponse.json();
    const resultDiv = document.getElementById("forecast-result");
    if (!resultDiv) return;
    resultDiv.innerHTML = "";

    if (meters.length === 0) {
        resultDiv.innerHTML = `<p class="empty-note">Сначала зарегистрируйте приборы учета и внесите показания.</p>`;
        return;
    }

    let hasCalculations = false;
    for (const meter of meters) {
        const response = await fetch(`${API_URL}/forecast/${meter.id}`, { headers: authHeaders() });
        const row = document.createElement("div");
        if (response.ok) {
            hasCalculations = true;
            const forecast = await response.json();
            row.className = "list-row";
            row.style.borderLeft = "4px solid var(--primary)";
            row.innerHTML = `
                <div>
                    <div class="row-title">${escapeHtml(forecast.service_name)} [№${escapeHtml(meter.serial_number)}]</div>
                    <div class="row-meta">Прогноз объема: ${forecast.predicted_volume} ед. · ${escapeHtml(forecast.confidence)}</div>
                </div>
                <div class="row-value">~ ${formatMoney(forecast.predicted_cost)}</div>`;
        } else {
            row.className = "list-row";
            row.style.borderLeft = "4px solid var(--warning)";
            row.innerHTML = `<div class="row-meta">Счетчик №${escapeHtml(meter.serial_number)}: требуется минимум 3 показания для построения тренда.</div>`;
        }
        resultDiv.appendChild(row);
    }
    if (hasCalculations) showToast("Предиктивная модель сформирована");
}
