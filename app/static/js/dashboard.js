async function initDashboard() {
    if (!(await ensureAuthenticated())) return;

    const isAdmin = localStorage.getItem("isAdmin") === "true";
    const roleBadge = document.getElementById("sidebar-role");

    const dateInput = document.getElementById("reading-date");
    if (dateInput) {
        dateInput.value = new Date().toISOString().split("T")[0];
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
    }
}
