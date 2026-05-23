import 'package:flutter/material.dart';
import 'package:techsan_restaurant/core/network/api_client.dart';
import 'package:mobile_scanner/mobile_scanner.dart';

class WaiterHomeScreen extends StatefulWidget {
  const WaiterHomeScreen({super.key});

  @override
  State<WaiterHomeScreen> createState() => _WaiterHomeScreenState();
}

class _WaiterHomeScreenState extends State<WaiterHomeScreen> {
  final _api = ApiClient();
  List<dynamic> _tables = [];

  @override
  void initState() {
    super.initState();
    _loadTables();
  }

  Future<void> _loadTables() async {
    final res = await _api.dio.get('/tables/live');
    setState(() => _tables = res.data['data']);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Waiter - Tables')),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => Navigator.push(
          context,
          MaterialPageRoute(builder: (_) => const _QrScanner()),
        ),
        icon: const Icon(Icons.qr_code_scanner),
        label: const Text('Scan QR'),
      ),
      body: RefreshIndicator(
        onRefresh: _loadTables,
        child: GridView.builder(
          padding: const EdgeInsets.all(16),
          gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: 3,
            childAspectRatio: 1.2,
            crossAxisSpacing: 12,
            mainAxisSpacing: 12,
          ),
          itemCount: _tables.length,
          itemBuilder: (_, i) {
            final t = _tables[i];
            final color = t['status'] == 'occupied' ? Colors.red.shade100 : Colors.green.shade100;
            return Card(
              color: color,
              child: InkWell(
                onTap: () {},
                child: Center(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(t['number'], style: const TextStyle(fontSize: 24, fontWeight: FontWeight.bold)),
                      Text(t['status'], style: const TextStyle(fontSize: 12)),
                    ],
                  ),
                ),
              ),
            );
          },
        ),
      ),
    );
  }
}

class _QrScanner extends StatelessWidget {
  const _QrScanner();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Scan Table QR')),
      body: MobileScanner(
        onDetect: (capture) {
          final code = capture.barcodes.first.rawValue;
          if (code != null) Navigator.pop(context, code);
        },
      ),
    );
  }
}
