from flask import Flask, render_template
from flask_socketio import SocketIO, emit
import threading
import time
from bcc import BPF
import socket
import struct

packets = []
app = Flask(__name__)
socketio = SocketIO(app)

def packet_callback(cpu, data, size):
    packet_info = bpf["events"].event(data)
    #print(packet_info.src_ip)
    packets.append({
        "src_ip": socket.inet_ntoa(struct.pack("<I", packet_info.src_ip)),
        "dest_ip": socket.inet_ntoa(struct.pack("<I", packet_info.dest_ip)),
        "packet_len": packet_info.packet_len,
        "timestamp": time.time()
    })
    #print(socket.inet_ntoa(struct.pack("<I", packet_info.src_ip)))
    #print("Packet received")

def fetch_data_from_host():
    bpf["events"].open_perf_buffer(packet_callback)
    """
    別スレッドでホストからデータを定期的に取得して、クライアントに送信する。
    """
    while True:
        packets.clear()
        bpf.perf_buffer_poll(timeout=10) # 10ms pollする
        print(packets)
        if len(packets) != 0:
            data = packets[0]
            # クライアントにWebSocketでデータを送信
            socketio.emit('new_data', {'data': data['src_ip']})
            socketio.emit('packet', {'data': data})
        else:
            # クライアントにWebSocketでデータを送信
            socketio.emit('new_data', {'data': "no packet arrived"})
        # 1秒ごとにデータを取得
        time.sleep(1)

@app.route('/')
def index():
    return render_template('index.html')

# サーバー起動時にホストからデータを取得するスレッドを起動
@socketio.on('connect')
def handle_connect():
    thread = threading.Thread(target=fetch_data_from_host)
    thread.start()

if __name__ == '__main__':
    try:
        bpf = BPF(src_file="sniffer.bpf.c")
        function_xdp = bpf.load_func("packet_monitor", BPF.XDP)
        device = "enp6s18"
        bpf.attach_xdp(device, fn=function_xdp)
        socketio.run(app, host='0.0.0.0', port=5000)
    finally:
        print("detaching ebpf program")
        bpf.remove_xdp(device, 0)

