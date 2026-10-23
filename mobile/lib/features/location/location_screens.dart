import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geocoding/geocoding.dart' as geo;
import 'package:geolocator/geolocator.dart';
import 'package:go_router/go_router.dart';
import 'package:latlong2/latlong.dart';
import 'package:location/location.dart' as device;

import '../../core/models.dart';
import '../../core/theme.dart';
import '../../state/providers.dart';
import '../../widgets/common.dart';
import '../../widgets/status_screen.dart';

/// Default map centre when no fix is available (Hyderabad, the launch city).
const _fallback = LatLng(17.4486, 78.3908);

// Platform geocoder (Android Geocoder / Apple CLGeocoder); created lazily.
geo.Geocoding? _geocoder;
geo.Geocoding get _geo => _geocoder ??= geo.Geocoding();

enum LocateResult { ok, denied, deniedForever, serviceOff, failed }

/// Asks for permission (34) only after the explanation screen, then gets one fix.
Future<(LocateResult, LatLng?)> locateOnce() async {
  try {
    return await _locate();
  } catch (_) {
    // e.g. a permission request already in progress, or the platform service unavailable
    return (LocateResult.failed, null);
  }
}

Future<(LocateResult, LatLng?)> _locate() async {
  // GPS off → Android's in-app "Turn on device location?" dialog (no trip to Settings)
  if (!await Geolocator.isLocationServiceEnabled() && !await turnOnLocationInApp()) return (LocateResult.serviceOff, null);
  var perm = await Geolocator.checkPermission();
  if (perm == LocationPermission.denied) perm = await Geolocator.requestPermission();
  if (perm == LocationPermission.denied) return (LocateResult.denied, null);
  if (perm == LocationPermission.deniedForever) return (LocateResult.deniedForever, null);
  try {
    final p = await Geolocator.getCurrentPosition(locationSettings: const LocationSettings(accuracy: LocationAccuracy.high, timeLimit: Duration(seconds: 15)));
    return (LocateResult.ok, LatLng(p.latitude, p.longitude));
  } catch (_) {
    final last = await Geolocator.getLastKnownPosition();
    return last == null ? (LocateResult.failed, null) : (LocateResult.ok, LatLng(last.latitude, last.longitude));
  }
}

/// Shows the system "Turn on device location?" dialog inside the app. True when location is on.
Future<bool> turnOnLocationInApp() async {
  try {
    return await device.Location().requestService();
  } catch (_) {
    return false;
  }
}

/// Runs [locateOnce] and routes to the right screen for each outcome.
Future<void> useCurrentLocation(BuildContext context) async {
  final (r, pos) = await locateOnce();
  if (!context.mounted) return;
  switch (r) {
    case LocateResult.ok:
      context.push('/location/map', extra: pos);
    case LocateResult.denied:
    case LocateResult.deniedForever:
      context.push('/location/denied', extra: r == LocateResult.deniedForever);
    case LocateResult.serviceOff:
    case LocateResult.failed:
      context.push('/location/unavailable', extra: r == LocateResult.serviceOff);
  }
}

/// Reverse-geocodes a point into an address draft (platform geocoder; no API key needed).
Future<Address> addressFrom(LatLng p) async {
  try {
    final marks = await _geo.placemarkFromCoordinates(p.latitude, p.longitude);
    final m = marks.isEmpty ? null : marks.first;
    final line1 = <String?>[m?.name, m?.street].whereType<String>().where((x) => x.isNotEmpty).toSet().join(', ');
    return Address(
      id: '',
      label: 'Home',
      recipient: '',
      phone: '',
      line1: line1,
      line2: m?.subLocality?.isNotEmpty == true ? m!.subLocality : m?.locality,
      city: m?.locality ?? m?.subAdministrativeArea ?? '',
      state: m?.administrativeArea ?? '',
      postalCode: m?.postalCode ?? '',
      lat: p.latitude,
      lng: p.longitude,
    );
  } catch (_) {
    return Address(id: '', label: 'Home', recipient: '', phone: '', line1: '', city: '', state: '', postalCode: '', lat: p.latitude, lng: p.longitude);
  }
}

