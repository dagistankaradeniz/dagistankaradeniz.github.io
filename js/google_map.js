
var google;

function init() {
    var myLatlng = new google.maps.LatLng(51.5287714,-0.2420237);

    var mapOptions = {
        zoom: 10,
        center: myLatlng,
        scrollwheel: false,
        colorScheme: google.maps.ColorScheme.DARK
    };

    var mapElement = document.getElementById('map');
    var map = new google.maps.Map(mapElement, mapOptions);

    var addresses = ['London'];

    for (var x = 0; x < addresses.length; x++) {
        $.getJSON('https://maps.googleapis.com/maps/api/geocode/json?address=' + addresses[x], null, function (data) {
            var p = data.results[0].geometry.location;
            var latlng = new google.maps.LatLng(p.lat, p.lng);
            new google.maps.Marker({
                position: latlng,
                map: map,
                icon: 'images/pin.png'
            });
        });
    }
}

google.maps.event.addDomListener(window, 'load', init);