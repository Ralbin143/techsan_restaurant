import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class ApiClient {
  ApiClient({String baseUrl = 'http://localhost:4000/api/v1'})
      : _dio = Dio(BaseOptions(baseUrl: baseUrl, connectTimeout: const Duration(seconds: 15))) {
    _dio.interceptors.add(InterceptorsWrapper(
      onRequest: (options, handler) async {
        final token = await _storage.read(key: 'accessToken');
        if (token != null) options.headers['Authorization'] = 'Bearer $token';
        handler.next(options);
      },
      onError: (error, handler) async {
        if (error.response?.statusCode == 401) {
          final refresh = await _storage.read(key: 'refreshToken');
          if (refresh != null) {
            try {
              final res = await Dio().post(
                '${_dio.options.baseUrl}/auth/refresh',
                data: {'refreshToken': refresh},
              );
              await _storage.write(key: 'accessToken', value: res.data['data']['accessToken']);
              error.requestOptions.headers['Authorization'] =
                  'Bearer ${res.data['data']['accessToken']}';
              final retry = await _dio.fetch(error.requestOptions);
              return handler.resolve(retry);
            } catch (_) {}
          }
        }
        handler.next(error);
      },
    ));
  }

  final Dio _dio;
  final _storage = const FlutterSecureStorage();

  Dio get dio => _dio;

  Future<void> saveTokens(String access, String refresh) async {
    await _storage.write(key: 'accessToken', value: access);
    await _storage.write(key: 'refreshToken', value: refresh);
  }

  Future<void> clearTokens() async {
    await _storage.deleteAll();
  }
}