// ----------------------------------------------------- 33. Permission explanation
class LocationPermissionScreen extends StatefulWidget {
  const LocationPermissionScreen({super.key});
  @override
  State<LocationPermissionScreen> createState() => _LocationPermissionScreenState();
}

class _LocationPermissionScreenState extends State<LocationPermissionScreen> {
  bool _busy = false;
  @override
  Widget build(BuildContext context) => StatusScreen(
        showBack: true,
        icon: Icons.location_on_rounded,
        title: 'Allow Location Access',
        message: 'We use your location only to find your delivery address and show products available near you. You can change this anytime in Settings.',
        footer: const Column(children: [
          _Point(Icons.storefront_outlined, 'See what’s available in your area'),
          _Point(Icons.local_shipping_outlined, 'Faster, accurate delivery to your door'),
          _Point(Icons.lock_outline, 'Never shared or used for ads'),
        ]),
        primaryLabel: 'Allow Location',
        busy: _busy,
        onPrimary: () async {
          setState(() => _busy = true);
          await useCurrentLocation(context);
          if (mounted) setState(() => _busy = false);
        },
        secondaryLabel: 'Enter address manually',
        onSecondary: () => context.push('/address/new'),
      );
}

class _Point extends StatelessWidget {
  const _Point(this.icon, this.text);
  final IconData icon;
  final String text;
  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.symmetric(vertical: VsrSpace.sm),
        child: Row(children: [Icon(icon, size: 20, color: context.vsr.brandText), const SizedBox(width: VsrSpace.md), Expanded(child: Text(text))]),
      );
}

// ------------------------------------------------------ 35. Choose delivery location
class ChooseLocationScreen extends ConsumerStatefulWidget {
  const ChooseLocationScreen({super.key});
  @override
  ConsumerState<ChooseLocationScreen> createState() => _ChooseLocationScreenState();
}

class _ChooseLocationScreenState extends ConsumerState<ChooseLocationScreen> {
  String? _setting;

  Future<void> _select(Address a) async {
    if (a.isDefault) return context.pop();
    setState(() => _setting = a.id);
    try {
      await ref.read(apiProvider).put('/store/me/addresses/${a.id}', {...a.toJson(), 'isDefault': true});
      ref.invalidate(addressesProvider);
      if (mounted) {
        showMessage(context, 'Delivering to ${a.label}');
        context.pop();
      }
    } catch (e) {
      if (mounted) showMessage(context, errorText(e), error: true);
    } finally {
      if (mounted) setState(() => _setting = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    final list = ref.watch(addressesProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('Choose Delivery Location')),
      body: ListView(padding: const EdgeInsets.fromLTRB(VsrSpace.gutter, VsrSpace.sm, VsrSpace.gutter, VsrSpace.xl), children: [
        InkWell(
          onTap: () => context.push('/location/search'),
          borderRadius: BorderRadius.circular(VsrRadius.md),
          child: InputDecorator(decoration: const InputDecoration(prefixIcon: Icon(Icons.search)), child: Text('Search area, street or landmark', style: TextStyle(color: context.vsr.muted))),
        ),
        const SizedBox(height: VsrSpace.lg),
        TileGroup(children: [
          NavTile(icon: Icons.my_location, label: 'Use my current location', detail: 'Using GPS', onTap: () => context.push('/location/permission')),
          NavTile(icon: Icons.map_outlined, label: 'Pick on map', onTap: () => context.push('/location/map')),
          NavTile(icon: Icons.edit_location_alt_outlined, label: 'Enter address manually', onTap: () => context.push('/address/new')),
        ]),
        const SizedBox(height: VsrSpace.xl),
        list.when(
          loading: () => const LoadingView(rows: 2),
          error: (e, _) => ErrorView(error: e, onRetry: () => ref.invalidate(addressesProvider)),
          data: (items) => TileGroup(title: 'Saved addresses', children: [
            if (items.isEmpty)
              Padding(
                padding: const EdgeInsets.all(VsrSpace.lg),
                child: Text('No saved addresses yet. Add one above and it will show here.', style: Theme.of(context).textTheme.bodySmall),
              ),
            for (final a in items)
              ListTile(
                leading: Icon(a.label == 'Work' ? Icons.business_outlined : a.label == 'Home' ? Icons.home_outlined : Icons.location_on_outlined, color: context.vsr.brandText),
                title: Text(a.label),
                subtitle: Text(a.oneLine, maxLines: 2, overflow: TextOverflow.ellipsis),
                trailing: _setting == a.id
                    ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2))
                    : Icon(a.isDefault ? Icons.check_circle : Icons.radio_button_unchecked, color: a.isDefault ? context.vsr.brandText : context.vsr.muted),
                onTap: () => _select(a),
              ),
          ]),
        ),
        const SizedBox(height: VsrSpace.sm),
        Center(child: TextButton(onPressed: () => context.push('/addresses'), child: const Text('Manage saved addresses'))),
      ]),
    );
  }
}

