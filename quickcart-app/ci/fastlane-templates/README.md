# Fastlane templates

These are templates, not working Fastlane configs — Fastlane needs to live at
`android/fastlane/Fastfile` and `ios/fastlane/Fastfile`, neither of which exists until you've
run `flutter create .` (see the main README's "generating the native project shell" section).

## Why these aren't wired up automatically

Beyond the directory not existing yet, both lanes assume real credentials that only you can
provide:

- **Android**: a Play Console service account JSON key, and your app already created in Play
  Console with a package name matching this project's.
- **iOS**: an Apple Developer Program enrollment, a signing certificate, a provisioning
  profile, and an App Store Connect API key.

None of that is code — it's account setup and credential provisioning that has to happen in
Google Play Console / Apple Developer / App Store Connect directly. The `.github/workflows/ci.yml`
in this project deliberately stops at `flutter analyze` and `flutter test` for the same reason —
it doesn't attempt a signed release build, since doing so without real signing credentials would
either fail or produce a build you can't actually distribute anyway.

## Steps once you're ready

1. `flutter create .` (generates `android/` and `ios/`)
2. `mkdir -p android/fastlane ios/fastlane`
3. Copy `Android.Fastfile` → `android/fastlane/Fastfile`, `iOS.Fastfile` → `ios/fastlane/Fastfile`
4. Fill in the real credential paths referenced as `ENV[...]` in each file
5. `cd android && bundle init && bundle add fastlane` (repeat under `ios/`)
6. `bundle exec fastlane android internal` / `bundle exec fastlane ios beta`
