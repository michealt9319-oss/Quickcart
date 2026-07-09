# Running Flutter tests locally (Windows)

Prerequisites:
- Windows 10/11
- PowerShell or Windows Terminal
- Git

1) Install Flutter (recommended via winget):

```powershell
# Install Flutter via winget (requires Windows 10 1809+)
winget install --id=Google.Flutter -e
```

If `winget` is not available, follow the official guide:
https://flutter.dev/docs/get-started/install/windows

2) Add `flutter` to your PATH (usually handled by installer). Then verify:

```powershell
flutter doctor
flutter --version
```

3) Run the tests for the app:

```powershell
cd C:\Users\hp\Desktop\quickcart\quickcart-app
flutter pub get
flutter test
```

Notes:
- If you see missing Android SDK or other warnings from `flutter doctor`, install the required SDKs or disable tooling not needed for unit tests.
- CI: a GitHub Actions workflow was added at `.github/workflows/flutter-tests.yml` to run `flutter test` on push/PR for `quickcart-app`.
