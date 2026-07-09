Place two real image files here before running the icon/splash generators:

- `icon.png` — 1024x1024 PNG, no transparency for iOS (transparency is fine for Android
  adaptive icons but keep a solid version too). This becomes your app icon on both platforms.
- `splash.png` — your splash/launch screen image, ideally a simple centered logo on a plain
  background (matches the `color: "#FFFFFF"` set in pubspec.yaml — change both together).

Neither file exists yet — this is a placeholder. Once added:

```
dart run flutter_launcher_icons
dart run flutter_native_splash:create
```

Both commands read the config already set up in pubspec.yaml and generate the actual
platform-specific icon/splash assets into android/ and ios/ (which themselves only exist after
you've run `flutter create .` — see the main README).
