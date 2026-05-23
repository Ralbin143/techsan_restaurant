import 'package:flutter/material.dart';
import 'package:techsan_restaurant/core/network/api_client.dart';

class CashierScreen extends StatefulWidget {
  const CashierScreen({super.key});

  @override
  State<CashierScreen> createState() => _CashierScreenState();
}

class _CashierScreenState extends State<CashierScreen> {
  final _api = ApiClient();
  List<dynamic> _orders = [];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final res = await _api.dio.get('/orders', queryParameters: {'status': 'served'});
    setState(() => _orders = res.data['data']);
  }

  Future<void> _pay(String orderId, double amount, String method) async {
    await _api.dio.post('/payments', data: {
      'orderId': orderId,
      'amount': amount,
      'method': method,
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Cashier / Billing')),
      body: ListView.builder(
        itemCount: _orders.length,
        itemBuilder: (_, i) {
          final order = _orders[i];
          return ListTile(
            title: Text(order['orderNumber']),
            subtitle: Text('₹${order['total']}'),
            trailing: PopupMenuButton(
              onSelected: (m) => _pay(order['_id'], order['total'].toDouble(), m),
              itemBuilder: (_) => [
                const PopupMenuItem(value: 'cash', child: Text('Cash')),
                const PopupMenuItem(value: 'upi', child: Text('UPI')),
                const PopupMenuItem(value: 'card', child: Text('Card')),
                const PopupMenuItem(value: 'online', child: Text('Razorpay')),
              ],
              child: const FilledButton(child: Text('Pay')),
            ),
          );
        },
      ),
    );
  }
}
