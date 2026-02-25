	<?php 
		$kowine_settings = kowine_global_settings();
		$cart_layout = kowine_get_config('cart-layout','dropdown');
		$cart_style = kowine_get_config('cart-style','light');
		$show_minicart = (isset($kowine_settings['show-minicart']) && $kowine_settings['show-minicart']) ? ($kowine_settings['show-minicart']) : false;
		$show_compare = (isset($kowine_settings['show-compare']) && $kowine_settings['show-compare']) ? ($kowine_settings['show-compare']) : false;
		$enable_sticky_header = ( isset($kowine_settings['enable-sticky-header']) && $kowine_settings['enable-sticky-header'] ) ? ($kowine_settings['enable-sticky-header']) : false;
		$show_searchform = (isset($kowine_settings['show-searchform']) && $kowine_settings['show-searchform']) ? ($kowine_settings['show-searchform']) : false;
		$show_wishlist = (isset($kowine_settings['show-wishlist']) && $kowine_settings['show-wishlist']) ? ($kowine_settings['show-wishlist']) : false;
		$show_currency = (isset($kowine_settings['show-currency']) && $kowine_settings['show-currency']) ? ($kowine_settings['show-currency']) : false;
		$show_menutop = (isset($kowine_settings['show-menutop']) && $kowine_settings['show-menutop']) ? ($kowine_settings['show-menutop']) : false;
	?>
	<h1 class="bwp-title hide"><a href="<?php echo esc_url( home_url( '/' ) ); ?>" rel="home"><?php bloginfo( 'name' ); ?></a></h1>
	<header id='bwp-header' class="bwp-header header-v1">
		<?php kowine_campbar(); ?>
		<?php if(isset($kowine_settings['show-header-top']) && $kowine_settings['show-header-top']){ ?>
		<div id="bwp-topbar" class="topbar-v1 hidden-sm hidden-xs">
			<div class="topbar-inner">
				<div class="container">
					<div class="row">
						<div class="col-xl-6 col-lg-6 col-md-6 col-sm-6 topbar-left hidden-sm hidden-xs">
							<?php if( isset($kowine_settings['phone']) && $kowine_settings['phone'] ) : ?>
							<div class="phone hidden-xs">
								<i class="icon2-telephone"></i><a href="tel:<?php echo esc_attr($kowine_settings['phone']); ?>"><?php echo esc_attr($kowine_settings['phone']); ?></a>
							</div>
							<?php endif; ?>
							<?php if( isset($kowine_settings['email']) && $kowine_settings['email'] ) : ?>
							<div class="email hidden-xs">
								<i class="icon-email"></i><a href="mailto:<?php echo esc_attr($kowine_settings['email']); ?>"><?php echo esc_html($kowine_settings['email']); ?></a>
							</div>
							<?php endif; ?>
						</div>
						<div class="col-xl-6 col-lg-6 col-md-12 col-sm-12 col-12 topbar-right">
							<?php echo do_shortcode( "[social_link]" ) ?>
						</div>
					</div>
				</div>
			</div>
		</div>
		<?php } ?>
		<?php kowine_menu_mobile(); ?>
		<div class="header-desktop">
			<?php if(($show_minicart || $show_wishlist || $show_searchform || is_active_sidebar('top-link')) && class_exists( 'WooCommerce' ) ){ ?>
			<div class='header-wrapper' data-sticky_header="<?php echo esc_attr($kowine_settings['enable-sticky-header']); ?>">
				<div class="container">
					<div class="row">
						<div class="col-xl-3 col-lg-3 col-md-12 col-sm-12 col-12 header-left">
							<?php kowine_header_logo(); ?>
						</div>
						<div class="col-xl-6 col-lg-6 col-md-12 col-sm-12 col-12 header-center">
							<div class="header-search-form hidden-sm hidden-xs">
								<!-- Begin Search -->
								<?php if($show_searchform && class_exists( 'WooCommerce' )){ ?>
									<?php get_template_part( 'search-form' ); ?>
								<?php } ?>
								<!-- End Search -->	
							</div>
						</div>
						<div class="col-xl-3 col-lg-3 col-md-12 col-sm-12 col-12 header-right">
							<div class="header-page-link">
								<div class="login-header">
									<?php if (is_user_logged_in()) { ?>
										<a href="<?php echo wp_logout_url( get_permalink( wc_get_page_id( 'myaccount' ) ) ); ?>"><?php echo esc_html__('Logout', 'kowine')?></a>
									<?php }else{ ?>
										<a class="active-login" href="#" ><?php echo esc_html__('LOGIN / REGISTER', 'kowine')?></a>
										<?php kowine_login_form(); ?>
									<?php } ?>
								</div>	
								<?php if($show_wishlist && class_exists( 'WPCleverWoosw' )){ ?>
								<div class="wishlist-box">
									<a href="<?php
									    if (is_rtl()) {
									        echo esc_url(str_replace('/favorites/', '/he/favorites/', WPcleverWoosw::get_url()));
									    } else {
									        echo esc_url(WPcleverWoosw::get_url());
									    }
									?>"><i class="icon2-heart"></i></a>
								</div>
								<?php } ?>
								<?php if($show_minicart && class_exists( 'WooCommerce' )){ ?>
								<div class="kowine-topcart <?php echo esc_attr($cart_layout); ?> <?php echo esc_attr($cart_style); ?>">
									<?php get_template_part( 'woocommerce/minicart-ajax' ); ?>
								</div>
								<?php } ?>
							</div>
						</div>
					</div>
				</div>
			</div><!-- End header-wrapper -->
			<div class="header-bottom">
				<div class="container">
					<div class="content-header">
						<div class="wpbingo-menu-mobile header-menu">
							<div class="header-menu-bg">
								<?php kowine_top_menu(); ?>
							</div>
						</div>
						<?php if( isset($kowine_settings['shipping']) && $kowine_settings['shipping'] ) : ?>
							<div class="shipping hidden-xs">
								<?php echo wp_kses($kowine_settings['shipping'],'social'); ?>
							</div>
						<?php endif; ?>
					</div>
				</div>
			</div>
			<?php }else{ ?>
				<div class="header-normal">
					<div class='header-wrapper' data-sticky_header="<?php echo esc_attr($kowine_settings['enable-sticky-header']); ?>">
						<div class="container">
							<div class="row">
								<div class="col-xl-3 col-lg-3 col-md-6 col-sm-6 col-6 header-left">
									<?php kowine_header_logo(); ?>
								</div>
								<div class="col-xl-9 col-lg-9 col-md-6 col-sm-6 col-6 header-main">
									<div class="header-menu-bg">
										<?php kowine_top_menu(); ?>
									</div>
								</div>
							</div>
						</div>
					</div>
				</div>
			<?php } ?>
		</div>
	</header><!-- End #bwp-header -->