import 'package:socket_io_client/socket_io_client.dart' as io;

class SocketService {
  io.Socket? _socket;

  void connect(String baseUrl, String token, {required String branchId}) {
    _socket = io.io(
      baseUrl,
      io.OptionBuilder()
          .setTransports(['websocket'])
          .setAuth({'token': token})
          .build(),
    );
    _socket!.onConnect((_) {
      _socket!.emit('join:table', branchId);
    });
  }

  void on(String event, void Function(dynamic) handler) {
    _socket?.on(event, handler);
  }

  void disconnect() {
    _socket?.disconnect();
    _socket = null;
  }
}
