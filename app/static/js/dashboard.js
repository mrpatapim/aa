async function initDashboard() {
    if (!(await ensureAuthenticated())) return;

    const isAdmin = localStorage.getItem("isAdmin") === "true";
    const roleBadge = document.getElementById("sidebar-role");

    const dateInput = document.getElementById("reading-date");
    if (dateInput) {
        dateInput.value = getTodayLocalDateString();
        initReadingDateValidation();
    }

    if (isAdmin) {
        if (roleBadge) roleBadge.innerText = "Администратор системы";
        document.getElementById("menu-user-zones").style.display = "none";
        document.getElementById("menu-admin-zones").style.display = "flex";
        switchView("view-admin");
        await loadAdminStats();
        await loadAdminRevenue();
        await loadAdminUsers();
    } else {
        if (roleBadge) roleBadge.innerText = "Личный кабинет жильца";
        document.getElementById("menu-user-zones").style.display = "flex";
        document.getElementById("menu-admin-zones").style.display = "none";
        await loadServiceTypes();
        await loadMeters();
        await loadAnalyticsAndBudget();
        updateMobileTopbarTitle("view-dashboard");
    }

    window.addEventListener("resize", () => {
        if (window.innerWidth > 768) closeMobileNav();
    });
}

function initReadingDateValidation() {
    const input = document.getElementById("reading-date");
    const submitBtn = document.getElementById("reading-submit-btn");
    const errorEl = document.getElementById("reading-date-error");
    if (!input || !submitBtn) return;

    input.max = getTodayLocalDateString();

    const validateReadingDate = () => {
        const value = input.value;
        const valid = isReadingDateValid(value);

        submitBtn.disabled = !valid;

        if (!errorEl) return valid;

        if (!valid && value) {
            errorEl.hidden = false;
            errorEl.textContent = READING_DATE_FUTURE_ERROR;
            input.setAttribute("aria-invalid", "true");
        } else {
            errorEl.hidden = true;
            errorEl.textContent = "";
            input.removeAttribute("aria-invalid");
        }

        return valid;
    };

    input.addEventListener("input", validateReadingDate);
    input.addEventListener("change", validateReadingDate);
    validateReadingDate();
}
