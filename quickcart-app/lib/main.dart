import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'services/cart_service.dart';
import 'screens/home_screen.dart';

void main() {
  // If you've run `flutterfire configure` and added the generated
  // firebase_options.dart, initialize Firebase here before runApp so push
  // notifications work from a cold start:
  //
  //   WidgetsFlutterBinding.ensureInitialized();
  //   await Firebase.initializeApp(options: DefaultFirebaseOptions.currentPlatform);
  //
  // Not called unconditionally here since that file doesn't exist until
  // you generate it — see README's "Push notifications" section. The app
  // works fine without it; push registration in push_service.dart is
  // best-effort and fails silently if Firebase isn't set up.
  runApp(const QuickCartApp());
}

class QuickCartApp extends StatelessWidget {
  const QuickCartApp({super.key});

  @override
  Widget build(BuildContext context) {
    return ChangeNotifierProvider(
      create: (_) => CartService()..loadFromDisk(),
      child: MaterialApp(
        title: 'QuickCart',
        debugShowCheckedModeBanner: false,
        theme: ThemeData(
          colorSchemeSeed: const Color(0xFF0F6E56),
          useMaterial3: true,
          inputDecorationTheme: const InputDecorationTheme(isDense: true),
        ),
        home: const HomeScreen(),
      ),
    );
  }
}
