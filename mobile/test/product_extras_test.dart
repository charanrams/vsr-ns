import 'package:flutter_test/flutter_test.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:vsr_customer/features/catalog/product_extras.dart';

import 'auth_flow_test.dart' show pumpScreen;

void main() {
  setUpAll(() => GoogleFonts.config.allowRuntimeFetching = false);

  testWidgets('gallery shows position and thumbnails for multiple images', (t) async {
    await pumpScreen(t, const GalleryScreen(images: ['https://x/a.jpg', 'https://x/b.jpg'], initial: 1));
    expect(find.text('2 / 2'), findsOneWidget);
    expect(find.text('Pinch to zoom'), findsOneWidget);
  });

  testWidgets('unavailable product offers a way out', (t) async {
    await pumpScreen(t, const ProductUnavailableView());
    expect(find.text('This product isn’t available'), findsOneWidget);
    expect(find.text('Browse Categories'), findsOneWidget);
  });

  testWidgets('review success differs for edits', (t) async {
    await pumpScreen(t, const ReviewSuccessScreen(edited: true));
    expect(find.text('Review updated'), findsOneWidget);
  });
}
