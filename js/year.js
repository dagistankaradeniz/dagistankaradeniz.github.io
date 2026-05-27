(function () {
	var londonYear = new Intl.DateTimeFormat('en-GB', {
		year: 'numeric',
		timeZone: 'Europe/London'
	}).format(new Date());
	var el = document.getElementById('footer-year');
	if (el) el.textContent = londonYear;
	document.title = document.title.replace(/\d{4}/, londonYear);
})();
