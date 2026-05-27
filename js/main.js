;(function () {
	
	'use strict';

	var isMobile = {
		Android: function() {
			return navigator.userAgent.match(/Android/i);
		},
			BlackBerry: function() {
			return navigator.userAgent.match(/BlackBerry/i);
		},
			iOS: function() {
			return navigator.userAgent.match(/iPhone|iPad|iPod/i);
		},
			Opera: function() {
			return navigator.userAgent.match(/Opera Mini/i);
		},
			Windows: function() {
			return navigator.userAgent.match(/IEMobile/i);
		},
			any: function() {
			return (isMobile.Android() || isMobile.BlackBerry() || isMobile.iOS() || isMobile.Opera() || isMobile.Windows());
		}
	};

	
	var fullHeight = function() {

		if ( !isMobile.any() ) {
			$('.js-fullheight').css('height', $(window).height());
			$(window).resize(function(){
				$('.js-fullheight').css('height', $(window).height());
			});
		}
	};

	// Parallax
	var parallax = function() {
		if (isMobile.iOS()) {
			// iOS Safari ignores background-attachment:fixed, so stellar has no effect.
			// Instead, move the background into an absolutely-positioned child div and
			// drive it with translateY on every scroll tick (passive listener = no jank).
			var $hero  = $('#fh5co-header');
			var bgImage = $hero[0].style.backgroundImage;          // inline style value
			var ratio   = parseFloat($hero.data('stellar-background-ratio')) || 0.5;

			// Strip the bg from the element; the child div will own it.
			$hero.css({ 'background-image': 'none', 'overflow': 'hidden' });

			// Build the oversized parallax layer (25 % bleed on each side = room to move).
			var $bg = $('<div class="ios-parallax-bg"></div>').css({
				'background-image'   : bgImage,
				'background-size'    : 'cover',
				'background-position': 'center center',
				'background-repeat'  : 'no-repeat',
				'position'           : 'absolute',
				'top'                : '-25%',
				'left'               : '0',
				'right'              : '0',
				'height'             : '150%',
				'will-change'        : 'transform',
				'z-index'            : '0',
				'pointer-events'     : 'none'
			});

			// Keep overlay and content above the bg layer.
			$hero.find('.overlay').css('z-index', '1');
			$hero.find('.container').css({ 'position': 'relative', 'z-index': '2' });

			$hero.prepend($bg);

			var ticking = false;
			function updateParallax() {
				var scrollTop = window.pageYOffset || document.documentElement.scrollTop || 0;
				$bg[0].style.transform = 'translateY(' + (scrollTop * ratio) + 'px)';
				ticking = false;
			}

			window.addEventListener('scroll', function () {
				if (!ticking) {
					requestAnimationFrame(updateParallax);
					ticking = true;
				}
			}, { passive: true });

			updateParallax(); // set initial position
		} else {
			$(window).stellar();
		}
	};

	var contentWayPoint = function() {
		var i = 0;
		$('.animate-box').waypoint( function( direction ) {

			if( direction === 'down' && !$(this.element).hasClass('animated-fast') ) {
				
				i++;

				$(this.element).addClass('item-animate');
				setTimeout(function(){

					$('body .animate-box.item-animate').each(function(k){
						var el = $(this);
						setTimeout( function () {
							var effect = el.data('animate-effect');
							if ( effect === 'fadeIn') {
								el.addClass('fadeIn animated-fast');
							} else if ( effect === 'fadeInLeft') {
								el.addClass('fadeInLeft animated-fast');
							} else if ( effect === 'fadeInRight') {
								el.addClass('fadeInRight animated-fast');
							} else {
								el.addClass('fadeInUp animated-fast');
							}

							el.removeClass('item-animate');
						},  k * 100, 'easeInOutExpo' );
					});
					
				}, 50);
				
			}

		} , { offset: '85%' } );
	};



	var goToTop = function() {

		$('.js-gotop').on('click', function(event){
			
			event.preventDefault();

			$('html, body').animate({
				scrollTop: $('html').offset().top
			}, 500, 'easeInOutExpo');
			
			return false;
		});

		$(window).scroll(function(){

			var $win = $(window);
			if ($win.scrollTop() > 200) {
				$('.js-top').addClass('active');
			} else {
				$('.js-top').removeClass('active');
			}

		});
	
	};

	var pieChart = function() {
		$('.chart').easyPieChart({
			scaleColor: false,
			lineWidth: 4,
			lineCap: 'butt',
			barColor: '#00C899',
			trackColor:	"#f5f5f5",
			size: 160,
			animate: 1000
		});
	};

	var skillsWayPoint = function() {
		if ($('#fh5co-skills').length > 0 ) {
			$('#fh5co-skills').waypoint( function( direction ) {
										
				if( direction === 'down' && !$(this.element).hasClass('animated') ) {
					setTimeout( pieChart , 400);					
					$(this.element).addClass('animated');
				}
			} , { offset: '90%' } );
		}

	};


	// Loading page
	var loaderPage = function() {
		$(".fh5co-loader").fadeOut("slow");
	};

	
	$(function(){
		contentWayPoint();
		goToTop();
		loaderPage();
		fullHeight();
		parallax();
		// pieChart();
		skillsWayPoint();
	});


}());