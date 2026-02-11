// ===== Global Dark Mode =====
// Apply saved theme immediately (also done inline in <head> to prevent flash)
(function() {
    if (localStorage.getItem('theme') === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark');
    }
})();

function toggleDarkMode() {
    const html = document.documentElement;
    const isDark = html.getAttribute('data-theme') === 'dark';
    if (isDark) {
        html.removeAttribute('data-theme');
        localStorage.setItem('theme', 'light');
    } else {
        html.setAttribute('data-theme', 'dark');
        localStorage.setItem('theme', 'dark');
    }
    updateThemeIcons();
}

function updateThemeIcons() {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    document.querySelectorAll('.theme-toggle').forEach(btn => {
        btn.textContent = isDark ? '☀️' : '🌙';
    });
}

document.addEventListener('DOMContentLoaded', function() {
    updateThemeIcons();

    // Auto-inject toggle button into navbars that don't have one yet
    const navButtons = document.querySelector('.nav-buttons');
    if (navButtons && !navButtons.querySelector('.theme-toggle')) {
        const btn = document.createElement('button');
        btn.className = 'theme-toggle';
        btn.onclick = toggleDarkMode;
        btn.title = 'الوضع الليلي';
        btn.textContent = document.documentElement.getAttribute('data-theme') === 'dark' ? '☀️' : '🌙';
        navButtons.insertBefore(btn, navButtons.firstChild);
    }

    // Also inject into mobile menus if they exist
    const mobileLinks = document.querySelector('.mobile-menu-links');
    if (mobileLinks && !mobileLinks.parentElement.querySelector('.theme-toggle')) {
        const wrapper = document.createElement('div');
        wrapper.style.cssText = 'display:flex;justify-content:center;margin:12px 0;';
        const btn2 = document.createElement('button');
        btn2.className = 'theme-toggle';
        btn2.onclick = toggleDarkMode;
        btn2.title = 'الوضع الليلي';
        btn2.textContent = document.documentElement.getAttribute('data-theme') === 'dark' ? '☀️' : '🌙';
        wrapper.appendChild(btn2);
        mobileLinks.parentElement.insertBefore(wrapper, mobileLinks.nextSibling);
    }
});
