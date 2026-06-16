const API_URL = "";
const BLUE_SCALE = ["#0b1f4d", "#1e40af", "#1d4ed8", "#2563eb", "#3b82f6", "#0ea5e9", "#60a5fa", "#93c5fd"];

function authHeaders(json) {
    const token = localStorage.getItem("token");
    const headers = { Authorization: `Bearer ${token}` };
    if (json) headers["Content-Type"] = "application/json";
    return headers;
}

async function ensureAuthenticated() {
    const token = localStorage.getItem("token");
    if (!token) {
        window.location.replace("/");
        return false;
    }
    try {
        const response = await fetch(`${API_URL}/users/me`, {
            headers: authHeaders(),
            credentials: "include"
        });
        if (!response.ok) throw new Error("unauthorized");
        return true;
    } catch {
        localStorage.clear();
        window.location.replace("/");
        return false;
    }
}

function showToast(message, type = "success") {
    const container = document.getElementById("toast-container");
    if (!container) return;
    const toast = document.createElement("div");
    toast.className = `toast ${type === "success" ? "success" : "danger"}`;
    toast.innerText = message;
    container.appendChild(toast);
    setTimeout(() => { toast.remove(); }, 3200);
}

function escapeHtml(value) {
    return String(value == null ? "" : value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function formatMoney(value) {
    const number = Number(value) || 0;
    return number.toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " ₽";
}

function composeAddress(user) {
    let address = user.street || "Адрес не указан";
    if (user.house) address += `, д. ${user.house}`;
    if (user.apartment) address += `, кв. ${user.apartment}`;
    if (user.floor) address += `, эт. ${user.floor}`;
    return address;
}

function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

function switchTab(tab) {
    const loginForm = document.getElementById("login-form");
    const registerForm = document.getElementById("register-form");
    const loginTab = document.getElementById("tab-login");
    const registerTab = document.getElementById("tab-register");
    if (tab === "login") {
        loginForm.style.display = "flex";
        registerForm.style.display = "none";
        loginTab.classList.add("active");
        registerTab.classList.remove("active");
    } else {
        loginForm.style.display = "none";
        registerForm.style.display = "flex";
        loginTab.classList.remove("active");
        registerTab.classList.add("active");
    }
}

function switchView(viewId) {
    document.querySelectorAll(".view-section").forEach(view => view.classList.remove("active"));
    document.querySelectorAll(".menu-item").forEach(item => item.classList.remove("active"));
    const targetView = document.getElementById(viewId);
    if (targetView) targetView.classList.add("active");
    const triggeredBtn = document.querySelector(`[onclick="switchView('${viewId}')"]`);
    if (triggeredBtn) triggeredBtn.classList.add("active");
}

function downloadCSV(csvContent, filename) {
    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

function setText(id, value) {
    const element = document.getElementById(id);
    if (element) element.innerText = value;
}

async function logout() {
    try {
        await fetch(`${API_URL}/logout`, { method: "POST", credentials: "include" });
    } catch (error) {
        void error;
    }
    localStorage.clear();
    window.location.href = "/";
}

function pluralResidents(count) {
    const mod10 = count % 10;
    const mod100 = count % 100;
    if (mod10 === 1 && mod100 !== 11) return "жилец";
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return "жильца";
    return "жильцов";
}

const READING_DATE_FUTURE_ERROR = "Некорректная дата: нельзя указывать дату в будущем";

function getTodayLocalDateString() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

function isReadingDateValid(dateValue) {
    if (!dateValue) return false;
    return dateValue <= getTodayLocalDateString();
}

function parseApiErrorDetail(detail) {
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail) && detail.length) {
        const first = detail[0];
        if (typeof first === "string") return first;
        if (first && typeof first.msg === "string") return first.msg;
    }
    return "Ошибка выполнения запроса";
}
