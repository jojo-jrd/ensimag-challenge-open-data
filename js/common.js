document.addEventListener('DOMContentLoaded', function() {
    // Gestion du click sur le menu
    document.getElementById('menu-btn').addEventListener('click', () => {
        document.getElementById('mobile-menu').classList.toggle('hidden');
    });
}, false);