// -------------------------------------------------------------- 36. Search location
class LocationSearchScreen extends StatefulWidget {
  const LocationSearchScreen({super.key});
  @override
  State<LocationSearchScreen> createState() => _LocationSearchScreenState();
}

class _LocationSearchScreenState extends State<LocationSearchScreen> {
  final _c = TextEditingController();
  Timer? _debounce;
  bool _busy = false;
  String? _error;
  List<(String, LatLng)> _results = [];

  @override
  void dispose() {
    _debounce?.cancel();
    _c.dispose();
    super.dispose();
  }

  Future<void> _search(String q) async {
    if (q.trim().length < 3) return setState(() => _results = []);
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final locs = await _geo.locationFromAddress(q.trim().toLowerCase().contains('hyderabad') ? q : '$q, Hyderabad');
      final out = <(String, LatLng)>[];
      for (final l in locs.take(5)) {
        final p = LatLng(l.latitude, l.longitude);
        final a = await addressFrom(p);
        out.add(([a.line1, a.line2, a.city, a.postalCode].where((x) => x != null && x.isNotEmpty).join(', '), p));
      }
      if (mounted) setState(() => _results = out);
    } catch (_) {
      if (mounted) setState(() => _results = []);
      if (mounted) setState(() => _error = 'No places found for “$q”. Try a nearby landmark or enter your address manually.');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(
          titleSpacing: 0,
          title: Padding(
            padding: const EdgeInsets.only(right: VsrSpace.gutter),
            child: TextField(
              controller: _c,
              autofocus: true,
              textInputAction: TextInputAction.search,
              decoration: const InputDecoration(hintText: 'Search area, street or landmark', prefixIcon: Icon(Icons.search)),
              onSubmitted: _search,
              onChanged: (v) {
                _debounce?.cancel();
                _debounce = Timer(const Duration(milliseconds: 600), () => _search(v));
              },
            ),
          ),
        ),
        body: ListView(padding: const EdgeInsets.fromLTRB(VsrSpace.gutter, VsrSpace.xs, VsrSpace.gutter, VsrSpace.xl), children: [
          ListTile(contentPadding: EdgeInsets.zero, leading: const Icon(Icons.my_location, color: VsrColors.accent), title: const Text('Use my current location'), onTap: () => context.push('/location/permission')),
          const Divider(),
          if (_busy) const LoadingView(rows: 3),
          if (_error != null && !_busy) Padding(padding: const EdgeInsets.symmetric(vertical: VsrSpace.md), child: NoticeBanner(message: _error!, action: 'Enter manually', onAction: () => context.push('/address/new'))),
          for (final r in _results)
            ListTile(contentPadding: EdgeInsets.zero, leading: Icon(Icons.location_on_outlined, color: context.vsr.muted), title: Text(r.$1, maxLines: 2, overflow: TextOverflow.ellipsis), onTap: () => context.push('/location/map', extra: r.$2)),
        ]),
      );
}

