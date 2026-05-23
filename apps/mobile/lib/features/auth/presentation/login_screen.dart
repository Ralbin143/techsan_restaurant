import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:techsan_restaurant/core/network/api_client.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _email = TextEditingController();
  final _password = TextEditingController();
  final _api = ApiClient();
  bool _loading = false;

  Future<void> _login(String route) async {
    setState(() => _loading = true);
    try {
      final res = await _api.dio.post('/auth/login', data: {
        'email': _email.text,
        'password': _password.text,
        'platform': 'android',
      });
      await _api.saveTokens(
        res.data['data']['accessToken'],
        res.data['data']['refreshToken'],
      );
      if (mounted) context.go(route);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Login failed')),
        );
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Spacer(),
              const Text('TechSan', style: TextStyle(fontSize: 36, fontWeight: FontWeight.bold, color: Color(0xFFEA580C))),
              const Text('Staff Login', style: TextStyle(color: Colors.grey)),
              const SizedBox(height: 32),
              TextField(controller: _email, decoration: const InputDecoration(labelText: 'Email', border: OutlineInputBorder())),
              const SizedBox(height: 16),
              TextField(controller: _password, obscureText: true, decoration: const InputDecoration(labelText: 'Password', border: OutlineInputBorder())),
              const SizedBox(height: 24),
              FilledButton(
                onPressed: _loading ? null : () => _login('/waiter'),
                child: _loading ? const CircularProgressIndicator() : const Text('Waiter Login'),
              ),
              const SizedBox(height: 8),
              OutlinedButton(onPressed: () => _login('/kitchen'), child: const Text('Kitchen (KDS)')),
              const SizedBox(height: 8),
              OutlinedButton(onPressed: () => _login('/cashier'), child: const Text('Cashier')),
              const Spacer(),
            ],
          ),
        ),
      ),
    );
  }
}
