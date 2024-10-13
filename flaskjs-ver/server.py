from flask import Flask, render_template
from flask_socketio import SocketIO, emit
import threading
import time
from bcc import BPF
import socket
import struct
import subprocess

packets = []
app = Flask(__name__)
socketio = SocketIO(app, cors_allowed_origins="*")

ping_processes = []
#process_lock = threading.Lock()

def start_ping():
    """127.0.0.1 に ping を送信するバックグラウンドプロセスを開始"""
    with process_lock:
        process = subprocess.Popen(['ping', '10.2.93.231'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        ping_processes.append(process)

def stop_all_pings():
    """すべての ping プロセスを停止"""
    with process_lock:
        while ping_processes:
            process = ping_processes.pop()
            process.terminate()

@socketio.on('start_ping')
def handle_start_ping(data):
    """クライアントからの 'start_ping' イベントを処理"""
    count = data.get('count', 1)  # デフォルトで1つ増加
    for _ in range(count):
        threading.Thread(target=start_ping).start()
    socketio.emit('status', {'message': f'{count} ping process(es) started.'})

@socketio.on('stop_ping')
def handle_stop_ping():
    """クライアントからの 'stop_ping' イベントを処理"""
    stop_all_pings()
    socketio.emit('status', {'message': 'All ping processes stopped.'})

scores = []
scores_file = "scores.txt"
def load_scores_from_file():
    try:
        with open(scores_file, "r") as f:
            loaded_scores = [int(line.strip()) for line in f.readlines()]
            return sorted(loaded_scores, reverse=True)
    except FileNotFoundError:
        return []

def save_score_to_file(score):
    with open(scores_file, "a") as f:
        f.write(f"{score}\n")

@socketio.on('save_score')
def handle_save_score(data):
    score = data.get('score', 0)
    scores.append(score)
    scores.sort(reverse=True)
    save_score_to_file(score)
    print(f"Score saved: {score}, All scores: {scores}")

def packet_callback(cpu, data, size):
    packet_info = bpf["events"].event(data)
    #print(packet_info.src_ip)
    packets.append({
        "src_ip": socket.inet_ntoa(struct.pack("<I", packet_info.src_ip)),
        "dest_ip": socket.inet_ntoa(struct.pack("<I", packet_info.dest_ip)),
        "packet_len": packet_info.packet_len,
        "type": packet_info.type,
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

@app.route('/monitor')
def show_monitor():
    return render_template('monitor.html')

@app.route('/scores')
def get_scores():
    return {'scores': scores}

# サーバー起動時にホストからデータを取得するスレッドを起動
@socketio.on('connect')
def handle_connect():
    thread = threading.Thread(target=fetch_data_from_host)
    thread.start()

if __name__ == '__main__':
    try:
        bpf = BPF(src_file="sniffer.bpf.c")
        function_xdp = bpf.load_func("packet_monitor", BPF.XDP)
        device = "enp1s0f0"
        bpf.attach_xdp(device, fn=function_xdp)
        scores = load_scores_from_file()
        socketio.run(app, host='0.0.0.0', port=443, ssl_context=('cert/cert.pem', 'cert/key.pem'))
        #socketio.run(app, host='0.0.0.0', port=5000)
    finally:
        print("detaching ebpf program")
        bpf.remove_xdp(device, 0)