// ------------------------------------------------------ 37 + 38. Map pick & confirm
class MapPickScreen extends ConsumerStatefulWidget {
  const MapPickScreen({super.key, this.initial});
  final LatLng? initial;
  @override
  ConsumerState<MapPickScreen> createState() => _MapPickScreenState();
}

class _MapPickScreenState extends ConsumerState<MapPickScreen> {
  final _map = MapController();
  late LatLng _center = widget.initial ?? _fallback;
  Address? _draft;
  bool _resolving = true, _checking = false;
  Timer? _debounce;

  @override
  void initState() {
    super.initState();
    _resolve();
  }

  @override
  void dispose() {
    _debounce?.cancel();
    super.dispose();
  }

  Future<void> _resolve() async {
    setState(() => _resolving = true);
    final a = await addressFrom(_center);
    if (mounted) {
      setState(() {
        _draft = a;
        _resolving = false;
      });
    }
  }

  Future<void> _confirm() async {
    final a = _draft;
    if (a == null) return;
    setState(() => _checking = true);
    try {
      final r = await ref.read(apiProvider).get('/store/serviceability', query: {'pincode': a.postalCode}) as Json;
      if (!mounted) return;
      if (r['serviceable'] == true) {
        context.push('/address/new', extra: a);
      } else {
        context.push('/location/not-serviceable', extra: a);
      }
    } catch (e) {
      if (mounted) showMessage(context, errorText(e), error: true);
    } finally {
      if (mounted) setState(() => _checking = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final a = _draft;
    return Scaffold(
      appBar: AppBar(title: const Text('Select on Map')),
      body: Stack(children: [
        FlutterMap(
          mapController: _map,
          options: MapOptions(
            initialCenter: _center,
            initialZoom: 16,
            onPositionChanged: (cam, gesture) {
              if (!gesture) return;
              _center = cam.center;
              _debounce?.cancel();
              _debounce = Timer(const Duration(milliseconds: 500), _resolve);
            },
          ),
          children: [
            TileLayer(urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', userAgentPackageName: 'in.vsr.vsr_customer'),
            const RichAttributionWidget(attributions: [TextSourceAttribution('© OpenStreetMap contributors')]),
          ],
        ),
        // Fixed pin at the map centre; the user moves the map under it.
        const IgnorePointer(child: Center(child: Padding(padding: EdgeInsets.only(bottom: 44), child: Icon(Icons.location_on, size: 48, color: VsrColors.brand800, semanticLabel: 'Delivery pin')))),
        Positioned(
          right: 16,
          top: 16,
          child: FloatingActionButton.small(
            heroTag: 'locate',
            tooltip: 'Go to my location',
            backgroundColor: context.vsr.surface,
            onPressed: () async {
              final (r, p) = await locateOnce();
              if (r == LocateResult.ok && p != null) {
                _map.move(p, 17);
                _center = p;
                _resolve();
              } else if (context.mounted) {
                context.push(r == LocateResult.serviceOff || r == LocateResult.failed ? '/location/unavailable' : '/location/denied', extra: r == LocateResult.serviceOff || r == LocateResult.deniedForever);
              }
            },
            child: Icon(Icons.my_location, color: context.vsr.brandText),
          ),
        ),
      ]),
      bottomNavigationBar: Material(
        color: context.vsr.surface,
        shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
        elevation: 8,
        child: SafeArea(
          top: false,
          child: Padding(
            padding: const EdgeInsets.fromLTRB(VsrSpace.gutter + 4, VsrSpace.xl, VsrSpace.gutter + 4, VsrSpace.md),
            child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                const Icon(Icons.location_on_outlined, color: VsrColors.accent),
                const SizedBox(width: VsrSpace.md),
                Expanded(
                  child: Semantics(
                    liveRegion: true,
                    child: _resolving
                        ? const Text('Finding address…')
                        : Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                            const Text('Deliver to this location', style: TextStyle(fontWeight: FontWeight.w700)),
                            const SizedBox(height: VsrSpace.xxs),
                            Text(
                              a == null || (a.line1.isEmpty && a.postalCode.isEmpty) ? 'Address not found for this spot. You can type it on the next step.' : [a.line1, a.line2, a.city, a.postalCode].where((x) => x != null && x.isNotEmpty).join(', '),
                              style: Theme.of(context).textTheme.bodySmall,
                            ),
                          ]),
                  ),
                ),
              ]),
              const SizedBox(height: VsrSpace.lg),
              FilledButton(onPressed: _resolving || _checking ? null : _confirm, child: _checking ? const Busy() : const Text('Confirm Location')),
            ]),
          ),
        ),
      ),
    );
  }
}

