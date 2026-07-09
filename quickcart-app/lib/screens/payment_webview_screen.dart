import 'package:flutter/material.dart';
import 'package:webview_flutter/webview_flutter.dart';
import 'order_status_screen.dart';

/// Shows Paystack's hosted checkout page in an in-app WebView rather than
/// building a custom card-entry form — this way card details never pass
/// through app code, matching the "always verify server-side" rule from
/// the backend. When the WebView navigates to the backend's configured
/// callback URL (.../order/<orderId>), we intercept it and show our own
/// native order-status screen instead of letting the WebView render the
/// web app's confirmation page.
class PaymentWebviewScreen extends StatefulWidget {
  final String checkoutUrl;
  final String orderId;

  const PaymentWebviewScreen({super.key, required this.checkoutUrl, required this.orderId});

  @override
  State<PaymentWebviewScreen> createState() => _PaymentWebviewScreenState();
}

class _PaymentWebviewScreenState extends State<PaymentWebviewScreen> {
  late final WebViewController _controller;
  bool _redirected = false;

  @override
  void initState() {
    super.initState();
    _controller = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setNavigationDelegate(
        NavigationDelegate(
          onNavigationRequest: (request) {
            if (!_redirected && request.url.contains('/order/${widget.orderId}')) {
              _goToStatus();
              return NavigationDecision.prevent;
            }
            return NavigationDecision.navigate;
          },
        ),
      )
      ..loadRequest(Uri.parse(widget.checkoutUrl));
  }

  void _goToStatus() {
    if (_redirected) return;
    _redirected = true;
    Navigator.pushReplacement(
      context,
      MaterialPageRoute(builder: (_) => OrderStatusScreen(orderId: widget.orderId)),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Secure payment'),
        actions: [
          // Fallback for the case URL-based redirect detection above ever
          // misses (e.g. Paystack changes their redirect behavior, or the
          // customer's bank's 3D-Secure page adds an extra hop that
          // confuses the string match). The order-status screen fetches
          // the REAL status from the backend regardless of how the
          // customer got there, so this is always safe to offer — it
          // never fabricates a "paid" state, it just checks.
          TextButton(
            onPressed: _goToStatus,
            child: const Text("I've completed payment", style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
      body: WebViewWidget(controller: _controller),
    );
  }
}
