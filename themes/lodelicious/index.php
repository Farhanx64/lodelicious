<?php
/**
 * Fallback template.
 *
 * @package Lodelicious
 */

defined( 'ABSPATH' ) || exit;

get_header();
?>
<div class="ldl-wrap">
	<?php if ( have_posts() ) : ?>
		<?php
		while ( have_posts() ) :
			the_post();
			?>
			<article id="post-<?php the_ID(); ?>" <?php post_class(); ?>>
				<?php if ( is_singular() ) : ?>
					<h1><?php the_title(); ?></h1>
				<?php else : ?>
					<h2><a href="<?php the_permalink(); ?>"><?php the_title(); ?></a></h2>
				<?php endif; ?>
				<div class="entry-content"><?php the_content(); ?></div>
			</article>
		<?php endwhile; ?>
	<?php else : ?>
		<h1><?php esc_html_e( 'Nothing here yet', 'lodelicious' ); ?></h1>
		<p><?php esc_html_e( 'This page has no content yet.', 'lodelicious' ); ?></p>
	<?php endif; ?>
</div>
<?php
get_footer();
