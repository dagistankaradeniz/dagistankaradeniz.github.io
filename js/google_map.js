;(function () {
    'use strict';

    function initMap() {
        var el = document.getElementById('map');
        if (!el || typeof L === 'undefined') return;

        var map = L.map('map', {
            scrollWheelZoom: false
        });
        map.setView([51.5074, -0.1278], 11);

        L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions" target="_blank" rel="noopener noreferrer">CARTO</a>',
            subdomains: 'abcd',
            maxZoom: 20
        }).addTo(map);


    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initMap);
    } else {
        initMap();
    }
}());
