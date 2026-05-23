import 'package:flutter/material.dart';
import 'package:techsan_restaurant/core/network/api_client.dart';
import 'package:techsan_restaurant/core/network/socket_service.dart';

class KdsScreen extends StatefulWidget {
  const KdsScreen({super.key});

  @override
  State<KdsScreen> createState() => _KdsScreenState();
}

class _KdsScreenState extends State<KdsScreen> {
  final _api = ApiClient();
  final _socket = SocketService();
  List<dynamic> _orders = [];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final res = await _api.dio.get('/orders/kitchen');
    setState(() => _orders = res.data['data']);
  }

  Future<void> _updateStatus(String orderId, String status) async {
    await _api.dio.patch('/orders/$orderId/status', data: {'status': status});
    _load();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Kitchen Display'),
        actions: [
          IconButton(icon: const Icon(Icons.refresh), onPressed: _load),
        ],
      ),
      body: _orders.isEmpty
          ? const Center(child: Text('No pending orders'))
          : ListView.builder(
              padding: const EdgeInsets.all(12),
              itemCount: _orders.length,
              itemBuilder: (_, i) {
                final order = _orders[i];
                return Card(
                  margin: const EdgeInsets.only(bottom: 12),
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text('#${order['orderNumber']}', style: const TextStyle(fontWeight: FontWeight.bold)),
                            Chip(label: Text(order['status'])),
                          ],
                        ),
                        Text('Table: ${order['tableId']?['number'] ?? '—'}'),
                        const Divider(),
                        ...((order['items'] as List?) ?? []).map((item) => Padding(
                              padding: const EdgeInsets.symmetric(vertical: 2),
                              child: Text('${item['quantity']}x ${item['name']}'),
                            )),
                        const SizedBox(height: 12),
                        Row(
                          children: [
                            Expanded(
                              child: FilledButton(
                                onPressed: () => _updateStatus(order['_id'], 'preparing'),
                                child: const Text('Start'),
                              ),
                            ),
                            const SizedBox(width: 8),
                            Expanded(
                              child: FilledButton(
                                onPressed: () => _updateStatus(order['_id'], 'ready'),
                                style: FilledButton.styleFrom(backgroundColor: Colors.green),
                                child: const Text('Ready'),
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                );
              },
            ),
    );
  }
}