// ---------------------------------------------------------- 39. Not serviceable
class NotServiceableScreen extends StatelessWidget {
  const NotServiceableScreen({super.key, this.address});
  final Address? address;
  @override
  Widget build(BuildContext context) => StatusScreen(
        showBack: true,
        icon: Icons.wrong_location_outlined,
        tone: StatusTone.warning,
        title: 'We don’t deliver here yet',
        message: '${address?.postalCode.isNotEmpty == true ? 'PIN ${address!.postalCode} is' : 'This location is'} outside our delivery area for now. We’re expanding soon — try another address meanwhile.',
        primaryLabel: 'Change Location',
        onPrimary: () => context.pop(),
        secondaryLabel: 'Save address anyway',
        onSecondary: () => context.pushReplacement('/address/new', extra: address),
      );
}

// ------------------------------------------------ 40. Location unavailable / GPS off
class LocationUnavailableScreen extends StatelessWidget {
  const LocationUnavailableScreen({super.key, required this.serviceOff});
  final bool serviceOff;
  @override
  Widget build(BuildContext context) => StatusScreen(
        showBack: true,
        icon: Icons.location_disabled_rounded,
        tone: StatusTone.warning,
        title: serviceOff ? 'Location is turned off' : 'Couldn’t find your location',
        message: serviceOff ? 'Turn on location (GPS) on your phone so we can find your delivery address.' : 'We couldn’t get a GPS fix. Move near a window or try again, or enter your address manually.',
        primaryLabel: serviceOff ? 'Turn On Location' : 'Try Again',
        onPrimary: () async {
          // Both paths stay inside the app: the system dialog turns GPS on, then we locate again
          if (serviceOff && !await turnOnLocationInApp()) return;
          if (!context.mounted) return;
          context.pop();
          await useCurrentLocation(context);
        },
        secondaryLabel: 'Enter address manually',
        onSecondary: () => context.pushReplacement('/address/new'),
      );
}

// --------------------------------------------------------- 41. Permission denied
class LocationDeniedScreen extends StatelessWidget {
  const LocationDeniedScreen({super.key, required this.permanently});
  final bool permanently;
  @override
  Widget build(BuildContext context) => StatusScreen(
        showBack: true,
        icon: Icons.location_off_rounded,
        tone: StatusTone.danger,
        title: 'Location permission denied',
        message: permanently
            ? 'Location access is blocked for VSR. Enable it in app settings, or add your address manually — it works just as well.'
            : 'No problem! You can allow location next time, or add your delivery address manually.',
        primaryLabel: permanently ? 'Open App Settings' : 'Allow Location',
        onPrimary: () async {
          if (permanently) {
            await Geolocator.openAppSettings();
          } else if (context.mounted) {
            context.pop();
            await useCurrentLocation(context);
          }
        },
        secondaryLabel: 'Enter address manually',
        onSecondary: () => context.pushReplacement('/address/new'),
      );
}
