# Template only — Fastlane needs to live at android/fastlane/Fastfile, which
# doesn't exist until you've run `flutter create .` (see main README). After
# that:
#
#   mkdir -p android/fastlane
#   cp ci/fastlane-templates/Android.Fastfile android/fastlane/Fastfile
#   cd android && bundle init && bundle add fastlane
#
# Then fill in the placeholders below (signing config, Play Console API
# key) — none of that can be generated without your actual Play Console
# account and signing keystore, which is real account setup, not code.

default_platform(:android)

platform :android do
  desc "Build a release APK"
  lane :build do
    sh("flutter build apk --release --dart-define=API_BASE_URL=#{ENV['API_BASE_URL']}")
  end

  desc "Upload to Play Store internal testing track"
  lane :internal do
    build
    upload_to_play_store(
      track: "internal",
      apk: "../build/app/outputs/flutter-apk/app-release.apk",
      json_key: ENV["PLAY_STORE_JSON_KEY_PATH"] # path to your Play Console service account key
    )
  end
end
