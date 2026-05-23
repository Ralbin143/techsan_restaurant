import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:techsan_restaurant/features/auth/presentation/login_screen.dart';
import 'package:techsan_restaurant/features/waiter/presentation/waiter_home_screen.dart';
import 'package:techsan_restaurant/features/kitchen/presentation/kds_screen.dart';
import 'package:techsan_restaurant/features/cashier/presentation/cashier_screen.dart';
import 'package:techsan_restaurant/core/theme/app_theme.dart';

final _router = GoRouter(
  initialLocation: '/login',
  routes: [
    GoRoute(path: '/login', builder: (_, __) => const LoginScreen()),
    GoRoute(path: '/waiter', builder: (_, __) => const WaiterHomeScreen()),
    GoRoute(path: '/kitchen', builder: (_, __) => const KdsScreen()),
    GoRoute(path: '/cashier', builder: (_, __) => const CashierScreen()),
  ],
);

class TechSanApp extends StatelessWidget {
  const TechSanApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp.router(
      title: 'TechSan Restaurant',
      theme: AppTheme.light,
      darkTheme: AppTheme.dark,
      routerConfig: _router,
      debugShowCheckedModeBanner: false,
    );
  }
}
